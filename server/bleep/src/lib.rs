#![deny(
    clippy::all,
    arithmetic_overflow,
    future_incompatible,
    nonstandard_style,
    rust_2018_idioms,
    unused_lifetimes,
    unused_qualifications
)]
#![warn(unused_crate_dependencies)]
#![allow(elided_lifetimes_in_paths, clippy::diverging_sub_expression)]

#[cfg(all(feature = "onnx", feature = "metal"))]
compile_error!("cannot enable `onnx` and `metal` at the same time");

// only used in the binary
#[cfg(feature = "color-eyre")]
use color_eyre as _;

#[cfg(any(bench, test))]
use criterion as _;

use db::SqlDb;
#[cfg(any(bench, test))]
use git_version as _;

#[cfg(all(feature = "debug", not(tokio_unstable)))]
use console_subscriber as _;

use remotes::github;
use secrecy::ExposeSecret;
use state::PersistedState;
use std::fs::canonicalize;
use user::UserProfile;

use crate::{
    background::SyncQueue, indexes::Indexes, semantic::Semantic, state::RepositoryPool,
    webserver::middleware::User,
};
use anyhow::{Context, Result};

use once_cell::sync::OnceCell;

use std::{path::Path, sync::Arc};
use tracing::{debug, error, info, warn};
use tracing_subscriber::{
    filter::{LevelFilter, Targets},
    fmt,
    prelude::*,
    EnvFilter,
};

mod agent;
mod background;
mod cache;
mod collector;
mod commits;
mod config;
mod db;
mod env;
mod llm;
mod remotes;
mod repo;
mod scraper;
mod webserver;

mod ee;

pub mod indexes;
pub mod intelligence;
pub mod periodic;
pub mod query;
pub mod semantic;
pub mod snippet;
pub mod state;
pub mod symbol;
pub mod text_range;
pub mod user;

pub use config::{default_parallelism, minimum_parallelism, Configuration};
pub use env::Environment;

const LOG_ENV_VAR: &str = "BLOOP_LOG";
static LOGGER_INSTALLED: OnceCell<bool> = OnceCell::new();
static LOGGER_GUARD: OnceCell<tracing_appender::non_blocking::WorkerGuard> = OnceCell::new();

/// The global state
#[derive(Clone)]
pub struct Application {
    /// Environmental restrictions on the app
    env: Environment,

    /// User-provided configuration
    pub config: Arc<Configuration>,

    /// Repositories managed by Bloop
    repo_pool: RepositoryPool,

    /// Background & maintenance tasks are executed on a separate
    /// executor
    sync_queue: SyncQueue,

    /// Semantic search subsystem
    semantic: Semantic,

    /// Tantivy indexes
    indexes: Arc<Indexes>,

    /// Remote backend credentials
    credentials: PersistedState<remotes::Backends>,

    /// Store for user profiles
    user_profiles: PersistedState<scc::HashMap<String, UserProfile>>,

    /// SQL database for persistent storage
    pub sql: SqlDb,
}

impl Application {
    pub async fn initialize(env: Environment, mut config: Configuration) -> Result<Application> {
        debug!("This is where we are");
        config.max_threads = config.max_threads.max(minimum_parallelism());
        let threads = config.max_threads;

        // 15MiB buffer size is minimum for Tantivy
        config.buffer_size = config.buffer_size.max(threads * 15_000_000);
        config.repo_buffer_size = config.repo_buffer_size.max(threads * 15_000_000);
        config.source.set_default_dir(&config.index_dir);

        // Finalize config
        let config = Arc::new(config);
        info!(?config, "effective configuration");

        // Load repositories
        let repo_pool = config.source.initialize_pool()?;

        // Databases & indexes
        let sql = Arc::new(db::initialize(&config).await?);
        let semantic =
            Semantic::initialize(&config.model_dir, &config.qdrant_url, Arc::clone(&config))
                .await
                .context("qdrant initialization failed")?;

        // Wipe existing dbs & caches if the schema has changed
        let mut was_index_reset = false;
        if config.source.index_version_mismatch() {
            debug!("schema version mismatch, resetting state");
            was_index_reset = true;
            Indexes::reset_databases(&config)?;
            debug!("tantivy indexes deleted");

            cache::FileCache::new(sql.clone(), semantic.clone())
                .reset(&repo_pool)
                .await?;
            debug!("caches deleted");

            semantic.reset_collection_blocking().await?;
            debug!("semantic indexes deleted");
            debug!("state reset complete");
        }

        config.source.save_index_version()?;
        debug!("index version saved");

        let indexes = Indexes::new(&config, sql.clone(), was_index_reset)
            .await?
            .into();
        info!("indexes initialized");

        Ok(Self {
            sync_queue: SyncQueue::start(config.clone()),
            credentials: config
                .source
                .load_state_or("credentials", remotes::Backends::default())?,
            user_profiles: config.source.load_or_default("user_profiles")?,
            sql,
            indexes,
            repo_pool,
            semantic,
            config,
            env,
        })
    }

    pub fn install_logging(config: &Configuration) {
        if let Some(true) = LOGGER_INSTALLED.get() {
            return;
        }

        if !tracing_subscribe(config) {
            warn!("Failed to install tracing_subscriber. There's probably one already...");
        };

        let hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            tracing::error!("panic occurred: {info}");
            hook(info);
        }));

        LOGGER_INSTALLED.set(true).unwrap();
    }

    pub async fn run(self) -> Result<()> {
        Self::install_logging(&self.config);

        self.credentials.set_github(github::Auth::new(
            self.config.github_access_token.clone().unwrap(),
        ));
        if let Err(err) = self.credentials.store() {
            error!(?err, "failed to save credentials to disk");
        }

        let mut joins = tokio::task::JoinSet::new();

        if self.config.index_only {
            joins.spawn(self.write_index().startup_scan());
        } else {
            if !self.config.disable_background {
                periodic::start_background_jobs(self.clone());
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

    fn allow_path(&self, path: impl AsRef<Path>) -> bool {
        if self.env.allow(env::Feature::AnyPathScan) {
            return true;
        }

        if self.env.allow(env::Feature::SafePathScan) {
            let source_dir = self.config.source.directory();
            return state::get_relative_path(path.as_ref(), &source_dir).starts_with(&source_dir);
        }

        false
    }

    pub async fn username(&self) -> Option<String> {
        self.credentials.github().unwrap().username().await.ok()
    }

    pub(crate) async fn user(&self) -> User {
        self.username()
            .await
            .zip(self.credentials.github())
            .and_then(|(user, gh)| {
                self.config
                    .github_access_token
                    .as_ref()
                    .map(|token| User::Desktop {
                        access_token: token.expose_secret().clone(),
                        login: user,
                        crab: Arc::new(move || Ok(gh.client()?)),
                    })
            })
            .unwrap_or_else(|| User::Unknown)
    }

    fn write_index(&self) -> background::BoundSyncQueue {
        background::BoundSyncQueue(self.clone())
    }
}

fn tracing_subscribe(config: &Configuration) -> bool {
    let env_filter_layer = fmt::layer().with_filter(EnvFilter::from_env(LOG_ENV_VAR));
    let log_writer_layer = (!config.disable_log_write).then(|| {
        let file_appender = tracing_appender::rolling::daily(config.log_dir(), "bloop.log");
        let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
        _ = LOGGER_GUARD.set(guard);
        fmt::layer()
            .with_writer(non_blocking)
            .with_ansi(false)
            .with_filter(
                Targets::new()
                    .with_target("bleep", LevelFilter::DEBUG)
                    .with_target("bleep::indexes::file", LevelFilter::WARN)
                    .with_target("bleep::semantic", LevelFilter::DEBUG)
                    .with_target("bloop::qdrant", LevelFilter::INFO),
            )
    });

    #[cfg(all(tokio_unstable, feature = "debug"))]
    let console_subscriber_layer = Some(console_subscriber::spawn());
    #[cfg(not(all(tokio_unstable, feature = "debug")))]
    let console_subscriber_layer: Option<Box<dyn tracing_subscriber::Layer<_> + Send + Sync>> =
        None;

    tracing_subscriber::registry()
        .with(log_writer_layer)
        .with(env_filter_layer)
        .with(console_subscriber_layer)
        .try_init()
        .is_ok()
}
