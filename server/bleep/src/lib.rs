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

#[cfg(any(bench, test))]
use git_version as _;

#[cfg(all(feature = "debug", not(tokio_unstable)))]
use console_subscriber as _;

#[cfg(target_os = "windows")]
use dunce::canonicalize;
use scc::hash_map::Entry;
#[cfg(not(target_os = "windows"))]
use std::fs::canonicalize;

use crate::{
    background::BackgroundExecutor, indexes::Indexes, semantic::Semantic, state::RepositoryPool,
};
use anyhow::{bail, Result};
use axum::extract::FromRef;

use once_cell::sync::OnceCell;

use sentry_tracing::{EventFilter, SentryLayer};
use std::{path::Path, sync::Arc};
use tracing::{debug, error, info, warn, Level};
use tracing_subscriber::EnvFilter;

mod background;
mod collector;
mod config;
mod env;
mod remotes;
mod repo;
mod webserver;

pub mod analytics;
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
    /// Environmental restrictions on the app
    env: Environment,

    /// User-provided configuration
    pub config: Arc<Configuration>,

    /// Repositories managed by Bloop
    repo_pool: RepositoryPool,

    /// Background & maintenance tasks are executed on a separate
    /// executor
    background: BackgroundExecutor,

    /// Semantic search subsystem
    semantic: Option<Semantic>,

    /// Tantivy indexes
    indexes: Arc<Indexes>,

    /// Remote backend credentials
    credentials: remotes::Backends,

    /// Main cookie encryption keypair
    cookie_key: axum_extra::extract::cookie::Key,

    /// Conversational store cache
    prior_conversational_store: Arc<scc::HashMap<String, Vec<(String, String)>>>,

    /// Analytics backend -- may be unintialized
    analytics: Option<Arc<analytics::RudderHub>>,
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
            indexes: Indexes::new(repo_pool.clone(), config.clone(), semantic.clone())?.into(),
            background: BackgroundExecutor::start(config.clone()),
            prior_conversational_store: Arc::default(),
            cookie_key: config.source.initialize_cookie_key()?,
            credentials: config.source.initialize_credentials()?.into(),
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

    pub fn track_query(&self, user: &webserver::middleware::User, event: &analytics::QueryEvent) {
        if let Some(analytics) = self.analytics.as_ref() {
            tokio::task::block_in_place(|| analytics.track_query(user, event.clone()))
        }
    }

    pub async fn run(self) -> Result<()> {
        Self::install_logging();

        let mut joins = tokio::task::JoinSet::new();

        if self.config.index_only {
            joins.spawn(self.write_index().startup_scan());
        } else {
            if !self.config.disable_background {
                tokio::spawn(remotes::sync_github_status(self.clone()));
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
            return state::get_relative_path(path.as_ref(), &source_dir).starts_with(&source_dir);
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

    /// This gets the prior conversation. Be sure to drop the borrow before calling
    /// [`add_conversation_entry`], lest we deadlock.
    pub fn with_prior_conversation<T>(
        &self,
        user_id: &str,
        f: impl Fn(&[(String, String)]) -> T,
    ) -> T {
        self.prior_conversational_store
            .read(user_id, |_, v| f(&v[..]))
            .unwrap_or_else(|| f(&[]))
    }

    /// add a new conversation entry to the store
    pub fn add_conversation_entry(&self, user_id: String, query: String) {
        match self.prior_conversational_store.entry(user_id) {
            Entry::Occupied(mut o) => o.get_mut().push((query, String::new())),
            Entry::Vacant(v) => {
                v.insert_entry(vec![(query, String::new())]);
            }
        }
    }

    /// extend the last answer for the session by the given fragment
    pub fn extend_conversation_answer(&self, user_id: String, fragment: &str) {
        if let Entry::Occupied(mut o) = self.prior_conversational_store.entry(user_id) {
            if let Some((_, ref mut answer)) = o.get_mut().last_mut() {
                answer.push_str(fragment);
            } else {
                error!("No answer to add {fragment} to");
            }
        } else {
            error!("We should not answer if there is no question. Fragment {fragment}");
        }
    }

    /// clear the conversation history for a user
    pub fn purge_prior_conversation(&self, user_id: &str) {
        self.prior_conversational_store.remove(user_id);
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
        .with(sentry_layer())
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
        .with(sentry_layer())
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
