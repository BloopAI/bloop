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
    semantic::SemanticError,
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

const LOG_ENV_VAR: &str = "BLOOP_LOG";
static LOGGER_INSTALLED: OnceCell<bool> = OnceCell::new();
static SENTRY_GUARD: OnceCell<sentry::ClientInitGuard> = OnceCell::new();

#[derive(Debug, Clone)]
pub enum Environment {
    /// Safe API that's suitable for public use
    Server,
    /// Use a GitHub App installation to manage repositories and user access.
    ///
    /// Running the server in this environment makes use of a GitHub App in order to list and fetch
    /// repositories. Note that GitHub App installs for a user profile are not valid in this mode.
    ///
    /// Connecting properly to a GitHub App installation requires the following flags:
    ///
    /// - `--github-client-id`
    /// - `--github-client-secret`
    /// - `--github-app-id`
    /// - `--github-app-private-key`
    /// - `--github-app-install-id`
    /// - `--instance-domain`
    ///
    /// In order to serve the front-end, the `--frontend-dist` flag can provide a path to a built
    /// version of the Bloop client SPA.
    ///
    /// Users are authenticated by checking whether they belong to the organization which installed
    /// the GitHub App. All users belonging to the organization are able to see all repos that the
    /// installation was allowed to access.
    PrivateServer,
    /// Enables scanning arbitrary user-specified locations through a Web-endpoint.
    InsecureLocal,
}

impl Environment {
    pub(crate) fn allow_path_scan(&self) -> bool {
        use Environment::*;

        matches!(self, InsecureLocal)
    }

    pub(crate) fn allow_github_device_flow(&self) -> bool {
        use Environment::*;
        match self {
            Server => true,
            InsecureLocal => true,
            PrivateServer => false,
        }
    }
}

#[derive(Clone)]
pub struct Application {
    pub env: Environment,
    pub config: Arc<Configuration>,
    repo_pool: RepositoryPool,
    background: BackgroundExecutor,
    semantic: Option<Semantic>,
    indexes: Arc<Indexes>,
    credentials: Arc<DashMap<Backend, BackendCredential>>,
    pub analytics_client: Arc<Option<RudderAnalytics>>,
    cookie_key: axum_extra::extract::cookie::Key,
}

impl Application {
    pub async fn initialize(env: Environment, config: Configuration) -> Result<Application> {
        Application::load_env_vars();
        let mut config = match config.config_file {
            None => config,
            Some(ref path) => {
                let file = std::fs::File::open(path)?;
                serde_json::from_reader::<_, Configuration>(file)?
            }
        };

        config.max_threads = config.max_threads.max(minimum_parallelism());
        let threads = config.max_threads;

        // 3MiB buffer size is minimum for Tantivy
        config.buffer_size = config.buffer_size.max(threads * 3_000_000);
        config.repo_buffer_size = config.repo_buffer_size.max(threads * 3_000_000);
        config.source.set_default_dir(&config.index_dir);

        if let Some(ref executable) = config.ctags_path {
            ctags::CTAGS_BINARY
                .set(executable.clone())
                .map_err(|existing| anyhow!("ctags binary already set: {existing:?}"))?;
        }

        let config = Arc::new(config);
        let semantic =
            match Semantic::new(&config.model_dir, &config.qdrant_url, Arc::clone(&config)).await {
                Ok(semantic) => Some(semantic),
                Err(SemanticError::QdrantInitializationError) => {
                    warn!("Qdrant initialization failed. Starting without semantic search...");
                    None
                }
                Err(e) => bail!(e),
            };

        let analytics_client = if let (Ok(key), Ok(data_plane)) = (
            std::env::var("ANALYTICS_KEY_BE"),
            std::env::var("ANALYTICS_DATA_PLANE"),
        ) {
            info!("initializing analytics");
            let handle = tokio::task::spawn_blocking(|| RudderAnalytics::load(key, data_plane));
            Some(handle.await.unwrap())
        } else {
            warn!("could not find analytics key ... skipping initialization");
            None
        };
        let analytics_client = Arc::new(analytics_client);

        let indexes = Arc::new(Indexes::new(config.clone(), semantic.clone())?);
        let env = if config.github_app_id.is_some() {
            Environment::PrivateServer
        } else {
            env
        };

        Ok(Self {
            indexes,
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

    pub fn load_env_vars() {
        info!("loading .env file ...");
        if let Ok(path) = dotenvy::dotenv() {
            info!(
                "loaded env from `{:?}`",
                canonicalize(path).ok().as_ref().map(|p| p.display())
            );
        } else {
            warn!("failed to load .env file")
        };
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

    pub fn install_sentry() {
        let Some(dsn) = std::env::var("VITE_SENTRY_DSN_BE").ok() else {
            info!("sentry DSN missing, skipping initialization");
            return;
        };

        if sentry::Hub::current().client().is_some() {
            warn!("sentry has already been initialized");
            return;
        }

        info!("initializing sentry ...");
        let guard = sentry::init((
            dsn,
            sentry::ClientOptions {
                release: sentry::release_name!(),
                ..Default::default()
            },
        ));

        _ = SENTRY_GUARD.set(guard);
    }

    pub fn track_query(&self, event: analytics::QueryEvent) {
        if let Some(client) = &*self.analytics_client {
            tokio::task::block_in_place(|| client.track_query(event));
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
        use Environment::*;

        let source_dir = self.config.source.directory();
        match self.env {
            Server => RelativePath::from_path(&path)
                .map(|p| p.to_logical_path(&source_dir))
                .unwrap_or_else(|_| path.as_ref().to_owned())
                .starts_with(&source_dir),
            PrivateServer => false,
            InsecureLocal => true,
        }
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

// FIXME: use usize::div_ceil soon
fn div_ceil(a: usize, b: usize) -> usize {
    let d = a / b;
    let r = a % b;
    d + usize::from(r > 0)
}
