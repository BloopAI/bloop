use std::{
    collections::{HashMap, HashSet},
    path::MAIN_SEPARATOR,
    sync::Arc,
};

use super::{parser, ranking::DocumentTweaker};
use crate::{
    collector::{BytesFilterCollector, FrequencyCollector},
    indexes::{
        reader::{base_name, ContentReader, FileReader, OpenReader, RepoReader},
        DocumentRead, File, Indexable, Indexer, Indexes, Repo,
    },
    snippet::{HighlightedString, SnippedFile, Snipper},
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
    repo_ref: String,
    lang: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct FileData {
    repo_name: String,
    relative_path: String,
    repo_ref: String,
    lang: Option<String>,
    contents: String,
    siblings: Vec<DirEntry>,
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

impl ApiQuery {
    pub async fn query(self: Arc<Self>, indexes: Arc<Indexes>) -> Result<QueryResponse> {
        let query = self.q.clone();
        let compiled = parser::parse(&query)?;
        self.query_with(indexes, compiled).await
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
                return ContentReader.execute(&indexes.file, &queries, &self).await;
            } else if RepoReader.query_matches(q) {
                return RepoReader.execute(&indexes.repo, &queries, &self).await;
            } else if FileReader.query_matches(q) {
                return FileReader.execute(&indexes.file, &queries, &self).await;
            } else if OpenReader.query_matches(q) {
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
                let case_insensitive = !q.case_sensitive.unwrap_or(true);
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
                let regex_str = q.path.as_ref()?.regex_str();
                let case_insensitive = !q.case_sensitive.unwrap_or(true);
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

        let top_docs = TopDocs::with_limit(50000);
        let empty_collector = MultiCollector::new();

        let relative_paths = open_directives
            .iter()
            .map(|d| d.relative_path.to_owned())
            .collect::<Vec<_>>();

        let collector = BytesFilterCollector::new(
            indexer.source.raw_relative_path,
            move |b| {
                let Ok(relative_path) = std::str::from_utf8(b) else {
                    return false;
                };

                // Check if *any* of the relative paths match. We can't compare repositories here
                // because the `BytesFilterCollector` operates on one field. So we sort through this
                // later. It's unlikely that a search will use more than one open query.
                relative_paths.iter().any(|rp| {
                    let rp = rp.trim_end_matches(|c| c != MAIN_SEPARATOR);

                    matches!(
                        // Trim trailing suffix and avoid returning results for an empty string
                        // (this means that the document we are looking at is the folder itself; a
                        // redundant result).
                        relative_path.strip_prefix(rp).map(|p| p.trim_end_matches(MAIN_SEPARATOR)),
                        Some(p) if !p.is_empty() && !p.contains(MAIN_SEPARATOR)
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
