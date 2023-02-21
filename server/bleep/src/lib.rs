#![deny(
    clippy::all,
    arithmetic_overflow,
    future_incompatible,
    nonstandard_style,
    rust_2018_idioms,
    unused_crate_dependencies,
    unused_lifetimes,
    unused_qualifications
)]
#![allow(elided_lifetimes_in_paths)]

#[cfg(any(bench, test))]
use criterion as _;

#[cfg(all(feature = "debug", not(tokio_unstable)))]
use console_subscriber as _;

#[cfg(target = "windows")]
use dunce::canonicalize;
#[cfg(not(target = "windows"))]
use std::fs::canonicalize;

use crate::{
    analytics::QueryAnalyticsSource,
    background::BackgroundExecutor,
    indexes::Indexes,
    remotes::BackendCredential,
    semantic::Semantic,
    state::{Backend, RepositoryPool},
};
use anyhow::{anyhow, bail, Result};
use axum::extract::FromRef;

use dashmap::DashMap;
use once_cell::sync::OnceCell;
use relative_path::RelativePath;
use rudderanalytics::client::RudderAnalytics;

use std::{path::Path, sync::Arc};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

mod analytics;
mod background;
mod collector;
mod config;
mod env;
mod language;
mod remotes;
mod webserver;

pub mod ctags;
pub mod indexes;
pub mod intelligence;
pub mod query;
pub mod semantic;
pub mod snippet;
pub mod state;
pub mod symbol;
pub mod text_range;

pub use config::{default_parallelism, minimum_parallelism, Configuration};
pub use env::Environment;

const LOG_ENV_VAR: &str = "BLOOP_LOG";
static LOGGER_INSTALLED: OnceCell<bool> = OnceCell::new();
static SENTRY_GUARD: OnceCell<sentry::ClientInitGuard> = OnceCell::new();

/// The global state
#[derive(Clone)]
pub struct Application {
    env: Environment, // What's this?
    pub config: Arc<Configuration>,
    repo_pool: RepositoryPool,      // What's this?
    background: BackgroundExecutor, // What's this?
    semantic: Option<Semantic>,     // This could be renamed
    indexes: Arc<Indexes>,
    credentials: Arc<DashMap<Backend, BackendCredential>>, // What's this?
    pub analytics_client: Arc<Option<RudderAnalytics>>,
    cookie_key: axum_extra::extract::cookie::Key, // Is this needed here?
}

impl Application {
    pub async fn initialize(env: Environment, config: Configuration) -> Result<Application> {
        let mut config = match config.config_file {
            None => config,
            Some(ref path) => Configuration::read(path)?,
        };

        config.max_threads = config.max_threads.max(minimum_parallelism()); // Can this be reused in src-tauri/backend.rs?
        let threads = config.max_threads;

        // 3MiB buffer size is minimum for Tantivy
        config.buffer_size = config.buffer_size.max(threads * 3_000_000);
        config.repo_buffer_size = config.repo_buffer_size.max(threads * 3_000_000);
        config.source.set_default_dir(&config.index_dir);

        let config = Arc::new(config);

        // Set path to Ctags binary
        if let Some(ref executable) = config.ctags_path {
            ctags::CTAGS_BINARY
                .set(executable.clone())
                .map_err(|existing| anyhow!("ctags binary already set: {existing:?}"))?;
        }

        // Initialise Semantic index if `qdrant_url` set in config
        let semantic = match config.qdrant_url {
            Some(ref url) => {
                match Semantic::initialize(&config.model_dir, url, Arc::clone(&config)).await {
                    // Why do we pass model_dir AND config?
                    Ok(semantic) => Some(semantic),
                    Err(e) => {
                        bail!("Qdrant initialization failed: {}", e);
                    }
                }
            }
            None => {
                warn!("Semantic search disabled because `qdrant_url` is not provided. Starting without.");
                None
            }
        };

        let analytics_client = if let (Some(key), Some(data_plane)) =
            (&config.analytics_key, &config.analytics_data_plane)
        {
            let key = key.to_string();
            let data_plane = data_plane.to_string();
            info!("Initializing analytics");
            let handle =
                tokio::task::spawn_blocking(move || RudderAnalytics::load(key, data_plane));
            Some(handle.await.unwrap())
        } else {
            warn!("Could not find analytics key ... skipping initialization");
            None
        };
        let analytics_client = Arc::new(analytics_client);

        // If GitHub App ID configured start in private server mode
        let env = if config.github_app_id.is_some() {
            info!("Starting bleep in private server mode");
            Environment::private_server()
        } else {
            env
        };

        Ok(Self {
            indexes: Arc::new(Indexes::new(config.clone(), semantic.clone())?),
            credentials: Arc::new(config.source.initialize_credentials()?),
            background: BackgroundExecutor::start(config.clone()),
            repo_pool: config.source.initialize_pool()?,
            cookie_key: config.source.initialize_cookie_key()?,
            semantic,
            config,
            analytics_client,
            env,
        })
    }

    pub fn initialize_sentry(&self) {
        let Some(ref dsn) = self.config.sentry_dsn else {
            info!("Sentry DSN missing, skipping initialization");
            return;
        };

        if sentry::Hub::current().client().is_some() {
            warn!("Sentry has already been initialized");
            return;
        }

        info!("Initializing sentry ...");
        let guard = sentry::init((
            dsn.to_string(),
            sentry::ClientOptions {
                release: sentry::release_name!(),
                ..Default::default()
            },
        ));

        _ = SENTRY_GUARD.set(guard);
    }

    pub fn install_logging() {
        if let Some(true) = LOGGER_INSTALLED.get() {
            return;
        }

        if !tracing_subscribe() {
            warn!("Failed to install tracing_subscriber. There's probably one already...");
        };

        if color_eyre::install().is_err() {
            warn!("Failed to install color-eyre. Oh well...");
        };

        LOGGER_INSTALLED.set(true).unwrap();
    }

    pub fn track_query(&self, event: &analytics::QueryEvent) {
        if let Some(client) = &*self.analytics_client {
            tokio::task::block_in_place(|| client.track_query(event.clone()));
        }
    }

    pub async fn run(self) -> Result<()> {
        Self::install_logging();

        let mut joins = tokio::task::JoinSet::new();

        if self.config.index_only {
            joins.spawn(self.write_index().startup_scan());
        } else {
            if !self.config.disable_background {
                tokio::spawn(remotes::check_credentials(self.clone()));
                tokio::spawn(remotes::check_repo_updates(self.clone()));
            }

            joins.spawn(webserver::start(self));
        }

        while let Some(result) = joins.join_next().await {
            if let Ok(Err(err)) = result {
                error!(?err, "bleep failure");
                return Err(err);
            }
        }

        Ok(())
    }

    pub(crate) fn allow_path(&self, path: impl AsRef<Path>) -> bool {
        if self.env.allow(env::Feature::AnyPathScan) {
            return true;
        }

        if self.env.allow(env::Feature::SafePathScan) {
            let source_dir = self.config.source.directory();
            return RelativePath::from_path(&path)
                .map(|p| p.to_logical_path(&source_dir))
                .unwrap_or_else(|_| path.as_ref().to_owned())
                .starts_with(&source_dir);
        }

        false
    }

    //
    //
    // Repo actions
    // To be performed on the background executor
    //
    //
    pub(crate) fn write_index(&self) -> background::IndexWriter {
        background::IndexWriter(self.clone())
    }
}

impl FromRef<Application> for axum_extra::extract::cookie::Key {
    fn from_ref(input: &Application) -> Self {
        input.cookie_key.clone()
    }
}

#[cfg(all(tokio_unstable, feature = "debug"))]
fn tracing_subscribe() -> bool {
    use tracing_subscriber::{fmt, prelude::*};
    let env_filter = fmt::layer().with_filter(EnvFilter::from_env(LOG_ENV_VAR));
    tracing_subscriber::registry()
        .with(env_filter)
        .with(console_subscriber::spawn())
        .try_init()
        .is_ok()
}

#[cfg(not(all(tokio_unstable, feature = "debug")))]
fn tracing_subscribe() -> bool {
    use tracing_subscriber::{fmt, prelude::*};
    let env_filter = fmt::layer().with_filter(EnvFilter::from_env(LOG_ENV_VAR));
    tracing_subscriber::registry()
        .with(env_filter)
        .try_init()
        .is_ok()
}
