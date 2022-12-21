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
use semantic::Semantic;

use crate::{
    indexes::Indexes,
    state::{Credentials, RepositoryPool, StateSource},
};
use anyhow::{anyhow, Result};
use background::BackgroundExecutor;
use clap::Parser;
use once_cell::sync::OnceCell;
use relative_path::RelativePath;
use secrecy::SecretString;
use serde::{Deserialize, Serialize};
use std::{
    ops::Not,
    path::{Path, PathBuf},
    sync::Arc,
};
use tracing::{error, warn};
use tracing_subscriber::EnvFilter;

mod background;
mod collector;
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

const LOG_ENV_VAR: &str = "BLOOP_LOG";
static LOGGER_INSTALLED: OnceCell<bool> = OnceCell::new();

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

fn default_qdrant() -> String {
    String::from("http://127.0.0.1:6334")
}

fn default_answer_api_base() -> String {
    String::from("kw50d42q6a.execute-api.eu-west-1.amazonaws.com/default")
}

#[derive(Debug)]
pub enum Environment {
    /// Safe API that's suitable for public use
    Server,
    /// Enables scanning arbitrary user-specified locations through a Web-endpoint.
    InsecureLocal,
}

impl Default for Environment {
    fn default() -> Self {
        Environment::Server
    }
}

#[derive(Serialize, Deserialize, Parser, Debug)]
#[clap(author, version, about, long_about = None)]
pub struct Configuration {
    #[clap(skip)]
    #[serde(skip)]
    pub(crate) env: Environment,

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

    #[clap(long, default_value_t = default_qdrant())]
    #[serde(default = "default_qdrant")]
    /// URL for the qdrant server
    pub qdrant_url: String,

    #[clap(long, default_value_os_t = default_model_dir())]
    #[serde(default = "default_model_dir")]
    /// URL for the qdrant server
    pub model_dir: PathBuf,

    #[clap(long, default_value_t = default_host())]
    #[serde(default = "default_host")]
    /// Bind the webserver to `<port>`
    pub host: String,

    #[clap(long, default_value_t = default_port())]
    #[serde(default = "default_port")]
    /// Bind the webserver to `<host>`
    pub port: u16,

    #[clap(long)]
    #[serde(serialize_with = "state::serialize_secret_opt_str", default)]
    /// Github Client ID for OAuth connection to private repos
    pub github_client_id: Option<SecretString>,

    #[clap(long, default_value_t = default_answer_api_host())]
    #[serde(default = "default_answer_api_host")]
    /// Answer API `host` string, with optional `:port`
    pub answer_api_host: String,
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
}

#[derive(Clone)]
pub struct Application {
    pub config: Arc<Configuration>,
    pub(crate) repo_pool: RepositoryPool,
    pub(crate) background: BackgroundExecutor,
    pub(crate) semantic: Semantic,
    indexes: Arc<Indexes>,
    credentials: Credentials,
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
        config.env = env;

        if let Some(ref executable) = config.ctags_path {
            ctags::CTAGS_BINARY
                .set(executable.clone())
                .map_err(|existing| anyhow!("ctags binary already set: {existing:?}"))?;
        }

        let config = Arc::new(config);
        let semantic = Semantic::new(&config.model_dir, &config.qdrant_url).await;

        Ok(Self {
            indexes: Indexes::new(config.clone(), semantic.clone())?.into(),
            repo_pool: config.source.initialize_pool()?,
            credentials: config.source.initialize_credentials()?,
            background: BackgroundExecutor::start(config.clone()),
            semantic,
            config,
        })
    }

    pub fn install_logging() {
        if let Some(true) = LOGGER_INSTALLED.get() {
            return;
        }

        if tracing_subscribe().not() {
            warn!("Failed to install tracing_subscriber. There's probably one already...");
        };

        if color_eyre::install().is_err() {
            warn!("Failed to install color-eyre. Oh well...");
        };

        LOGGER_INSTALLED.set(true).unwrap();
    }

    pub async fn run(self) -> Result<()> {
        Self::install_logging();

        let mut joins = tokio::task::JoinSet::new();

        if self.config.index_only {
            joins.spawn(self.write_index().startup_scan());
        } else {
            if self.config.disable_background.not() {
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

    pub(crate) fn scan_allowed(&self) -> bool {
        use Environment::*;

        match self.config.env {
            Server => false,
            InsecureLocal => true,
        }
    }

    pub(crate) fn path_allowed(&self, path: impl AsRef<Path>) -> bool {
        use Environment::*;

        let source_dir = self.config.source.directory();
        match self.config.env {
            Server => RelativePath::from_path(&path)
                .map(|p| p.to_logical_path(&source_dir))
                .unwrap_or_else(|_| path.as_ref().to_owned())
                .starts_with(&source_dir),
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
