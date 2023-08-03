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
#![allow(elided_lifetimes_in_paths)]

#[cfg(any(bench, test))]
use criterion as _;

use db::SqlDb;
#[cfg(any(bench, test))]
use git_version as _;

#[cfg(all(feature = "debug", not(tokio_unstable)))]
use console_subscriber as _;

use secrecy::SecretString;
use state::PersistedState;
use std::fs::canonicalize;
use user::UserProfile;

use crate::{background::SyncQueue, indexes::Indexes, semantic::Semantic, state::RepositoryPool};
use anyhow::{bail, Result};
use axum::extract::FromRef;

use once_cell::sync::OnceCell;

use sentry_tracing::{EventFilter, SentryLayer};
use std::{path::Path, sync::Arc};
use tracing::{debug, error, info, warn, Level};
use tracing_subscriber::{
    filter::{LevelFilter, Targets},
    fmt,
    prelude::*,
    EnvFilter,
};

mod background;
mod cache;
mod collector;
mod config;
mod db;
mod env;
mod remotes;
mod repo;
mod webserver;

#[cfg(feature = "ee")]
mod ee;

pub mod analytics;
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
static SENTRY_GUARD: OnceCell<sentry::ClientInitGuard> = OnceCell::new();
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
    semantic: Option<Semantic>,

    /// Tantivy indexes
    indexes: Arc<Indexes>,

    /// Remote backend credentials
    credentials: remotes::Backends,

    /// Main cookie encryption keypair
    cookie_key: axum_extra::extract::cookie::Key,

    /// Store for user profiles
    user_profiles: PersistedState<scc::HashMap<String, UserProfile>>,

    /// SQL database for persistent storage
    pub sql: SqlDb,

    /// Analytics backend -- may be unintialized
    pub analytics: Option<Arc<analytics::RudderHub>>,
}

impl Application {
    pub async fn initialize(
        env: Environment,
        mut config: Configuration,
        tracking_seed: impl Into<Option<String>>,
        analytics_options: impl Into<Option<analytics::HubOptions>>,
    ) -> Result<Application> {
        config.max_threads = config.max_threads.max(minimum_parallelism());
        let threads = config.max_threads;

        // 3MiB buffer size is minimum for Tantivy
        config.buffer_size = config.buffer_size.max(threads * 3_000_000);
        config.repo_buffer_size = config.repo_buffer_size.max(threads * 3_000_000);
        config.source.set_default_dir(&config.index_dir);

        let config = Arc::new(config);
        debug!(?config, "effective configuration");

        let sqlite = Arc::new(db::init(&config).await?);

        // Initialise Semantic index if `qdrant_url` set in config
        let semantic = match config.qdrant_url {
            Some(ref url) => {
                match Semantic::initialize(&config.model_dir, url, Arc::clone(&config)).await {
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

        let env = if config.github_app_id.is_some() {
            info!("Starting bleep in private server mode");
            Environment::private_server()
        } else {
            env
        };

        let analytics = match initialize_analytics(&config, tracking_seed, analytics_options) {
            Ok(analytics) => Some(analytics),
            Err(err) => {
                warn!(?err, "failed to initialize analytics");
                None
            }
        };

        let repo_pool = config.source.initialize_pool()?;

        Ok(Self {
            indexes: Indexes::new(
                repo_pool.clone(),
                config.clone(),
                sqlite.clone(),
                semantic.clone(),
            )
            .await?
            .into(),
            sync_queue: SyncQueue::start(config.clone()),
            cookie_key: config.source.initialize_cookie_key()?,
            credentials: config.source.initialize_credentials()?.into(),
            user_profiles: config.source.load_or_default("user_profiles")?,
            sql: sqlite,
            repo_pool,
            analytics,
            semantic,
            config,
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

        sentry::configure_scope(|scope| {
            scope.add_event_processor(|event| {
                let Some(ref logger) = event.logger
		else {
		    return Some(event);
		};

                match logger.as_ref() {
                    "tower_http::catch_panic" => None,
                    _ => Some(event),
                }
            });
        });

        _ = SENTRY_GUARD.set(guard);
    }

    pub fn install_logging(config: &Configuration) {
        if let Some(true) = LOGGER_INSTALLED.get() {
            return;
        }

        if !tracing_subscribe(config) {
            warn!("Failed to install tracing_subscriber. There's probably one already...");
        };

        if color_eyre::install().is_err() {
            warn!("Failed to install color-eyre. Oh well...");
        };

        LOGGER_INSTALLED.set(true).unwrap();
    }

    pub fn user(&self) -> Option<String> {
        self.credentials.user()
    }

    pub async fn run(self) -> Result<()> {
        Self::install_logging(&self.config);

        let mut joins = tokio::task::JoinSet::new();

        if self.config.index_only {
            joins.spawn(self.write_index().startup_scan());
        } else {
            if !self.config.disable_background {
                tokio::spawn(periodic::sync_github_status(self.clone()));
                tokio::spawn(periodic::check_repo_updates(self.clone()));
                tokio::spawn(periodic::log_and_branch_rotate(self.clone()));
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

    fn track_query(&self, user: &webserver::middleware::User, event: &analytics::QueryEvent) {
        if let Some(analytics) = self.analytics.as_ref() {
            analytics.track_query(user, event.clone());
        }
    }

    /// Run a closure over the current `analytics` instance, if it exists.
    fn with_analytics<R>(&self, f: impl FnOnce(&Arc<analytics::RudderHub>) -> R) -> Option<R> {
        self.analytics.as_ref().map(f)
    }

    fn org_name(&self) -> Option<String> {
        self.credentials
            .github()
            .and_then(|state| match state.auth {
                remotes::github::Auth::App { org, .. } => Some(org),
                _ => None,
            })
    }

    fn write_index(&self) -> background::BoundSyncQueue {
        self.sync_queue.bind(self.clone())
    }

    fn github_token(&self) -> Result<Option<SecretString>> {
        Ok(if self.env.allow(env::Feature::GithubDeviceFlow) {
            let Some(cred) = self.credentials.github() else {
                bail!("missing Github token");
            };

            use remotes::github::{Auth, State};
            match cred {
                State {
                    auth:
                        Auth::OAuth {
                            access_token: token,
                            ..
                        },
                    ..
                } => Some(token),

                State {
                    auth: Auth::App { .. },
                    ..
                } => {
                    bail!("cannot connect to answer API using installation token");
                }
            }
        } else {
            None
        })
    }
}

impl FromRef<Application> for axum_extra::extract::cookie::Key {
    fn from_ref(input: &Application) -> Self {
        input.cookie_key.clone()
    }
}

fn tracing_subscribe(config: &Configuration) -> bool {
    let env_filter_layer = fmt::layer().with_filter(EnvFilter::from_env(LOG_ENV_VAR));
    let sentry_layer = sentry_layer();
    let log_writer_layer = (!config.disable_log_write).then(|| {
        let log_dir = config.index_dir.join("logs");
        let file_appender = tracing_appender::rolling::daily(log_dir, "bloop.log");
        let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
        _ = LOGGER_GUARD.set(guard);
        fmt::layer()
            .with_writer(non_blocking)
            .with_ansi(false)
            .with_filter(
                Targets::new()
                    .with_target("bleep", LevelFilter::DEBUG)
                    .with_target("bleep::indexes::file", LevelFilter::WARN)
                    .with_target("bleep::semantic", LevelFilter::WARN),
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
        .with(sentry_layer)
        .with(console_subscriber_layer)
        .try_init()
        .is_ok()
}

/// Create a new sentry layer that captures `debug!`, `info!`, `warn!`, and `error!` messages.
fn sentry_layer<S>() -> SentryLayer<S>
where
    S: tracing::Subscriber,
    S: for<'a> tracing_subscriber::registry::LookupSpan<'a>,
{
    SentryLayer::default()
        .span_filter(|meta| {
            matches!(
                *meta.level(),
                Level::DEBUG | Level::INFO | Level::WARN | Level::ERROR
            )
        })
        .event_filter(|meta| match *meta.level() {
            Level::ERROR => EventFilter::Exception,
            Level::DEBUG | Level::INFO | Level::WARN => EventFilter::Breadcrumb,
            Level::TRACE => EventFilter::Ignore,
        })
}

fn initialize_analytics(
    config: &Configuration,
    tracking_seed: impl Into<Option<String>>,
    options: impl Into<Option<analytics::HubOptions>>,
) -> Result<Arc<analytics::RudderHub>> {
    let Some(key) = &config.analytics_key else {
            bail!("analytics key missing; skipping initialization");
        };

    let Some(data_plane) = &config.analytics_data_plane else {
            bail!("analytics data plane url missing; skipping initialization");
        };

    let options = options.into().unwrap_or_else(|| analytics::HubOptions {
        event_filter: Some(Arc::new(Some)),
        package_metadata: Some(analytics::PackageMetadata {
            name: env!("CARGO_CRATE_NAME"),
            version: env!("CARGO_PKG_VERSION"),
            git_rev: git_version::git_version!(fallback = "unknown"),
        }),
    });

    info!("configuring analytics ...");
    tokio::task::block_in_place(|| {
        analytics::RudderHub::new_with_options(
            &config.source,
            tracking_seed,
            key.clone(),
            data_plane.clone(),
            options,
        )
    })
}
