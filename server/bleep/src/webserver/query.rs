use std::{
    collections::{HashMap, HashSet},
    path::MAIN_SEPARATOR,
    sync::Arc,
};

use super::{json, EndpointError, ErrorKind};
use crate::{
    collector::{BytesFilterCollector, FrequencyCollector},
    indexes::{
        reader::{base_name, ContentReader, FileReader, OpenReader, RepoReader},
        DocumentRead, File, Indexable, Indexer, Indexes, Repo,
    },
    query::{parser, ranking::DocumentTweaker},
    snippet::{HighlightedString, SnippedFile, Snipper},
};

use anyhow::Result;
use async_trait::async_trait;
use axum::{
    extract::Query, http::StatusCode, response::IntoResponse as IntoAxumResponse, Extension,
};
use regex::bytes::RegexBuilder as ByteRegexBuilder;
use serde::{Deserialize, Serialize};
use smallvec::SmallVec;
use tantivy::collector::{MultiCollector, TopDocs};
use utoipa::{IntoParams, ToSchema};

const fn default_page_size() -> usize {
    100
}

const fn default_context() -> usize {
    1
}

const fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct ApiQuery {
    /// A query written in the bloop query language
    pub q: String,

    #[serde(default)]
    pub page: usize,

    #[serde(default = "default_page_size")]
    pub page_size: usize,

    /// Whether to calculate total_pages and total_count.
    ///
    /// This value can be set to false when browsing through pages of the same
    /// query, after retrieving totals from the first page, in order to cut down
    /// on calculations.
    ///
    /// To calculate totals, we run an additional `count` query against each
    /// index.
    #[serde(default = "default_true")]
    pub calculate_totals: bool,

    /// The number of lines of context in the snippet before the search result
    #[serde(alias = "cb", default = "default_context")]
    context_before: usize,

    /// The number of lines of context in the snippet after the search result
    #[serde(alias = "ca", default = "default_context")]
    context_after: usize,
}

impl ApiQuery {
    fn limit(&self) -> usize {
        // do not permit a page-size of 0
        self.page_size.max(1)
    }

    fn offset(&self) -> usize {
        self.page_size * self.page
    }

    async fn query(
        self: Arc<Self>,
        indexes: Arc<Indexes>,
    ) -> Result<QueryResponse, EndpointError<'static>> {
        let queries =
            parser::parse(&self.q).map_err(|e| EndpointError::user(e.to_string().into()))?;

        for q in &queries {
            if ContentReader.query_matches(q) {
                return ContentReader
                    .execute(&indexes.file, &queries, &self)
                    .await
                    .map_err(|e| EndpointError::internal(e.to_string().into()));
            } else if RepoReader.query_matches(q) {
                return RepoReader
                    .execute(&indexes.repo, &queries, &self)
                    .await
                    .map_err(|e| EndpointError::internal(e.to_string().into()));
            } else if FileReader.query_matches(q) {
                return FileReader
                    .execute(&indexes.file, &queries, &self)
                    .await
                    .map_err(|e| EndpointError::internal(e.to_string().into()));
            } else if OpenReader.query_matches(q) {
                return OpenReader
                    .execute(&indexes.file, &queries, &self)
                    .await
                    .map_err(|e| EndpointError::internal(e.to_string().into()));
            }
        }

        return Err(EndpointError::user("mangled query".into()));
    }
}

#[utoipa::path(
    get,
    path = "/q",
    params(ApiQuery),
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn handle(
    Query(api_params): Query<ApiQuery>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> impl IntoAxumResponse {
    let response = Arc::new(api_params).query(indexes).await;
    match response {
        Ok(r) => (StatusCode::OK, json(r)),
        Err(e) if e.kind == ErrorKind::User => (StatusCode::BAD_REQUEST, json(e)),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, json(e)),
    }
}

#[derive(Serialize, ToSchema)]
pub struct QueryResponse {
    /// Number of search results in this response
    count: usize,
    /// Paging metadata
    metadata: QueryMetadata,
    /// Search result data
    pub data: Vec<QueryResult>,
    /// Stats for nerds
    stats: ResultStats,
}

/// Metadata pertaining to the query response, such as paging info
#[derive(Default, Serialize, ToSchema)]
pub(super) struct QueryMetadata {
    /// Page number passed in the request
    page: usize,

    /// Number of items per-page
    page_size: usize,

    /// total number of pages, only populated if the client requests it
    page_count: Option<usize>,

    /// total number of search results across all pages, only populated
    /// if the client requests it
    total_count: Option<usize>,
}

#[derive(Default, Serialize, Deserialize, Debug)]
pub struct ResultStats {
    pub lang: HashMap<String, usize>,
    pub repo: HashMap<String, usize>,
}

impl ResultStats {
    fn with_lang_freqs(mut self, mut lang_freqs: HashMap<Vec<u8>, usize>) -> Self {
        self.lang = lang_freqs
            .iter_mut()
            .map(|(k, v)| {
                let k =
                    crate::query::languages::proper_case(String::from_utf8_lossy(k)).to_string();
                (k, *v)
            })
            .collect();
        self
    }

    fn with_repo_freqs(mut self, mut repo_freqs: HashMap<Vec<u8>, usize>) -> Self {
        self.repo = repo_freqs
            .iter_mut()
            .map(|(k, v)| {
                let k = String::from_utf8_lossy(k).to_string();
                (k, *v)
            })
            .collect();
        self
    }
}

#[derive(Serialize, ToSchema)]
#[non_exhaustive]
#[serde(tag = "kind", content = "data")]
pub enum QueryResult {
    #[serde(rename = "snippets")]
    Snippets(SnippedFile),

    #[serde(rename = "repository_result")]
    RepositoryResult(RepositoryResultData),

    #[serde(rename = "file_result")]
    FileResult(FileResultData),

    #[serde(rename = "file")]
    File(FileData),

    #[serde(rename = "dir")]
    Directory(DirectoryData),

    // Only returned by autocomplete
    #[serde(rename = "flag")]
    Flag(String),

    #[serde(rename = "lang")]
    Lang(String),
}

#[derive(Serialize, ToSchema)]
pub struct RepositoryResultData {
    name: HighlightedString,
    repo_ref: String,
}

#[derive(Serialize, ToSchema)]
pub struct FileResultData {
    repo_name: String,
    relative_path: HighlightedString,
    repo_ref: String,
    lang: Option<String>,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct FileData {
    repo_name: String,
    relative_path: String,
    repo_ref: String,
    lang: Option<String>,
    contents: String,
    siblings: Vec<DirEntry>,
}

#[derive(Serialize, ToSchema)]
pub struct DirectoryData {
    repo_name: String,
    relative_path: String,
    repo_ref: String,
    entries: Vec<DirEntry>,
}

#[derive(Serialize, ToSchema, PartialEq, Eq, Hash, Clone, Debug)]
pub struct DirEntry {
    name: String,
    entry_data: EntryData,
}

#[derive(Serialize, ToSchema, PartialEq, Eq, Hash, Clone, Debug)]
enum EntryData {
    Directory,
    File { lang: Option<String> },
}

#[async_trait]
pub trait ExecuteQuery {
    type Index: Indexable;

    async fn execute(
        &self,
        indexer: &Indexer<Self::Index>,
        queries: &[parser::Query<'_>],
        q: &ApiQuery,
    ) -> Result<QueryResponse>;
}

#[async_trait]
impl ExecuteQuery for ContentReader {
    type Index = File;

    async fn execute(
        &self,
        indexer: &Indexer<Self::Index>,
        queries: &[parser::Query<'_>],
        q: &ApiQuery,
    ) -> Result<QueryResponse> {
        // queries that produce content results
        let relevant_queries = queries.iter().filter(|q| self.query_matches(q));

        // a list of targets, for a query of the form `symbol:foo or bar`, this is:
        // - a symbol target: foo
        // - a content target: bar
        let targets = relevant_queries
            .filter_map(|q| Some((q.target.as_ref()?, q.is_case_sensitive())))
            .collect::<SmallVec<[_; 2]>>();

        // a regex filter to get rid of docs that contain the trigrams but not the text
        let byte_regexes = targets
            .iter()
            .filter_map(|(target, case)| {
                ByteRegexBuilder::new(&target.literal().regex_str())
                    .multi_line(true)
                    .case_insensitive(!case)
                    .build()
                    .ok()
            })
            .collect::<Vec<_>>();

        let raw_content = indexer.source.raw_content;
        let repo_field = indexer.source.raw_repo_name;
        let lang_field = indexer.source.lang;

        // our results will consist of the top-k docs...
        let top_k = TopDocs::with_limit(q.limit())
            .and_offset(q.offset())
            .tweak_score(DocumentTweaker(indexer.source.clone()));

        // ...plus some rich search metadata
        let total_count_collector = tantivy::collector::Count;
        let lang_stats_collector = FrequencyCollector(lang_field);
        let repo_stats_collector = FrequencyCollector(repo_field);

        let mut metadata_collector = MultiCollector::new();
        let total_count_handle = metadata_collector.add_collector(total_count_collector);
        let lang_stats_handle = metadata_collector.add_collector(lang_stats_collector);
        let repo_stats_handle = metadata_collector.add_collector(repo_stats_collector);

        // our final search results contain top-k, total count, language stats, repo stats,
        // filtered by the target regex
        let collector = BytesFilterCollector::new(
            raw_content,
            move |b| byte_regexes.iter().any(|r| r.is_match(b)), // a doc is accepted if it contains atleast 1 target
            (top_k, metadata_collector),
        );

        let mut results = indexer.query(queries.iter(), self, collector).await?;
        let data = results
            .docs
            .filter_map(|doc| {
                let snipper = Snipper::default().context(q.context_before, q.context_after);
                let mut all_snippets = None::<SnippedFile>;

                for (target, case_sensitive) in &targets {
                    let (is_symbol, lit) = match target {
                        parser::Target::Symbol(lit) => (true, lit),
                        parser::Target::Content(lit) => (false, lit),
                    };

                    if let Some(snippets) = snipper
                        .find_symbols(is_symbol)
                        .case_sensitive(*case_sensitive)
                        .all_for_doc(&lit.regex_str(), &doc)
                        .unwrap()
                    {
                        all_snippets = if let Some(data) = all_snippets {
                            Some(data.merge(snippets))
                        } else {
                            Some(snippets)
                        };
                    }
                }

                Some(QueryResult::Snippets(all_snippets?))
            })
            .collect::<Vec<QueryResult>>();

        let total_count = total_count_handle.extract(&mut results.metadata);

        let stats = ResultStats::default()
            .with_lang_freqs(lang_stats_handle.extract(&mut results.metadata))
            .with_repo_freqs(repo_stats_handle.extract(&mut results.metadata));

        let metadata = QueryMetadata {
            page: q.page,
            page_size: q.page_size,
            page_count: Some(div_ceil(total_count, q.page_size)),
            total_count: Some(total_count),
        };
        let count = data.len();
        let response = QueryResponse {
            count,
            metadata,
            data,
            stats,
        };
        Ok(response)
    }
}

// FIXME: use usize::div_ceil soon
fn div_ceil(a: usize, b: usize) -> usize {
    let d = a / b;
    let r = a % b;
    d + usize::from(r > 0)
}

#[async_trait]
impl ExecuteQuery for FileReader {
    type Index = File;

    async fn execute(
        &self,
        indexer: &Indexer<File>,
        queries: &[parser::Query<'_>],
        q: &ApiQuery,
    ) -> Result<QueryResponse> {
        let top_docs = TopDocs::with_limit(q.limit()).and_offset(q.offset());

        let repo_field = indexer.source.raw_repo_name;
        let lang_field = indexer.source.lang;

        let total_count_collector = tantivy::collector::Count;
        let lang_stats_collector = FrequencyCollector(lang_field);
        let repo_stats_collector = FrequencyCollector(repo_field);

        let mut metadata_collector = MultiCollector::new();
        let total_count_handle = metadata_collector.add_collector(total_count_collector);
        let lang_stats_handle = metadata_collector.add_collector(lang_stats_collector);
        let repo_stats_handle = metadata_collector.add_collector(repo_stats_collector);

        let mut results = indexer
            .query(queries.iter(), self, (top_docs, metadata_collector))
            .await?;

        let filter_regexes = queries
            .iter()
            .filter(|q| self.query_matches(q))
            .filter_map(|q| Some(q.path.as_ref()?.regex().expect("failed to parse regex")))
            .collect::<SmallVec<[_; 2]>>();

        let data = results
            .docs
            .map(|f| {
                let mut relative_path = HighlightedString::new(f.relative_path);

                for regex in &filter_regexes {
                    relative_path.apply_regex(regex);
                }

                QueryResult::FileResult(FileResultData {
                    relative_path,
                    repo_name: f.repo_name,
                    repo_ref: f.repo_ref,
                    lang: f.lang,
                })
            })
            .collect::<Vec<QueryResult>>();

        let total_count = total_count_handle.extract(&mut results.metadata);

        let stats = ResultStats::default()
            .with_lang_freqs(lang_stats_handle.extract(&mut results.metadata))
            .with_repo_freqs(repo_stats_handle.extract(&mut results.metadata));

        let metadata = QueryMetadata {
            page: q.page,
            page_size: q.page_size,
            page_count: Some(div_ceil(total_count, q.page_size)),
            total_count: Some(total_count),
        };

        let response = QueryResponse {
            count: data.len(),
            data,
            metadata,
            stats,
        };

        Ok(response)
    }
}

#[async_trait]
impl ExecuteQuery for RepoReader {
    type Index = Repo;

    async fn execute(
        &self,
        indexer: &Indexer<Self::Index>,
        queries: &[parser::Query<'_>],
        q: &ApiQuery,
    ) -> Result<QueryResponse> {
        let filter_regexes = queries
            .iter()
            .filter(|q| self.query_matches(q))
            .into_iter()
            .filter_map(|q| q.repo.as_ref().and_then(|lit| lit.regex().ok()))
            .collect::<SmallVec<[_; 2]>>();

        let top_docs = TopDocs::with_limit(q.limit()).and_offset(q.offset());

        let name_field = indexer.source.raw_name;
        let repo_stats_collector = FrequencyCollector(name_field);
        let total_count_collector = tantivy::collector::Count;

        let mut metadata_collector = MultiCollector::new();
        let repo_stats_handle = metadata_collector.add_collector(repo_stats_collector);
        let total_count_handle = metadata_collector.add_collector(total_count_collector);

        let mut results = indexer
            .query(queries.iter(), self, (top_docs, metadata_collector))
            .await?;

        let data = results
            .docs
            .map(|r| {
                let mut name = HighlightedString::new(r.name);

                for r in &filter_regexes {
                    name.apply_regex(r);
                }

                QueryResult::RepositoryResult(RepositoryResultData {
                    name,
                    repo_ref: r.repo_ref,
                })
            })
            .collect::<Vec<QueryResult>>();

        let stats = ResultStats::default()
            .with_repo_freqs(repo_stats_handle.extract(&mut results.metadata));

        let total_count = total_count_handle.extract(&mut results.metadata);
        let metadata = QueryMetadata {
            page: q.page,
            page_size: q.page_size,
            page_count: Some(div_ceil(total_count, q.page_size)),
            total_count: Some(total_count),
        };

        let response = QueryResponse {
            count: data.len(),
            data,
            metadata,
            stats,
        };

        Ok(response)
    }
}

#[async_trait]
impl ExecuteQuery for OpenReader {
    type Index = File;

    async fn execute(
        &self,
        indexer: &Indexer<Self::Index>,
        queries: &[parser::Query<'_>],
        _q: &ApiQuery,
    ) -> Result<QueryResponse> {
        let top_docs = TopDocs::with_limit(1000);
        let empty_collector = MultiCollector::new();
        let results = indexer
            .query(queries.iter(), self, (top_docs, empty_collector))
            .await?;

        struct Directive<'a> {
            relative_path: &'a str,
            repo_name: &'a str,
        }

        let open_directives = queries
            .iter()
            .filter(|q| self.query_matches(q))
            .filter_map(|q| {
                Some(Directive {
                    relative_path: match q.path.as_ref() {
                        None => "",
                        Some(parser::Literal::Plain(p)) => p,
                        Some(parser::Literal::Regex(..)) => return None,
                    },
                    repo_name: q.repo.as_ref()?.as_plain()?,
                })
            })
            .collect::<SmallVec<[_; 2]>>();

        // Map of (repo_name, relative_path) -> (String, entry set)
        //
        // This is used to build up the directory and file return values.
        let mut dir_entries: HashMap<(&str, &str), (String, HashSet<DirEntry>)> = HashMap::new();

        // List of files that should be returned.
        let mut files = Vec::new();
        // Set of (repo_name, relative_path) that should be returned.
        let directories = open_directives
            .iter()
            .filter(|d| d.relative_path.is_empty() || d.relative_path.ends_with(MAIN_SEPARATOR))
            .map(|d| (d.repo_name, d.relative_path))
            .collect::<HashSet<_>>();

        // Iterate over each combination of (document, directive).
        //
        // The total document list is a result of a combination of queries, so here we categorize
        // the relevant results.
        for doc in results.docs {
            for directive in open_directives
                .iter()
                .filter(|d| d.repo_name == doc.repo_name)
            {
                // Exact hit.
                if directive.relative_path == doc.relative_path {
                    files.push(FileData {
                        repo_name: doc.repo_name.clone(),
                        relative_path: doc.relative_path.clone(),
                        repo_ref: doc.repo_ref.to_owned(),
                        lang: doc.lang.clone(),
                        contents: doc.content.clone(),
                        siblings: vec![],
                    });

                    continue;
                }

                let relative_path = base_name(directive.relative_path);

                if let Some(entry) = doc
                    .relative_path
                    .strip_prefix(relative_path)
                    .and_then(|s| s.split_inclusive(MAIN_SEPARATOR).next())
                {
                    dir_entries
                        .entry((directive.repo_name, relative_path))
                        .or_insert_with(|| (doc.repo_ref.to_owned(), HashSet::default()))
                        .1
                        .insert(DirEntry {
                            name: entry.to_owned(),
                            entry_data: if entry.contains(MAIN_SEPARATOR) {
                                EntryData::Directory
                            } else {
                                EntryData::File {
                                    lang: doc.lang.clone(),
                                }
                            },
                        });
                }
            }
        }

        // Assign sibling data now that we have crawled all the results.
        for file in &mut files {
            file.siblings = dir_entries
                .get(&(&file.repo_name, base_name(&file.relative_path)))
                .map(|(_ref, entries)| entries)
                .into_iter()
                .flatten()
                .cloned()
                .collect();
        }

        let data = directories
            .into_iter()
            .map(|(repo_name, relative_path)| {
                let (repo_ref, entries) = dir_entries.get(&(repo_name, relative_path)).unwrap();

                DirectoryData {
                    repo_name: repo_name.to_owned(),
                    relative_path: relative_path.to_owned(),
                    repo_ref: repo_ref.clone(),
                    entries: entries.iter().cloned().collect(),
                }
            })
            .map(QueryResult::Directory)
            .chain(files.into_iter().map(QueryResult::File))
            .collect::<Vec<QueryResult>>();

        let response = QueryResponse {
            count: data.len(),
            data,
            metadata: QueryMetadata::default(),
            stats: ResultStats::default(),
        };

        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::snippet::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn serialize_response() {
        let expected = serde_json::json!({
          "count": 1,
          "data": [
            {
              "data": {
                "lang": "Rust",
                "relative_path": "./bleep/src/indexes/repo.rs",
                "repo_name": "local//bleep",
                "repo_ref": "/User/bloop/bleep",
                "snippets": [
                  {
                    "highlights": [{
                      "start": 51,
                      "end": 56,
                    }],
                    "symbols": [],
                    "data": r#"        mut writer: IndexWriter,\n        _threads: usize,\n    ) -> Result<()> {"#,
                    "line_range": {
                      "start": 49,
                      "end": 51
                    }
                  }
                ]
              },
              "kind": "snippets"
            }
          ],
          "metadata": {
              "page": 0,
              "page_size": 100,
              "page_count": 6,
              "total_count": 520
          },
          "stats": {
            "repo": {"local//bleep": 1},
            "lang": {
                "Rust": 1
            }
          },
        });

        let repos = HashMap::from([("local//bleep".into(), 1)]);
        let langs = HashMap::from([("Rust".into(), 1)]);

        let observed = serde_json::to_value(QueryResponse {
            count: 1,
            data: vec![QueryResult::Snippets(SnippedFile {
                relative_path: "./bleep/src/indexes/repo.rs".into(),
                repo_name: "local//bleep".into(),
                repo_ref: "/User/bloop/bleep".into(),
                lang: Some("Rust".into()),
                snippets: vec![Snippet {
                    data: r#"        mut writer: IndexWriter,\n        _threads: usize,\n    ) -> Result<()> {"#.to_owned(),
                    line_range: 49..51,
                    highlights: vec![51..56],
                    symbols: vec![],
                }],
            })],
            metadata: QueryMetadata {
                page: 0,
                page_size: 100,
                page_count: Some(6),
                total_count: Some(520)
            },
            stats: ResultStats { repo: repos, lang: langs },
        })
        .unwrap();

        assert_eq!(expected, observed);
    }
}
