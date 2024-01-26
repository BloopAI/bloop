use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use super::{parser, ranking::DocumentTweaker};
use crate::{
    collector::{BytesFilterCollector, FrequencyCollector},
    indexes::{
        reader::{base_name, ContentReader, FileReader, OpenReader, RepoReader},
        DocumentRead, File, Indexable, Indexer, Indexes, Repo,
    },
    repo::RepoRef,
    snippet::{HighlightedString, SnippedFile, Snipper},
    Application,
};

use anyhow::{bail, Result};
use async_trait::async_trait;
use regex::{bytes::RegexBuilder as ByteRegexBuilder, RegexBuilder};
use serde::{Deserialize, Serialize};
use smallvec::SmallVec;
use tantivy::collector::{MultiCollector, TopDocs};

const fn default_page_size() -> usize {
    100
}

const fn default_context() -> usize {
    1
}

const fn default_true() -> bool {
    true
}

// FIXME: use usize::div_ceil soon
fn div_ceil(a: usize, b: usize) -> usize {
    let d = a / b;
    let r = a % b;
    d + usize::from(r > 0)
}

#[derive(Debug, Deserialize)]
pub struct ApiQuery {
    /// A query written in the bloop query language
    pub q: String,

    /// Project ID.
    // NB: We implement methods directly on this struct, which need access to the project ID
    // associated with this request. This doesn't fit our API; we obtain the project ID via the
    // router and not via URL query parameters. The abstraction here likely needs to be reworked a
    // bit, as this can be improved. For now, we just add a skipped field, and manually set it
    // after deserialization. TODO: Fix this.
    #[serde(skip)]
    pub project_id: i64,

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
    pub context_before: usize,

    /// The number of lines of context in the snippet after the search result
    #[serde(alias = "ca", default = "default_context")]
    pub context_after: usize,
}

#[derive(Serialize)]
pub struct QueryResponse {
    /// Number of search results in this response
    pub count: usize,
    /// Paging metadata
    pub(crate) metadata: PagingMetadata,
    /// Search result data
    pub data: Vec<QueryResult>,
    /// Stats for nerds
    pub stats: ResultStats,
}

impl crate::webserver::ApiResponse for QueryResponse {}

/// Metadata pertaining to the query response, such as paging info
#[derive(Default, Serialize)]
#[non_exhaustive]
pub struct PagingMetadata {
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

#[derive(Serialize)]
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

#[derive(Serialize)]
pub struct RepositoryResultData {
    name: HighlightedString,
    repo_ref: String,
}

#[derive(Serialize)]
pub struct FileResultData {
    repo_name: String,
    relative_path: HighlightedString,
    repo_ref: RepoRef,
    lang: Option<String>,
    branches: String,
    indexed: bool,
    is_dir: bool,
}

impl FileResultData {
    pub fn new(
        repo_name: String,
        relative_path: String,
        repo_ref: RepoRef,
        lang: Option<String>,
        branches: String,
        indexed: bool,
        is_dir: bool,
    ) -> Self {
        Self {
            repo_name,
            relative_path: HighlightedString::new(relative_path),
            repo_ref,
            lang,
            branches,
            indexed,
            is_dir,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct FileData {
    repo_name: String,
    relative_path: String,
    repo_ref: String,
    lang: Option<String>,
    contents: String,
    siblings: Vec<DirEntry>,
    indexed: bool,
    size: usize,
    loc: usize,
    sloc: usize,
}

#[derive(Serialize)]
pub struct DirectoryData {
    repo_name: String,
    relative_path: String,
    repo_ref: String,
    entries: Vec<DirEntry>,
}

#[derive(Serialize, PartialEq, Eq, Hash, Clone, Debug)]
pub struct DirEntry {
    name: String,
    entry_data: EntryData,
}

#[derive(Serialize, PartialEq, Eq, Hash, Clone, Debug)]
enum EntryData {
    Directory,
    File { lang: Option<String>, indexed: bool },
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

impl ApiQuery {
    pub async fn query(self: Arc<Self>, app: &Application) -> Result<QueryResponse> {
        let raw_query = self.q.clone();
        let queries = self
            .restrict_queries(parser::parse(&raw_query)?, app)
            .await?;
        tracing::debug!("compiled query as {queries:?}");
        self.query_with(Arc::clone(&app.indexes), queries).await
    }

    /// This restricts a set of input parser queries.
    ///
    /// We trim down the input by:
    ///
    /// 1. Discarding all queries that reference repos not in the queried project
    /// 2. Regenerating more specific queries for those without repo restrictions, such that there
    ///    is a new query generated per repo that exists in the project.
    ///
    /// The idea here is to allow us to restrict the possible input space of queried documents to
    /// be more specific as required by the project state.
    ///
    /// The `subset` flag indicates whether repo name matching is whole-string, or whether the
    /// string must only be a substring of an existing repo. This is useful in autocomplete
    /// scenarios, where we want to restrict queries such that they are not fully typed out.
    pub async fn restrict_queries<'a>(
        &self,
        queries: impl IntoIterator<Item = parser::Query<'a>>,
        app: &Application,
    ) -> Result<Vec<parser::Query<'a>>> {
        let repo_branches = sqlx::query! {
            "SELECT repo_ref, branch
            FROM project_repos
            WHERE project_id = ?",
            self.project_id,
        }
        .fetch_all(&*app.sql)
        .await?
        .into_iter()
        .map(|row| {
            (
                row.repo_ref.parse::<RepoRef>().unwrap().indexed_name(),
                row.branch,
            )
        })
        .collect::<HashMap<_, _>>();

        let mut out = Vec::new();

        for q in queries {
            if let Some(r) = q.repo_str() {
                // The branch that this project has loaded this repo with.
                let project_branch = repo_branches.get(&r).and_then(Option::as_ref);

                // If the branch doesn't match what we expect, drop the query.
                if q.branch_str().as_ref() == project_branch {
                    out.push(q);
                }
            } else {
                for (r, b) in &repo_branches {
                    out.push(parser::Query {
                        repo: Some(parser::Literal::from(r)),
                        branch: b.as_ref().map(parser::Literal::from),
                        ..q.clone()
                    });
                }
            }
        }

        Ok(out)
    }

    /// This restricts a set of input repo-only queries.
    ///
    /// This is useful for autocomplete queries, which are effectively just `repo:foo`, where the
    /// repo name may be partially written.
    pub async fn restrict_repo_queries<'a>(
        &self,
        queries: impl IntoIterator<Item = parser::Query<'a>>,
        app: &Application,
    ) -> Result<Vec<parser::Query<'a>>> {
        let repo_refs = sqlx::query! {
            "SELECT repo_ref
            FROM project_repos
            WHERE project_id = ?",
            self.project_id,
        }
        .fetch_all(&*app.sql)
        .await?
        .into_iter()
        .map(|row| row.repo_ref.parse::<RepoRef>().unwrap().indexed_name())
        .collect::<Vec<_>>();

        let mut out = Vec::new();

        for q in queries {
            if let Some(r) = q.repo_str() {
                for m in repo_refs.iter().filter(|r2| r2.contains(&r)) {
                    out.push(parser::Query {
                        repo: Some(parser::Literal::from(m)),
                        ..Default::default()
                    });
                }
            }
        }

        out.dedup();

        Ok(out)
    }

    pub async fn query_with(
        self: Arc<Self>,
        indexes: Arc<Indexes>,
        queries: Vec<parser::Query<'_>>,
    ) -> Result<QueryResponse> {
        // FIXME: this for-loop prevents us from ever producing heterogenous
        // results.
        //
        // It picks up the first query in the query list and produces results only
        // for that query. A query containing an `or` operator; such as:
        //
        //     symbol:foo or repo:bar
        //
        //
        // is actually broken down into two separate queries:
        //
        //  - `symbol:foo` which operates on the `File` index
        //  - `repo:bar` which operates on the `Repo` index
        //
        // However, merging the results of a query that operates on multiple indices
        // poses a few difficult questions:
        //
        //  - how do we implement pagination or establish a limit on the number of
        //    results?
        //  - how do we rank these results?
        //
        // For the time-being, we take the easy way out by prioritizing the first
        // target of the query, in this case `symbol:foo`. Queries that produce
        // homogenous results will work as expected: `repo:foo or repo:bar`.
        for q in &queries {
            if ContentReader.query_matches(q) {
                tracing::trace!("executing with ContentReader");
                return ContentReader.execute(&indexes.file, &queries, &self).await;
            } else if RepoReader.query_matches(q) {
                tracing::trace!("executing with RepoReader");
                return RepoReader.execute(&indexes.repo, &queries, &self).await;
            } else if FileReader.query_matches(q) {
                tracing::trace!("executing with FileReader");
                return FileReader.execute(&indexes.file, &queries, &self).await;
            } else if OpenReader.query_matches(q) {
                tracing::trace!("executing with OpenReader");
                return OpenReader.execute(&indexes.file, &queries, &self).await;
            }
        }

        bail!("mangled query")
    }

    fn limit(&self) -> usize {
        // do not permit a page-size of 0
        self.page_size.max(1)
    }

    fn offset(&self) -> usize {
        self.page_size * self.page
    }
}

impl PagingMetadata {
    pub fn new(page: usize, page_size: usize, total_count: Option<usize>) -> Self {
        Self {
            page,
            page_size,
            page_count: total_count.map(|t| div_ceil(t, page_size)),
            total_count,
        }
    }
}

impl ResultStats {
    fn with_lang_freqs(mut self, mut lang_freqs: HashMap<Vec<u8>, usize>) -> Self {
        self.lang = lang_freqs
            .iter_mut()
            .filter(|(k, _)| !k.is_empty())
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
            .filter(|(k, _)| !k.is_empty())
            .map(|(k, v)| {
                let k = String::from_utf8_lossy(k).to_string();
                (k, *v)
            })
            .collect();
        self
    }
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
            move |b| byte_regexes.iter().any(|r| r.is_match(b)), // a doc is accepted if it contains at least 1 target
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

        let metadata = PagingMetadata::new(q.page, q.page_size, Some(total_count));

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

#[async_trait]
impl ExecuteQuery for FileReader {
    type Index = File;

    async fn execute(
        &self,
        indexer: &Indexer<File>,
        queries: &[parser::Query<'_>],
        q: &ApiQuery,
    ) -> Result<QueryResponse> {
        let (filter_regexes, byte_filter_regexes): (Vec<_>, Vec<_>) = queries
            .iter()
            .filter(|q| self.query_matches(q))
            .filter_map(|q| {
                let regex_str = q.path.as_ref()?.regex_str();
                let case_insensitive = !q.is_case_sensitive();
                let regex = RegexBuilder::new(&regex_str)
                    .case_insensitive(case_insensitive)
                    .build()
                    .ok()?;
                let byte_regex = ByteRegexBuilder::new(&regex_str)
                    .case_insensitive(case_insensitive)
                    .build()
                    .ok()?;
                Some((regex, byte_regex))
            })
            .unzip();

        let top_k = TopDocs::with_limit(q.limit()).and_offset(q.offset());

        let path_field = indexer.source.raw_relative_path;
        let repo_field = indexer.source.raw_repo_name;
        let lang_field = indexer.source.lang;

        let total_count_collector = tantivy::collector::Count;
        let lang_stats_collector = FrequencyCollector(lang_field);
        let repo_stats_collector = FrequencyCollector(repo_field);

        let mut metadata_collector = MultiCollector::new();
        let total_count_handle = metadata_collector.add_collector(total_count_collector);
        let lang_stats_handle = metadata_collector.add_collector(lang_stats_collector);
        let repo_stats_handle = metadata_collector.add_collector(repo_stats_collector);

        let collector = BytesFilterCollector::new(
            path_field,
            move |b| byte_filter_regexes.iter().any(|r| r.is_match(b)), // a doc is accepted if it contains at least 1 target
            (top_k, metadata_collector),
        );

        let mut results = indexer.query(queries.iter(), self, collector).await?;

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
                    branches: f.branches,
                    indexed: f.indexed,
                    is_dir: f.is_dir,
                })
            })
            .collect::<Vec<QueryResult>>();

        let total_count = total_count_handle.extract(&mut results.metadata);

        let stats = ResultStats::default()
            .with_lang_freqs(lang_stats_handle.extract(&mut results.metadata))
            .with_repo_freqs(repo_stats_handle.extract(&mut results.metadata));

        let metadata = PagingMetadata::new(q.page, q.page_size, Some(total_count));

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
        let (filter_regexes, byte_filter_regexes): (Vec<_>, Vec<_>) = queries
            .iter()
            .filter(|q| self.query_matches(q))
            .filter_map(|q| {
                let regex_str = q.repo.as_ref()?.regex_str();
                let case_insensitive = !q.is_case_sensitive();
                let regex = RegexBuilder::new(&regex_str)
                    .case_insensitive(case_insensitive)
                    .build()
                    .ok()?;
                let byte_regex = ByteRegexBuilder::new(&regex_str)
                    .case_insensitive(case_insensitive)
                    .build()
                    .ok()?;
                Some((regex, byte_regex))
            })
            .unzip();

        let top_k = TopDocs::with_limit(q.limit()).and_offset(q.offset());

        let name_field = indexer.source.raw_name;
        let repo_stats_collector = FrequencyCollector(name_field);
        let total_count_collector = tantivy::collector::Count;

        let mut metadata_collector = MultiCollector::new();
        let repo_stats_handle = metadata_collector.add_collector(repo_stats_collector);
        let total_count_handle = metadata_collector.add_collector(total_count_collector);

        let collector = BytesFilterCollector::new(
            name_field,
            move |b| byte_filter_regexes.iter().any(|r| r.is_match(b)), // a doc is accepted if it contains at least 1 target
            (top_k, metadata_collector),
        );

        let mut results = indexer.query(queries.iter(), self, collector).await?;

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
        let metadata = PagingMetadata::new(q.page, q.page_size, Some(total_count));

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
        #[derive(Debug)]
        struct Directive {
            relative_path: String,
            repo_name: String,
        }

        let open_directives = queries
            .iter()
            .filter(|q| self.query_matches(q))
            .filter_map(|q| {
                Some(Directive {
                    relative_path: match q.path.as_ref() {
                        None => "".into(),
                        Some(parser::Literal::Plain(p)) => p.to_string(),
                        Some(parser::Literal::Regex(..)) => return None,
                    },
                    repo_name: q.repo.as_ref()?.as_plain()?.into(),
                })
            })
            .collect::<SmallVec<[_; 2]>>();

        let top_docs = TopDocs::with_limit(50000);
        let empty_collector = MultiCollector::new();

        let relative_paths = open_directives
            .iter()
            .map(|d| d.relative_path.to_owned())
            .collect::<Vec<_>>();

        tracing::trace!(?relative_paths, "creating collector");

        let collector = BytesFilterCollector::new(
            indexer.source.raw_relative_path,
            move |b| {
                let Ok(relative_path) = std::str::from_utf8(b) else {
                    return false;
                };

                tracing::trace!(?relative_path, "filtering relative path");

                // Check if *any* of the relative paths match. We can't compare repositories here
                // because the `BytesFilterCollector` operates on one field. So we sort through this
                // later. It's unlikely that a search will use more than one open query.
                relative_paths.iter().any(|rp| {
                    let rp = rp.trim_end_matches(|c| c != '/');

                    matches!(
                        // Trim trailing suffix and avoid returning results for an empty string
                        // (this means that the document we are looking at is the folder itself; a
                        // redundant result).
                        relative_path.strip_prefix(rp).map(|p| p.trim_end_matches('/')),
                        Some(p) if !p.is_empty() && !p.contains('/')
                    )
                })
            },
            (top_docs, empty_collector),
        );

        let results = indexer.query(queries.iter(), self, collector).await?;

        // Map of (repo_name, relative_path) -> (String, entry set)
        //
        // This is used to build up the directory and file return values.
        let mut dir_entries: HashMap<(&str, &str), (String, HashSet<DirEntry>)> = HashMap::new();

        // List of files that should be returned.
        let mut files = Vec::new();
        // Set of (repo_name, relative_path) that should be returned.
        let directories = open_directives
            .iter()
            .filter(|d| d.relative_path.is_empty() || d.relative_path.ends_with('/'))
            .map(|d| (&d.repo_name, &d.relative_path))
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
                        size: doc.content.len(),
                        loc: doc.line_end_indices.len(),
                        indexed: doc.indexed,
                        sloc: doc
                            .line_end_indices
                            .iter()
                            .zip(doc.line_end_indices.iter().skip(1))
                            .filter(|(&prev, &next)| next - prev != 1)
                            .count()
                            .saturating_add(1),
                        siblings: vec![],
                    });

                    continue;
                }

                let relative_path = base_name(&directive.relative_path);

                if let Some(entry) = doc
                    .relative_path
                    .strip_prefix(relative_path)
                    .and_then(|s| s.split_inclusive('/').next())
                {
                    dir_entries
                        .entry((&directive.repo_name, relative_path))
                        .or_insert_with(|| (doc.repo_ref.to_owned(), HashSet::default()))
                        .1
                        .insert(DirEntry {
                            name: entry.to_owned(),
                            entry_data: if entry.contains('/') {
                                EntryData::Directory
                            } else {
                                EntryData::File {
                                    lang: doc.lang.clone(),
                                    indexed: doc.indexed,
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
            .filter_map(|(repo_name, relative_path)| {
                let (repo_ref, entries) = dir_entries.get(&(repo_name, relative_path))?;

                Some(DirectoryData {
                    repo_name: repo_name.to_owned(),
                    relative_path: relative_path.to_owned(),
                    repo_ref: repo_ref.clone(),
                    entries: entries.iter().cloned().collect(),
                })
            })
            .map(QueryResult::Directory)
            .chain(files.into_iter().map(QueryResult::File))
            .collect::<Vec<QueryResult>>();

        let response = QueryResponse {
            count: data.len(),
            data,
            metadata: PagingMetadata::default(),
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
                    "data": r"        mut writer: IndexWriter,\n        _threads: usize,\n    ) -> Result<()> {",
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
                    data: r"        mut writer: IndexWriter,\n        _threads: usize,\n    ) -> Result<()> {".to_owned(),
                    line_range: 49..51,
                    highlights: vec![51..56],
                    symbols: vec![],
                }],
            })],
            metadata: PagingMetadata {
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
