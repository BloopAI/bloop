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

use secrecy::{ExposeSecret, SecretString};
use state::PersistedState;
use std::{fs::canonicalize, sync::RwLock};
use user::UserProfile;

use crate::{
    background::SyncQueue, indexes::Indexes, remotes::CognitoGithubTokenBundle, semantic::Semantic,
    state::RepositoryPool,
};
use anyhow::{bail, Context, Result};
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

mod agent;
mod background;
mod cache;
mod collector;
mod commits;
mod config;
mod db;
mod env;
mod llm_gateway;
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
    semantic: Semantic,

    /// Tantivy indexes
    indexes: Arc<Indexes>,

    /// Remote backend credentials
    credentials: PersistedState<remotes::Backends>,

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

        // Finalize config
        let config = Arc::new(config);
        debug!(?config, "effective configuration");

        // Load repositories
        let repo_pool = config.source.initialize_pool()?;

        // Databases & indexes
        let sql = Arc::new(db::init(&config).await?);
        let semantic =
            Semantic::initialize(&config.model_dir, &config.qdrant_url, Arc::clone(&config))
                .await
                .context("qdrant initialization failed")?;

        // Wipe existing dbs & caches if the schema has changed
        if config.source.index_version_mismatch() {
            Indexes::reset_databases(&config).await?;
            cache::FileCache::new(sql.clone(), semantic.clone())
                .reset(&repo_pool)
                .await?;

            semantic.reset_collection_blocking().await?;
        }
        config.source.save_index_version()?;

        let indexes = Indexes::new(&config).await?.into();

        // Enforce capabilies and features depending on environment
        let env = if config.bloop_instance_secret.is_some() {
            info!("Starting bleep in private server mode");
            Environment::private_server()
        } else {
            env
        };

        // Analytics backend
        let analytics = match initialize_analytics(&config, tracking_seed, analytics_options) {
            Ok(analytics) => Some(analytics),
            Err(err) => {
                warn!(?err, "failed to initialize analytics");
                None
            }
        };

        Ok(Self {
            sync_queue: SyncQueue::start(config.clone()),
            cookie_key: config.source.initialize_cookie_key()?,
            credentials: config
                .source
                .load_state_or("credentials", remotes::Backends::default())?,
            user_profiles: config.source.load_or_default("user_profiles")?,
            sql,
            indexes,
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

                if !self.env.is_cloud_instance() {
                    tokio::spawn(periodic::clear_disk_logs(self.clone()));
                }
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

    fn track_studio(&self, user: &webserver::middleware::User, event: analytics::StudioEvent) {
        if let Some(analytics) = self.analytics.as_ref() {
            analytics.track_studio(user, event);
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

    fn answer_api_token(&self) -> Result<Option<SecretString>> {
        Ok(if self.env.allow(env::Feature::DesktopUserAuth) {
            let Some(cred) = self.credentials.github() else {
                bail!("missing Github token");
            };

            use remotes::github::{Auth, State};
            match cred {
                State {
                    auth:
                        Auth::OAuth(CognitoGithubTokenBundle {
                            access_token: token,
                            ..
                        }),
                    ..
                } => Some(token.into()),

                _ => {
                    bail!("cannot connect to answer API");
                }
            }
        } else {
            None
        })
    }

    fn llm_gateway_client(&self) -> Result<llm_gateway::Client> {
        let answer_api_token = self.answer_api_token()?.map(|s| s.expose_secret().clone());

        Ok(llm_gateway::Client::new(&self.config.answer_api_url).bearer(answer_api_token))
    }

    fn seal_auth_state(&self, payload: serde_json::Value) -> String {
        use base64::Engine;
        use rand::RngCore;

        let privkey = {
            let bytes = self
                .config
                .bloop_instance_secret
                .as_ref()
                .expect("no instance secret configured")
                .as_bytes();

            ring::aead::LessSafeKey::new(
                ring::aead::UnboundKey::new(&ring::aead::AES_128_GCM, bytes)
                    .expect("bad key initialization"),
            )
        };

        let (nonce, nonce_str) = {
            let mut buf = [0; 12];
            rand::thread_rng().fill_bytes(&mut buf);

            let nonce_str = hex::encode(buf);
            (ring::aead::Nonce::assume_unique_for_key(buf), nonce_str)
        };

        let (enc, tag) = {
            let mut serialized = serde_json::to_vec(&payload).unwrap();
            let tag = privkey
                .seal_in_place_separate_tag(nonce, ring::aead::Aad::empty(), &mut serialized)
                .expect("encryption failed");

            (
                base64::engine::general_purpose::URL_SAFE.encode(serialized),
                base64::engine::general_purpose::URL_SAFE.encode(tag),
            )
        };

        base64::engine::general_purpose::URL_SAFE.encode(
            serde_json::to_vec(&serde_json::json!({
            "org": self.config.bloop_instance_org.as_ref().expect("bad config"),
            "n": nonce_str,
            "enc": enc,
            "tag": tag
            }))
            .expect("bad encoding"),
        )
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
        enable_telemetry: Arc::new(RwLock::new(true)),
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
