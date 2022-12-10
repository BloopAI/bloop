use std::{
    collections::{HashMap, HashSet},
    path::MAIN_SEPARATOR,
    sync::Arc,
};

use super::{json, EndpointError, ErrorKind};
use crate::{
    indexes::{
        reader::{base_name, ContentReader, FileReader, OpenReader, RepoReader},
        File, Indexable, Indexer, Indexes, Repo,
    },
    query::{parser, ranking::DocumentTweaker},
    snippet::{HighlightedString, SnippedFile, Snipper},
};

use anyhow::Result;
use async_trait::async_trait;
use axum::{
    extract::Query, http::StatusCode, response::IntoResponse as IntoAxumResponse, Extension,
};
use futures::{stream, StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use smallvec::SmallVec;
use tantivy::collector::TopDocs;
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

        let contents = ContentReader.execute(&indexes.file, &queries, &self);
        let repos = RepoReader.execute(&indexes.repo, &queries, &self);
        let files = FileReader.execute(&indexes.file, &queries, &self);
        let opens = OpenReader.execute(&indexes.file, &queries, &self);

        let query_result_list = stream::iter([contents, repos, files, opens])
            // Buffer several readers at the same time. The exact number is not important; this is
            // simply an upper bound.
            .buffered(10)
            .try_fold(Vec::new(), |mut a, e| async {
                a.extend(e.into_iter());
                Ok(a)
            })
            .await
            .map_err(|e| EndpointError {
                kind: ErrorKind::Internal,
                message: e.to_string().into(),
            })?;

        let stats = gather_result_stats(&query_result_list);

        let count = query_result_list.len();

        // calculate totals
        let (page_count, total_count) = if self.calculate_totals {
            let (total_content_count, total_repo_count, total_file_count) = tokio::try_join!(
                indexes.file.count(queries.iter(), &ContentReader),
                indexes.repo.count(queries.iter(), &RepoReader),
                indexes.file.count(queries.iter(), &FileReader),
            )
            .map_err(|e| EndpointError {
                kind: ErrorKind::Internal,
                message: e.to_string().into(),
            })?;

            // total number of results is the sum of total results per index
            let total_count = total_content_count + total_repo_count + total_file_count;

            // total pages is the number of pages required to accommodate the greatest
            // of the three results
            let page_count = {
                let max_items = total_content_count
                    .max(total_repo_count)
                    .max(total_file_count);
                div_ceil(max_items, self.page_size)
            };

            (Some(page_count), Some(total_count))
        } else {
            (None, None)
        };

        let metadata = QueryMetadata {
            page: self.page,
            page_size: self.page_size,
            page_count,
            total_count,
        };

        let data = query_result_list;

        let response = QueryResponse {
            count,
            data,
            stats,
            metadata,
        };

        Ok(response)
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ResultStats {
    pub repo: HashMap<String, usize>,
    pub lang: HashMap<String, usize>,
}

fn gather_result_stats(query_results: &[QueryResult]) -> ResultStats {
    let mut stats = ResultStats::default();
    for result in query_results.iter() {
        match result {
            QueryResult::Snippets(data) => {
                *stats.repo.entry(data.repo_name.clone()).or_insert(0) += 1;
                if let Some(l) = &data.lang {
                    *stats.lang.entry(l.clone()).or_insert(0) += 1;
                }
            }
            QueryResult::FileResult(data) => {
                *stats.repo.entry(data.repo_name.clone()).or_insert(0) += 1;
                if let Some(l) = &data.lang {
                    *stats.lang.entry(l.clone()).or_insert(0) += 1;
                }
            }
            QueryResult::RepositoryResult(data) => {
                *stats.repo.entry(data.name.text.clone()).or_insert(0) += 1;
            }

            // Open queries do not contribute to document statistics.
            QueryResult::File(..)
            | QueryResult::Directory(..)
            | QueryResult::Flag(..)
            | QueryResult::Lang(..) => {}
        }
    }
    stats
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
pub(super) struct QueryResponse {
    /// Number of search results in this response
    count: usize,
    /// Paging metadata
    metadata: QueryMetadata,
    /// Search result data
    data: Vec<QueryResult>,
    /// Stats for nerds
    stats: ResultStats,
}

/// Metadata pertaining to the query response, such as paging info
#[derive(Serialize, ToSchema)]
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
    ) -> Result<Vec<QueryResult>>;
}

#[async_trait]
impl ExecuteQuery for ContentReader {
    type Index = File;

    async fn execute(
        &self,
        indexer: &Indexer<Self::Index>,
        queries: &[parser::Query<'_>],
        q: &ApiQuery,
    ) -> Result<Vec<QueryResult>> {
        let top_docs = TopDocs::with_limit(q.limit())
            .and_offset(q.offset())
            .tweak_score(DocumentTweaker(indexer.source.clone()));
        let results = indexer.query(queries.iter(), self, top_docs).await?;
        let targets = results
            .relevant_queries
            .into_iter()
            .filter_map(|q| Some((q.target.as_ref()?, q.is_case_sensitive())))
            .collect::<SmallVec<[_; 2]>>();

        Ok(results
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
            .collect())
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
    ) -> Result<Vec<QueryResult>> {
        let top_docs = TopDocs::with_limit(q.limit()).and_offset(q.offset());
        let results = indexer.query(queries.iter(), self, top_docs).await?;
        let filter_regexes = results
            .relevant_queries
            .into_iter()
            .filter_map(|q| Some(q.path.as_ref()?.regex().expect("failed to parse regex")))
            .collect::<SmallVec<[_; 2]>>();

        Ok(results
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
            .collect())
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
    ) -> Result<Vec<QueryResult>> {
        let top_docs = TopDocs::with_limit(q.limit()).and_offset(q.offset());
        let results = indexer.query(queries.iter(), self, top_docs).await?;
        let filter_regexes = results
            .relevant_queries
            .into_iter()
            .filter_map(|q| q.repo.as_ref().and_then(|lit| lit.regex().ok()))
            .collect::<SmallVec<[_; 2]>>();

        Ok(results
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
            .collect())
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
    ) -> Result<Vec<QueryResult>> {
        let top_docs = TopDocs::with_limit(1000);
        let results = indexer.query(queries.iter(), self, top_docs).await?;

        struct Directive<'a> {
            relative_path: &'a str,
            repo_name: &'a str,
        }

        let open_directives = results
            .relevant_queries
            .iter()
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

        Ok(directories
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
            .collect())
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
