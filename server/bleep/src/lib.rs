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

use axum::extract::FromRef;
#[cfg(any(bench, test))]
use criterion as _;

#[cfg(all(feature = "debug", not(tokio_unstable)))]
use console_subscriber as _;
use dashmap::DashMap;
use remotes::BackendCredential;
use semantic::{chunk::OverlapStrategy, Semantic};
use state::Backend;

use crate::{
    indexes::Indexes,
    segment::Segment,
    semantic::SemanticError,
    state::{RepositoryPool, StateSource},
};
use anyhow::{anyhow, bail, Result};
use background::BackgroundExecutor;
use clap::Parser;
use once_cell::sync::OnceCell;
use relative_path::RelativePath;
use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use std::{
    path::{Path, PathBuf},
    sync::Arc,
};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

#[cfg(target = "windows")]
use dunce::canonicalize;
#[cfg(not(target = "windows"))]
use std::fs::canonicalize;

mod background;
mod collector;
mod language;
mod remotes;
mod segment;
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

const LOG_ENV_VAR: &str = "BLOOP_LOG";
static LOGGER_INSTALLED: OnceCell<bool> = OnceCell::new();
static SENTRY_GUARD: OnceCell<sentry::ClientInitGuard> = OnceCell::new();

fn default_index_path() -> PathBuf {
    match directories::ProjectDirs::from("ai", "bloop", "bleep") {
        Some(dirs) => dirs.cache_dir().to_owned(),
        None => "bloop_index".into(),
    }
}

fn default_model_dir() -> PathBuf {
    "model".into()
}

pub fn default_parallelism() -> usize {
    std::thread::available_parallelism().unwrap().get()
}

pub const fn minimum_parallelism() -> usize {
    1
}

const fn default_buffer_size() -> usize {
    100_000_000
}

const fn default_repo_buffer_size() -> usize {
    30_000_000
}

const fn default_port() -> u16 {
    7878
}

fn default_host() -> String {
    String::from("127.0.0.1")
}

fn default_qdrant_url() -> String {
    String::from("http://127.0.0.1:6334")
}

fn default_answer_api_url() -> String {
    String::from("http://127.0.0.1:7879")
}

fn default_max_chunk_tokens() -> usize {
    256
}

#[derive(Debug, Clone)]
pub enum Environment {
    /// Safe API that's suitable for public use
    Server,
    /// Access to the API is access controlled using an OAuth provider
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

#[derive(Deserialize, Parser, Debug)]
#[clap(author, version, about, long_about = None)]
pub struct Configuration {
    #[clap(short, long)]
    #[serde(skip)]
    /// If a config file is given, it will override _all_ command line parameters!
    pub config_file: Option<PathBuf>,

    #[serde(default)]
    pub ctags_path: Option<PathBuf>,

    #[clap(flatten)]
    #[serde(default)]
    pub source: StateSource,

    #[clap(short, long, default_value_os_t = default_index_path())]
    #[serde(default = "default_index_path")]
    /// Directory to store indexes
    pub index_dir: PathBuf,

    #[clap(long, default_value_t = false)]
    #[serde(skip)]
    /// Quit after indexing the specified repos
    pub index_only: bool,

    #[clap(long, default_value_t = false)]
    #[serde(default)]
    /// Disable periodic reindexing, and `git pull` on remote repositories.
    pub disable_background: bool,

    #[clap(long, default_value_t = false)]
    #[serde(default)]
    /// Disable system-native notification backends to detect new git commits immediately.
    pub disable_fsevents: bool,

    #[clap(short, long, default_value_t = default_buffer_size())]
    #[serde(default = "default_buffer_size")]
    /// Size of memory to use for file indexes
    pub buffer_size: usize,

    #[clap(short, long, default_value_t = default_repo_buffer_size())]
    #[serde(default = "default_repo_buffer_size")]
    /// Size of memory to use for repo indexes
    pub repo_buffer_size: usize,

    #[clap(short, long, default_value_t = default_parallelism())]
    #[serde(default = "minimum_parallelism")]
    /// Maximum number of parallel background threads
    pub max_threads: usize,

    #[clap(long, default_value_t = default_host())]
    #[serde(default = "default_host")]
    /// Bind the webserver to `<port>`
    pub host: String,

    #[clap(long, default_value_t = default_port())]
    #[serde(default = "default_port")]
    /// Bind the webserver to `<host>`
    pub port: u16,

    #[clap(long, default_value_os_t = default_model_dir())]
    #[serde(default = "default_model_dir")]
    /// Path to the embedding model directory
    pub model_dir: PathBuf,

    #[clap(long)]
    #[serde(serialize_with = "state::serialize_secret_opt_str", default)]
    /// Github Client ID for OAuth connection to private repos
    pub github_client_id: Option<SecretString>,

    #[clap(long)]
    #[serde(serialize_with = "State::serialize_secret_opt_str", default)]
    pub github_client_secret: Option<SecretString>,

    #[clap(long)]
    /// GitHub App ID
    pub github_app_id: Option<u64>,

    #[clap(long)]
    /// GitHub app installation ID
    pub github_app_install_id: Option<u64>,

    #[clap(long)]
    /// Path to a GitHub private key file, for signing access token requests
    pub github_app_private_key: Option<PathBuf>,

    #[clap(long)]
    /// Full instance domain, e.g. `foo.bloop.ai`
    pub instance_domain: Option<String>,

    #[clap(long, default_value_t = default_max_chunk_tokens())]
    #[serde(default = "default_max_chunk_tokens")]
    /// Maximum number of tokens in a chunk (should be the model's input size)
    pub max_chunk_tokens: usize,

    #[clap(long)]
    /// Chunking strategy
    pub overlap: Option<OverlapStrategy>,

    /// Path to built front-end folder
    #[clap(long)]
    pub frontend_dist: Option<PathBuf>,

    //
    // External dependencies
    //
    #[clap(long, default_value_t = default_qdrant_url())]
    #[serde(default = "default_qdrant_url")]
    /// URL for the qdrant server
    pub qdrant_url: String,

    #[clap(long, default_value_t = default_answer_api_url())]
    #[serde(default = "default_answer_api_url")]
    /// URL for the answer-api
    pub answer_api_url: String,
}

impl Configuration {
    pub fn read(file: impl AsRef<Path>) -> Result<Self> {
        let file = std::fs::File::open(file)?;
        Ok(serde_json::from_reader::<_, Self>(file)?)
    }

    pub fn from_cli() -> Result<Self> {
        Ok(Self::try_parse()?)
    }

    pub fn index_path(&self, name: impl AsRef<Path>) -> impl AsRef<Path> {
        self.index_dir.join(name)
    }

    pub fn github_client_id_and_secret(&self) -> Option<(&str, &str)> {
        let id = self.github_client_id.as_ref()?.expose_secret();
        let secret = self.github_client_secret.as_ref()?.expose_secret();
        Some((id, secret))
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
    pub segment: Arc<Option<Segment>>,
    cookie_key: axum_extra::extract::cookie::Key,
}

impl Application {
    pub async fn initialize(env: Environment, config: Configuration) -> Result<Application> {
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

        let segment = if let Ok(segment_key) = std::env::var("SEGMENT_KEY_BE") {
            info!("initializing segment");
            Some(Segment::new(segment_key))
        } else {
            warn!("could not find segment key ... skipping initialization");
            None
        };
        let segment = Arc::new(segment);

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
            segment,
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
