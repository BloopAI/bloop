//! Every change in this file will trigger a reset of the databases.
//! Use with care.
//!
use tantivy::schema::{
    BytesOptions, Field, IndexRecordOption, Schema, SchemaBuilder, TextFieldIndexing, TextOptions,
    FAST, INDEXED, STORED, STRING, TEXT,
};

#[cfg(feature = "debug")]
use {
    histogram::Histogram,
    std::sync::{Arc, RwLock},
};

/// A schema for indexing all files and directories, linked to a
/// single repository on disk.
#[derive(Clone)]
pub struct File {
    pub(super) schema: Schema,

    #[cfg(feature = "debug")]
    pub histogram: Arc<RwLock<Histogram>>,

    /// Unique ID for the file in a repo
    pub unique_hash: Field,

    /// Path to the root of the repo on disk
    pub repo_disk_path: Field,
    /// Path to the file, relative to the repo root
    pub relative_path: Field,

    /// Unique repo identifier, of the form:
    ///  local: local//path/to/repo
    /// github: github.com/org/repo
    pub repo_ref: Field,

    /// Indexed repo name, of the form:
    ///  local: repo
    /// github: github.com/org/repo
    pub repo_name: Field,

    pub content: Field,
    pub line_end_indices: Field,

    /// a flat list of every symbol's text, for searching, e.g.:
    /// ["File", "Repo", "worker"]
    pub symbols: Field,
    pub symbol_locations: Field,

    /// fast fields for scoring
    pub lang: Field,
    pub avg_line_length: Field,
    pub last_commit_unix_seconds: Field,

    /// fast byte versions of certain fields for collector-level filtering
    pub raw_content: Field,
    pub raw_repo_name: Field,
    pub raw_relative_path: Field,

    /// list of branches in which this file can be found
    pub branches: Field,

    /// list of branches in which this file can be found
    pub indexed: Field,

    /// Whether this entry is a file or a directory
    pub is_directory: Field,
}

impl File {
    pub fn new() -> Self {
        let mut builder = tantivy::schema::SchemaBuilder::new();
        let trigram = TextOptions::default().set_stored().set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("default")
                .set_index_option(IndexRecordOption::WithFreqsAndPositions),
        );

        let unique_hash = builder.add_text_field("unique_hash", STRING | STORED);

        let repo_disk_path = builder.add_text_field("repo_disk_path", STRING);
        let repo_ref = builder.add_text_field("repo_ref", STRING | STORED);
        let repo_name = builder.add_text_field("repo_name", trigram.clone());
        let relative_path = builder.add_text_field("relative_path", trigram.clone());

        let content = builder.add_text_field("content", trigram.clone());
        let line_end_indices =
            builder.add_bytes_field("line_end_indices", BytesOptions::default().set_stored());

        let symbols = builder.add_text_field("symbols", trigram.clone());
        let symbol_locations =
            builder.add_bytes_field("symbol_locations", BytesOptions::default().set_stored());

        let branches = builder.add_text_field("branches", trigram);

        let lang = builder.add_bytes_field(
            "lang",
            BytesOptions::default().set_stored().set_indexed() | FAST,
        );
        let avg_line_length = builder.add_f64_field("line_length", FAST);
        let last_commit_unix_seconds = builder.add_u64_field("last_commit_unix_seconds", FAST);

        let raw_content = builder.add_bytes_field("raw_content", FAST);
        let raw_repo_name = builder.add_bytes_field("raw_repo_name", FAST);
        let raw_relative_path = builder.add_bytes_field("raw_relative_path", FAST);

        let is_directory = builder.add_bool_field("is_directory", FAST | STORED);
        let indexed = builder.add_bool_field("indexed", STORED);

        Self {
            schema: builder.build(),
            repo_disk_path,
            relative_path,
            unique_hash,
            repo_ref,
            repo_name,
            content,
            line_end_indices,
            symbols,
            symbol_locations,
            lang,
            avg_line_length,
            last_commit_unix_seconds,
            raw_content,
            raw_repo_name,
            raw_relative_path,
            branches,
            is_directory,
            indexed,

            #[cfg(feature = "debug")]
            histogram: Arc::new(Histogram::builder().build().unwrap().into()),
        }
    }

    pub fn schema(&self) -> Schema {
        self.schema.clone()
    }
}

impl Default for File {
    fn default() -> Self {
        Self::new()
    }
}

/// An index representing a repository to allow free-text search on
/// repository names
pub struct Repo {
    pub(super) schema: Schema,

    /// Path to the root of the repo on disk
    pub disk_path: Field,

    /// Name of the org
    pub org: Field,

    /// Indexed repo name, of the form:
    ///  local: repo
    /// github: github.com/org/repo
    pub name: Field,
    pub raw_name: Field,

    /// Unique repo identifier, of the form:
    ///  local: local//path/to/repo
    /// github: github.com/org/repo
    pub repo_ref: Field,
}

impl Repo {
    pub fn new() -> Self {
        let mut builder = SchemaBuilder::new();
        let trigram = TextOptions::default().set_stored().set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("default")
                .set_index_option(IndexRecordOption::WithFreqsAndPositions),
        );

        let disk_path = builder.add_text_field("disk_path", STRING);
        let org = builder.add_text_field("org", trigram.clone());
        let name = builder.add_text_field("name", trigram.clone());
        let raw_name = builder.add_bytes_field("raw_name", FAST);
        let repo_ref = builder.add_text_field("repo_ref", trigram);

        Self {
            disk_path,
            org,
            name,
            raw_name,
            repo_ref,
            schema: builder.build(),
        }
    }
}

#[derive(Clone)]
pub struct Section {
    pub(super) schema: Schema,

    /// Monotonically increasing id, unique to each doc-provider indexed. This
    /// is also stored in sqlite and is used to cross reference the two
    pub doc_id: Field,

    /// URL that identifies this doc-source
    pub doc_source: Field,

    /// Human readable doc-title, scraped from html
    pub doc_title: Field,

    /// Human readable doc-description, scraped from html
    pub doc_description: Field,

    // Content-addressable hash for each section in a page
    pub point_id: Field,

    /// Relative URL of the page containing this section
    pub relative_url: Field,

    /// Absolute URL of the page containing this section
    pub absolute_url: Field,

    /// Section header. All sections start with a header
    pub header: Field,

    /// List of headers of all parent sections above this section. This
    /// is stored in the tantivy index as a string separated by the sequence " > ".
    ///
    ///
    /// The order of headers in this field is top to bottom, for example:
    ///
    /// # Introduction > ## What is tantivy? > ### API Migration
    ///
    pub ancestry: Field,

    /// Text content of this section in raw markdown. This content also includes the header
    pub text: Field,

    /// Start location in bytes
    pub start_byte: Field,

    /// End location in bytes
    pub end_byte: Field,

    /// Number of items in this sections' ancestry
    pub section_depth: Field,

    /// Bytes indexed, fast, relative_url field, used for grouping and other fastfield business
    pub raw_relative_url: Field,
}

impl Default for Section {
    fn default() -> Self {
        Self::new()
    }
}

impl Section {
    pub fn new() -> Self {
        let mut builder = SchemaBuilder::new();
        let trigram = TextOptions::default().set_stored().set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("trigram")
                .set_index_option(IndexRecordOption::WithFreqsAndPositions),
        );
        let raw = TextOptions::default().set_stored().set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("raw")
                .set_index_option(IndexRecordOption::WithFreqsAndPositions),
        );

        let doc_id = builder.add_i64_field("doc_id", FAST | STORED | INDEXED);
        let point_id = builder.add_text_field("point_id", raw.clone());
        let doc_source = builder.add_text_field("doc_source", STORED);
        let doc_title = builder.add_text_field("doc_title", TEXT | STORED);
        let doc_description = builder.add_text_field("doc_description", TEXT | STORED);
        let relative_url = builder.add_text_field("relative_url", raw.clone());
        let absolute_url = builder.add_text_field("absolute_url", raw);
        let header = builder.add_text_field("header", trigram.clone());
        let ancestry = builder.add_text_field("ancestry", trigram.clone());
        let text = builder.add_text_field("text", trigram);
        let start_byte = builder.add_u64_field("start_byte", STORED);
        let end_byte = builder.add_u64_field("end_byte", STORED);
        let section_depth = builder.add_u64_field("section_depth", FAST | STORED);

        let raw_relative_url = builder.add_bytes_field("raw_relative_url", FAST | STORED | INDEXED);

        Self {
            doc_id,
            point_id,
            doc_source,
            doc_title,
            doc_description,
            relative_url,
            absolute_url,
            header,
            ancestry,
            text,
            start_byte,
            end_byte,
            section_depth,
            raw_relative_url,
            schema: builder.build(),
        }
    }
}
