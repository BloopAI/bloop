use std::{
    fmt::{Display, Write},
    ops::Range,
};

use crate::text_range::{Point, TextRange};

use clap::{builder::PossibleValue, ValueEnum};
use serde::{Deserialize, Serialize};
use tokenizers::Tokenizer;
use tracing::{debug, error, warn};

#[derive(Debug)]
pub enum ChunkError {
    UnsupportedLanguage(String),
    Query(tree_sitter::QueryError),
}

/// A Chunk type, containing the plain text (borrowed from the source)
/// and a `TextRange` with byte, line and column positions
#[derive(Debug)]
pub struct Chunk<'a> {
    pub data: &'a str,
    pub range: TextRange,
}

impl<'a> Chunk<'a> {
    pub fn new(data: &'a str, start: Point, end: Point) -> Self {
        Self {
            data,
            range: TextRange { start, end },
        }
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.len() < 1
    }
}

/// This calculates the line and column for a given byte position. The last_line and last_byte
/// parameters can be used to reduce the amount of searching for the line position from quadratic
/// to linear. If in doubt, just use `0` for last_line and `0` for last_byte.
///
/// # Examples
///
/// ```no_run
/// assert_eq!(
///     bleep::semantic::chunk::point("fn hello() {\n    \"world\"\n}\n", 16, 0, 0),
///     bleep::text_range::Point::new(16, 1, 4)
/// );
/// ```
pub fn point(src: &str, byte: usize, last_line: usize, last_byte: usize) -> Point {
    assert!(
        byte >= last_byte,
        "byte={byte} < last_byte={last_byte}, last_line={last_line}"
    );
    let line = src.as_bytes()[last_byte..byte]
        .iter()
        .filter(|&&b| b == b'\n')
        .count()
        + last_line;
    let column = if let Some(last_nl) = src[..byte].rfind('\n') {
        byte - last_nl
    } else {
        byte
    };
    Point { byte, column, line }
}

/// The strategy for overlapping chunks
#[derive(Copy, Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(try_from = "&str", into = "String")]
pub enum OverlapStrategy {
    /// go back _ lines from the end
    ByLines(usize),
    /// A value > 0 and < 1 that indicates the target overlap in tokens.
    Partial(f64),
}

impl Display for OverlapStrategy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ByLines(n) => n.fmt(f),
            Self::Partial(p) => {
                (*p / 100.0).fmt(f)?;
                f.write_char('%')
            }
        }
    }
}

impl From<OverlapStrategy> for String {
    fn from(val: OverlapStrategy) -> Self {
        val.to_string()
    }
}

static OVERLAP_STRATEGY_VARIANTS: &[OverlapStrategy] =
    &[OverlapStrategy::ByLines(1), OverlapStrategy::Partial(0.5)];

impl ValueEnum for OverlapStrategy {
    fn value_variants<'a>() -> &'a [Self] {
        OVERLAP_STRATEGY_VARIANTS
    }

    fn to_possible_value(&self) -> Option<PossibleValue> {
        if self == &OVERLAP_STRATEGY_VARIANTS[0] {
            Some(PossibleValue::new("1"))
        } else if self == &OVERLAP_STRATEGY_VARIANTS[1] {
            Some(PossibleValue::new("50%"))
        } else {
            None
        }
    }

    fn from_str(input: &str, _ignore_case: bool) -> Result<Self, String> {
        Self::try_from(input)
            .map_err(|_| String::from("overlap should be a number of lines or a percentage"))
    }
}

impl TryFrom<&'_ str> for OverlapStrategy {
    type Error = &'static str;

    fn try_from(input: &str) -> Result<Self, &'static str> {
        Ok(if let Some(percentage) = input.strip_suffix('%') {
            Self::Partial(
                str::parse::<f64>(percentage).map_err(|_| "failure parsing overlap strategy")?
                    * 0.01,
            )
        } else {
            Self::ByLines(str::parse(input).map_err(|_| "failure parsing overlap strategy")?)
        })
    }
}

impl OverlapStrategy {
    // returns the next startpoint for overlong lines
    fn next_subdivision(&self, max_tokens: usize) -> usize {
        (match self {
            OverlapStrategy::ByLines(n) => max_tokens - n,
            OverlapStrategy::Partial(part) => ((max_tokens as f64) * part) as usize,
        })
        .max(1) // ensure we make forward progress
    }
}

impl Default for OverlapStrategy {
    fn default() -> Self {
        Self::Partial(0.5)
    }
}

/// This should take care of [CLS], [SEP] etc. which could be introduced during per-chunk tokenization
pub const DEDUCT_SPECIAL_TOKENS: usize = 2;

fn add_token_range<'s>(
    chunks: &mut Vec<Chunk<'s>>,
    src: &'s str,
    offsets: &[(usize, usize)],
    o: Range<usize>,
    last_line: &mut usize,
    last_byte: &mut usize,
) {
    let start_byte = offsets[o.start].0;
    let end_byte = offsets.get(o.end).map_or(src.len(), |&(s, _)| s);

    if end_byte <= start_byte {
        return;
    }

    debug_assert!(
        o.end - o.start < 256,
        "chunk too large: {} tokens in {:?} bytes {:?}",
        o.end - o.start,
        o,
        start_byte..end_byte
    );

    let start = point(src, start_byte, *last_line, *last_byte);
    let end = point(src, end_byte, *last_line, *last_byte);
    (*last_line, *last_byte) = (start.line, start.byte);
    chunks.push(Chunk::new(&src[start_byte..end_byte], start, end));
}

/// This tries to split the code by lines and add as much tokens as possible until reaching
/// `max_tokens`. Then it'll reduce to the last newline.
pub fn by_tokens<'s>(
    repo: &str,
    file: &str,
    src: &'s str,
    tokenizer: &Tokenizer, // we count from line
    token_bounds: Range<usize>,
    max_lines: usize,
    strategy: OverlapStrategy,
) -> Vec<Chunk<'s>> {
    if tokenizer.get_padding().is_some() || tokenizer.get_truncation().is_some() {
        error!(
            "This code can panic if padding and truncation are not turned off. Please make sure padding is off."
        );
    }
    let min_tokens = token_bounds.start;
    // no need to even tokenize files too small to contain our min number of tokens
    if src.len() < min_tokens {
        return Vec::new();
    }
    let Ok(encoding) = tokenizer.encode(src, true)
    else {
        warn!("Could not encode \"{}\"", src);
        return by_lines(src, max_lines);
    };

    let offsets = encoding.get_offsets();
    // again, if we have less than our minimum number of tokens, we may skip the file
    if offsets.len() < min_tokens {
        return Vec::new();
    }

    let repo_plus_file = repo.to_owned() + "\t" + file + "\n";
    let repo_tokens = match tokenizer.encode(repo_plus_file, true) {
        Ok(encoding) => encoding.get_ids().len(),
        Err(e) => {
            error!("failure during encoding repo + file {:?}", e);
            return Vec::new();
        }
    };

    if token_bounds.end <= DEDUCT_SPECIAL_TOKENS + repo_tokens {
        error!("too few tokens");
        return Vec::new();
    }

    let max_tokens = token_bounds.end - DEDUCT_SPECIAL_TOKENS - repo_tokens;
    let max_newline_tokens = max_tokens * 3 / 4; //TODO: make this configurable
    let max_boundary_tokens = max_tokens * 7 / 8; //TODO: make this configurable
    debug!("max tokens reduced to {max_tokens}");

    let offsets_len = offsets.len() - 1;
    // remove the SEP token which has (0, 0) offsets for some reason
    let offsets = if offsets[offsets_len].0 == 0 {
        &offsets[..offsets_len]
    } else {
        offsets
    };
    let ids = encoding.get_ids();
    let mut chunks = Vec::new();
    let mut start = 0;
    let (mut last_line, mut last_byte) = (0, 0);
    loop {
        let next_limit = start + max_tokens;
        let end_limit = if next_limit >= offsets_len {
            offsets_len
        } else if let Some(next_newline) = (start + max_newline_tokens..next_limit)
            .rfind(|&i| src[offsets[i].0..offsets[i + 1].0].contains('\n'))
        {
            next_newline
        } else if let Some(next_boundary) = (start + max_boundary_tokens..next_limit).rfind(|&i| {
            !tokenizer
                .id_to_token(ids[i + 1])
                .map_or(false, |s| s.starts_with("##"))
        }) {
            next_boundary
        } else {
            next_limit
        };
        if end_limit - start >= min_tokens {
            add_token_range(
                &mut chunks,
                src,
                offsets,
                start..end_limit + 1,
                &mut last_line,
                &mut last_byte,
            );
        }
        if end_limit == offsets_len {
            return chunks;
        }
        let diff = strategy.next_subdivision(end_limit - start);
        let mid = start + diff;
        // find nearest newlines or boundaries, set start accordingly
        let next_newline_diff =
            (mid..end_limit).find(|&i| src[offsets[i].0..offsets[i + 1].0].contains('\n'));
        let prev_newline_diff = (start + (diff / 2)..mid)
            .rfind(|&i| src[offsets[i].0..offsets[i + 1].0].contains('\n'))
            .map(|t| t + 1);
        start = match (next_newline_diff, prev_newline_diff) {
            (Some(n), None) | (None, Some(n)) => n,
            (Some(n), Some(p)) => {
                if n - mid < mid - p {
                    n
                } else {
                    p
                }
            }
            (None, None) => (mid..end_limit)
                .find(|&i| {
                    !tokenizer
                        .id_to_token(ids[i + 1])
                        .map_or(false, |s| s.starts_with("##"))
                })
                .unwrap_or(mid),
        };
    }
}

pub fn by_lines(src: &str, size: usize) -> Vec<Chunk<'_>> {
    let ends = std::iter::once(0)
        .chain(src.match_indices('\n').map(|(i, _)| i))
        .enumerate()
        .collect::<Vec<_>>();

    let s = ends.iter().copied();
    let last = src.len().saturating_sub(1);
    let last_line = *ends.last().map(|(idx, _)| idx).unwrap_or(&0);

    ends.iter()
        .copied()
        .step_by(size)
        .zip(s.step_by(size).skip(1).chain([(last_line, last)]))
        .filter(|((_, start_byte), (_, end_byte))| start_byte < end_byte)
        .map(|((start_line, start_byte), (end_line, end_byte))| Chunk {
            data: &src[start_byte..end_byte],
            range: TextRange {
                start: Point {
                    byte: start_byte,
                    line: start_line,
                    column: 0,
                },
                end: Point {
                    byte: end_byte,
                    line: end_line,
                    column: 0,
                },
            },
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{env, path::PathBuf};

    fn tokenizer() -> Tokenizer {
        let tok_json = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("model")
            .join("tokenizer.json");
        println!("{tok_json:?}");
        let tokenizer = tokenizers::Tokenizer::from_file(tok_json).unwrap();
        tokenizer
    }

    #[test]
    pub fn empty() {
        let tokenizer = tokenizer();
        let token_bounds = 50..256;
        let max_lines = 15;
        let no_tokens = super::by_tokens(
            "bloop",
            "rmpty.rs",
            "",
            &tokenizer,
            token_bounds,
            max_lines,
            OverlapStrategy::ByLines(1),
        );
        assert!(no_tokens.is_empty());
    }

    #[test]
    pub fn by_tokens() {
        let tokenizer = tokenizer();
        let token_bounds = 50..256;
        let max_lines = 15;
        let cur_dir = env::current_dir().unwrap();
        let base_dir = cur_dir.ancestors().nth(2).unwrap();
        let walk = ignore::WalkBuilder::new(base_dir)
            .standard_filters(true)
            .filter_entry(|de| {
                let Some(ft) = de.file_type() else {
		    return false;
		};

                // pretty crude, but do ignore generated files
                if ft.is_dir() && de.file_name() == "target" {
                    return false;
                }

                let is_file = ft.is_file() || ft.is_symlink();

                !is_file || de.path().extension().map(|e| e == "rs").unwrap_or_default()
            })
            .build();
        let mut num_chunks = 0;
        let mut combined_size = 0;
        for file in walk {
            let file = file.unwrap();
            if file.metadata().unwrap().is_dir() {
                continue;
            }
            let Ok(src) = std::fs::read_to_string(file.path()) else { continue };
            let chunks = super::by_tokens(
                "bloop",
                &file.path().to_string_lossy(),
                &src,
                &tokenizer,
                token_bounds.clone(),
                max_lines,
                OverlapStrategy::Partial(0.5),
            );
            num_chunks += chunks.len();
            combined_size += chunks.iter().map(Chunk::len).sum::<usize>();
        }
        let avg_size = combined_size / num_chunks;
        // we use string length as a stand in for token length, seeing as tokens will
        // on average be two chars long, and our distribution should be skewed towards
        // longer chunks.
        let min_avg_size = 512;
        assert!(
            avg_size > min_avg_size,
            "Average chunk size should be more than {min_avg_size}, was {avg_size}",
        );
    }

    #[test]
    pub fn chunks_within_token_limit() {
        let tokenizer = tokenizer();
        let max_lines = 15;

        let chunks = super::by_tokens(
            "bloop",
            "src/config.rs",
            SRC,
            &tokenizer,
            50..256,
            max_lines,
            OverlapStrategy::Partial(0.5),
        );

        for chunk in chunks {
            let len = tokenizer.encode(chunk.data, false).unwrap().len();
            assert!(
                len.saturating_sub(256) < 10,
                "chunk length ({len}) was not less than 256\n\n{}\n",
                chunk.data
            )
        }
    }

    #[test]
    pub fn chunks_over_long_lined_file() {
        let tokenizer = tokenizer();
        let max_lines = 15;

        // squish SRC into one big single-lined string
        let src = SRC.lines().collect::<String>();

        let chunks = super::by_tokens(
            "bloop",
            "src/config.rs",
            &src,
            &tokenizer,
            50..256,
            max_lines,
            OverlapStrategy::Partial(0.5),
        );

        for chunk in chunks {
            let len = tokenizer.encode(chunk.data, false).unwrap().len();
            assert!(
                len.saturating_sub(256) < 10,
                "chunk length ({len}) was not less than 256\n\n{}\n",
                chunk.data
            )
        }
    }

    static SRC: &str = r#"
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
    "#;
}
