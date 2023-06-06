use std::sync::Arc;

use tantivy::schema::{Field, Schema};

use crate::{semantic::Semantic, Configuration};

#[cfg(feature = "debug")]
use {
    histogram::Histogram,
    std::{sync::RwLock, time::Instant},
};

#[derive(Clone)]
pub struct File {
    pub(super) config: Arc<Configuration>,
    pub(super) schema: Schema,
    pub(super) semantic: Option<Semantic>,

    #[cfg(feature = "debug")]
    histogram: Arc<RwLock<Histogram>>,

    // Path to the indexed file or directory on disk
    pub entry_disk_path: Field,
    // Path to the root of the repo on disk
    pub repo_disk_path: Field,
    // Path to the file, relative to the repo root
    pub relative_path: Field,

    // Unique repo identifier, of the form:
    //  local: local//path/to/repo
    // github: github.com/org/repo
    pub repo_ref: Field,

    // Indexed repo name, of the form:
    //  local: repo
    // github: github.com/org/repo
    pub repo_name: Field,

    pub content: Field,
    pub line_end_indices: Field,

    // a flat list of every symbol's text, for searching, e.g.: ["File", "Repo", "worker"]
    pub symbols: Field,
    pub symbol_locations: Field,

    // fast fields for scoring
    pub lang: Field,
    pub avg_line_length: Field,
    pub last_commit_unix_seconds: Field,

    // fast byte versions of certain fields for collector-level filtering
    pub raw_content: Field,
    pub raw_repo_name: Field,
    pub raw_relative_path: Field,

    // list of branches in which this file can be found
    pub branches: Field,

    // Whether this entry is a file or a directory
    pub is_directory: Field,
}

pub struct Repo {
    pub(super) schema: Schema,
    // Path to the root of the repo on disk
    pub disk_path: Field,
    // Name of the org
    pub org: Field,

    // Indexed repo name, of the form:
    //  local: repo
    // github: github.com/org/repo
    pub name: Field,
    pub raw_name: Field,

    // Unique repo identifier, of the form:
    //  local: local//path/to/repo
    // github: github.com/org/repo
    pub repo_ref: Field,
}
