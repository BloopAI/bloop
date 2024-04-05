use crate::state::StateSource;
use anyhow::{Context, Result};
use clap::Parser;

use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize, Serializer};
use std::{
    num::NonZeroUsize,
    path::{Path, PathBuf},
};

#[derive(Serialize, Deserialize, Parser, Debug, Clone)]
#[clap(author, version, about, long_about = None)]
pub struct Configuration {
    //
    // Core configuration options
    //
    #[clap(short, long)]
    #[serde(skip)]
    /// If a config file is given, it will override _all_ command line parameters!
    pub config_file: Option<PathBuf>,

    #[clap(flatten)]
    #[serde(default)]
    pub source: StateSource,

    #[clap(short, long, default_value_os_t = default_index_dir())]
    #[serde(default = "default_index_dir")]
    /// Directory to store all persistent state
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

    #[clap(long, default_value_t = false)]
    #[serde(default)]
    /// Avoid writing logs to files.
    ///
    /// If this flag is not set to `true`, logs are written to <index_dir>/logs/bloop.log.YYYY-MM-DD-HH
    pub disable_log_write: bool,

    #[clap(short, long, default_value_t = default_buffer_size())]
    #[serde(default = "default_buffer_size")]
    /// Size of memory to use for file indexes
    pub buffer_size: usize,

    #[clap(short, long, default_value_t = default_repo_buffer_size())]
    #[serde(default = "default_repo_buffer_size")]
    /// Size of memory to use for repo indexes
    pub repo_buffer_size: usize,

    #[clap(short, long, default_value_t = default_parallelism())]
    #[serde(default = "default_parallelism")]
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

    #[clap(long)]
    #[serde(serialize_with = "serialize_secret_opt_str", default)]
    /// OpenAI API key
    pub openai_api_key: Option<SecretString>,

    #[clap(long)]
    #[serde(serialize_with = "serialize_secret_opt_str", default)]
    /// Github Access Token
    pub github_access_token: Option<SecretString>,

    //
    // External dependencies
    //
    #[clap(long)]
    /// Path to dynamic libraries used in the app.
    pub dylib_dir: Option<PathBuf>,

    //
    // Semantic values
    //
    #[clap(long, default_value_t = default_qdrant_url())]
    #[serde(default = "default_qdrant_url")]
    /// URL for the qdrant server
    pub qdrant_url: String,

    #[clap(long, default_value_os_t = default_model_dir())]
    #[serde(default = "default_model_dir")]
    /// Path to the embedding model directory
    pub model_dir: PathBuf,

    #[clap(long, default_value_t = default_max_chunk_tokens())]
    #[serde(default = "default_max_chunk_tokens")]
    /// Maximum number of tokens in a chunk (should be the model's input size)
    pub max_chunk_tokens: usize,

    #[clap(long, default_value_t = default_collection_name())]
    #[serde(default = "default_collection_name")]
    /// Qdrant collection name. Defaults to `documents`
    pub collection_name: String,

    #[clap(long, default_value_t = interactive_batch_size())]
    #[serde(default = "interactive_batch_size")]
    /// Batch size for batched embeddings
    pub embedding_batch_size: NonZeroUsize,

    /// Path to built front-end folder
    #[clap(long)]
    pub frontend_dist: Option<PathBuf>,
}

macro_rules! right_if_default {
    ($left:expr, $right:expr, $default:expr) => {
        if $left == $default {
            $right
        } else {
            $left
        }
    };
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

    pub fn cli_overriding_config_file() -> Result<Self> {
        let cli = Self::from_cli()?;
        let Ok(file) = cli
            .config_file
            .as_ref()
            .context("no config file specified")
            .and_then(Self::read)
        else {
            return Ok(cli);
        };

        Ok(Self::merge(file, cli))
    }

    /// Merge 2 configurations with values from `b` taking precedence
    ///
    /// In case a default value is recognized in *either* sides,
    /// always the non-default value will be used for the resulting
    /// configuration.
    pub fn merge(a: Self, b: Self) -> Self {
        // the values here are in the order they're listed in the
        // original `Configuration` declaration
        Self {
            config_file: b.config_file.or(a.config_file),

            source: right_if_default!(b.source, a.source, Default::default()),

            index_dir: right_if_default!(b.index_dir, a.index_dir, default_index_dir()),

            index_only: b.index_only | a.index_only,

            disable_background: b.disable_background | a.disable_background,

            disable_fsevents: b.disable_fsevents | a.disable_fsevents,

            disable_log_write: b.disable_log_write | a.disable_log_write,

            buffer_size: right_if_default!(b.buffer_size, a.buffer_size, default_buffer_size()),

            repo_buffer_size: right_if_default!(
                b.repo_buffer_size,
                a.repo_buffer_size,
                default_repo_buffer_size()
            ),

            max_threads: right_if_default!(b.max_threads, a.max_threads, default_parallelism()),

            host: right_if_default!(b.host, a.host, default_host()),

            port: right_if_default!(b.port, a.port, default_port()),

            openai_api_key: b.openai_api_key.or(a.openai_api_key),

            github_access_token: b.github_access_token.or(a.github_access_token),

            model_dir: right_if_default!(b.model_dir, a.model_dir, default_model_dir()),

            max_chunk_tokens: right_if_default!(
                b.max_chunk_tokens,
                a.max_chunk_tokens,
                default_max_chunk_tokens()
            ),

            collection_name: right_if_default!(
                b.collection_name,
                a.collection_name,
                default_collection_name()
            ),

            embedding_batch_size: right_if_default!(
                b.embedding_batch_size,
                a.embedding_batch_size,
                interactive_batch_size()
            ),

            frontend_dist: b.frontend_dist.or(a.frontend_dist),

            qdrant_url: right_if_default!(b.qdrant_url, a.qdrant_url, String::new()),

            dylib_dir: b.dylib_dir.or(a.dylib_dir),
        }
    }

    /// Directory where logs are written to
    pub fn log_dir(&self) -> PathBuf {
        self.index_dir.join("logs")
    }
}

pub fn serialize_secret_opt_str<S>(
    opt_secstr: &Option<SecretString>,
    ser: S,
) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    match opt_secstr {
        Some(secstr) => ser.serialize_some(secstr.expose_secret()),
        None => ser.serialize_none(),
    }
}

pub fn serialize_secret_str<S>(secstr: &SecretString, ser: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    ser.serialize_str(secstr.expose_secret())
}

//
// Configuration defaults
//
fn default_index_dir() -> PathBuf {
    match directories::ProjectDirs::from("ai", "bloop", "bleep") {
        Some(dirs) => dirs.data_dir().to_owned(),
        None => "bloop_index".into(),
    }
}

fn default_model_dir() -> PathBuf {
    "model".into()
}

fn default_collection_name() -> String {
    "documents".into()
}

pub fn default_parallelism() -> usize {
    std::thread::available_parallelism().unwrap().get()
}

pub const fn minimum_parallelism() -> usize {
    1
}

pub const fn default_buffer_size() -> usize {
    500_000_000
}

const fn default_repo_buffer_size() -> usize {
    200_000_000
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

fn default_max_chunk_tokens() -> usize {
    256
}

fn interactive_batch_size() -> NonZeroUsize {
    let batch_size = if cfg!(feature = "metal") { 5 } else { 1 };
    NonZeroUsize::new(batch_size).unwrap()
}
