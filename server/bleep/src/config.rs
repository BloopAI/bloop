use crate::{semantic::chunk::OverlapStrategy, state::StateSource};
use anyhow::{Context, Result};
use clap::Parser;

use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize, Serializer};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Parser, Debug)]
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

    #[clap(short, long, default_value_os_t = default_data_dir())]
    #[serde(default = "default_data_dir")]
    /// Directory to store indexes
    pub index_dir: PathBuf,

    /// Directory to store persistent data
    #[clap(long, default_value_os_t = default_data_dir())]
    #[serde(default = "default_data_dir")]
    pub data_dir: PathBuf,

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

    //
    // External dependencies
    //
    #[clap(long, default_value_t = default_answer_api_url())]
    #[serde(default = "default_answer_api_url")]
    /// URL for the answer-api
    pub answer_api_url: String,

    #[clap(long)]
    /// Key for analytics backend
    pub analytics_key: Option<String>,

    #[clap(long)]
    /// Key for analytics backend for frontend
    pub analytics_key_fe: Option<String>,

    #[clap(long)]
    /// Analytics data plane identifier
    pub analytics_data_plane: Option<String>,

    #[clap(long)]
    /// Sentry Data Source Name
    pub sentry_dsn: Option<String>,

    #[clap(long)]
    /// Sentry Data Source Name for frontend
    pub sentry_dsn_fe: Option<String>,

    #[clap(long)]
    /// Path to dynamic libraries used in the app.
    pub dylib_dir: Option<PathBuf>,

    //
    // Semantic values
    //
    #[clap(long)]
    /// URL for the qdrant server
    pub qdrant_url: Option<String>,

    #[clap(long, default_value_os_t = default_model_dir())]
    #[serde(default = "default_model_dir")]
    /// Path to the embedding model directory
    pub model_dir: PathBuf,

    #[clap(long, default_value_t = default_max_chunk_tokens())]
    #[serde(default = "default_max_chunk_tokens")]
    /// Maximum number of tokens in a chunk (should be the model's input size)
    pub max_chunk_tokens: usize,

    #[clap(long)]
    /// Chunking strategy
    pub overlap: Option<OverlapStrategy>,

    //
    // Installation-specific values
    //
    #[clap(long)]
    #[serde(serialize_with = "serialize_secret_opt_str", default)]
    /// Github Client ID for either OAuth or GitHub Apps
    pub github_client_id: Option<SecretString>,

    // Github client secret
    #[clap(long)]
    #[serde(serialize_with = "serialize_secret_opt_str", default)]
    pub github_client_secret: Option<SecretString>,

    #[clap(long)]
    /// GitHub App ID
    pub github_app_id: Option<u64>,

    #[clap(long)]
    /// GitHub App installation ID
    pub github_app_install_id: Option<u64>,

    #[clap(long)]
    /// Path to a GitHub private key file, for signing access token requests
    pub github_app_private_key: Option<PathBuf>,

    #[clap(long)]
    #[serde(serialize_with = "serialize_secret_opt_str", default)]
    /// Bot secret token
    pub bot_secret: Option<SecretString>,

    //
    // Cloud deployment values
    //
    #[clap(long)]
    /// Full instance domain, e.g. `foo.bloop.ai`
    pub instance_domain: Option<String>,

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

    pub fn github_client_id_and_secret(&self) -> Option<(&str, &str)> {
        let id = self.github_client_id.as_ref()?.expose_secret();
        let secret = self.github_client_secret.as_ref()?.expose_secret();
        Some((id, secret))
    }

    pub fn cli_overriding_config_file() -> Result<Self> {
        let cli = Self::from_cli()?;
        let Ok(file) = cli
            .config_file
            .as_ref()
            .context("no config file specified")
            .and_then(Self::read) else
        {
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

            index_dir: right_if_default!(b.index_dir, a.index_dir, default_data_dir()),

            data_dir: b.data_dir,

            index_only: b.index_only | a.index_only,

            disable_background: b.disable_background | a.disable_background,

            disable_fsevents: b.disable_fsevents | a.disable_fsevents,

            buffer_size: right_if_default!(b.buffer_size, a.buffer_size, default_buffer_size()),

            repo_buffer_size: right_if_default!(
                b.repo_buffer_size,
                a.repo_buffer_size,
                default_repo_buffer_size()
            ),

            max_threads: right_if_default!(b.max_threads, a.max_threads, default_parallelism()),

            host: right_if_default!(b.host, a.host, default_host()),

            port: right_if_default!(b.port, a.port, default_port()),

            model_dir: right_if_default!(b.model_dir, a.model_dir, default_model_dir()),

            max_chunk_tokens: right_if_default!(
                b.max_chunk_tokens,
                a.max_chunk_tokens,
                default_max_chunk_tokens()
            ),

            overlap: b.overlap.or(a.overlap),

            frontend_dist: b.frontend_dist.or(a.frontend_dist),

            qdrant_url: b.qdrant_url.or(a.qdrant_url),

            answer_api_url: right_if_default!(
                b.answer_api_url,
                a.answer_api_url,
                default_answer_api_url()
            ),

            github_client_id: b.github_client_id.or(a.github_client_id),

            github_client_secret: b.github_client_secret.or(a.github_client_secret),

            github_app_id: b.github_app_id.or(a.github_app_id),

            github_app_install_id: b.github_app_install_id.or(a.github_app_install_id),

            github_app_private_key: b.github_app_private_key.or(a.github_app_private_key),

            instance_domain: b.instance_domain.or(a.instance_domain),

            bot_secret: b.bot_secret.or(a.bot_secret),

            analytics_key: b.analytics_key.or(a.analytics_key),
            analytics_key_fe: b.analytics_key_fe.or(a.analytics_key_fe),

            analytics_data_plane: b.analytics_data_plane.or(a.analytics_data_plane),

            sentry_dsn: b.sentry_dsn.or(a.sentry_dsn),

            sentry_dsn_fe: b.sentry_dsn_fe.or(a.sentry_dsn_fe),

            dylib_dir: b.dylib_dir.or(a.dylib_dir),
        }
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
fn default_data_dir() -> PathBuf {
    match directories::ProjectDirs::from("ai", "bloop", "bleep") {
        Some(dirs) => dirs.data_dir().to_owned(),
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

fn default_answer_api_url() -> String {
    String::from("http://127.0.0.1:7879")
}

fn default_max_chunk_tokens() -> usize {
    256
}
