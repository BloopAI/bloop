use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf, MAIN_SEPARATOR},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};

use anyhow::{bail, Result};
use async_trait::async_trait;
use rayon::prelude::*;
use scc::hash_map::Entry;
use tantivy::{
    collector::TopDocs,
    doc,
    query::{BooleanQuery, Query, QueryParser, TermQuery},
    schema::{IndexRecordOption, Schema, Term},
    IndexWriter,
};
use tokenizers as _;
use tokio::runtime::Handle;
use tracing::{info, trace, warn};

pub use super::schema::File;

#[cfg(feature = "debug")]
use std::time::Instant;

use super::{
    reader::{ContentDocument, ContentReader, FileDocument, FileReader},
    DocumentRead, Indexable, Indexer,
};
use crate::{
    background::SyncPipes,
    cache::{FileCache, FileCacheSnapshot},
    intelligence::TreeSitterFile,
    query::compiler::{case_permutations, trigrams},
    repo::{iterator::*, RepoMetadata, RepoRef, Repository},
    symbol::SymbolLocations,
};

struct Workload<'a> {
    repo_disk_path: &'a Path,
    repo_ref: String,
    repo_name: &'a str,
    repo_metadata: &'a RepoMetadata,
    file_cache: &'a FileCache<'a>,
    cache_snapshot: &'a FileCacheSnapshot,
    dir_entry: RepoDirEntry,
}

#[async_trait]
impl Indexable for File {
    async fn index_repository(
        &self,
        reporef: &RepoRef,
        repo: &Repository,
        repo_metadata: &RepoMetadata,
        writer: &IndexWriter,
        pipes: &SyncPipes,
    ) -> Result<()> {
        let file_cache = Arc::new(FileCache::for_repo(&self.sql, reporef));
        let cache_snapshot = file_cache.retrieve().await;
        let repo_name = reporef.indexed_name();
        let processed = &AtomicU64::new(0);

        let file_worker = |count: usize| {
            let cache_snapshot = cache_snapshot.clone();
            let file_cache = file_cache.clone();
            move |dir_entry: RepoDirEntry| {
                let completed = processed.fetch_add(1, Ordering::Relaxed);
                pipes.index_percent(((completed as f32 / count as f32) * 100f32) as u8);

                let entry_disk_path = dir_entry.path().unwrap_or_default().to_owned();
                let workload = Workload {
                    repo_disk_path: &repo.disk_path,
                    repo_ref: reporef.to_string(),
                    repo_name: &repo_name,
                    file_cache: &file_cache,
                    cache_snapshot: &cache_snapshot,
                    repo_metadata,
                    dir_entry,
                };

                trace!(entry_disk_path, "queueing entry");
                if let Err(err) = self.worker(workload, writer) {
                    warn!(%err, entry_disk_path, "indexing failed; skipping");
                }
            }
        };

        let start = std::time::Instant::now();

        // If we could determine the time of the last commit, proceed
        // with a Git Walker, otherwise use a FS walker
        if repo_metadata.last_commit_unix_secs.is_some() {
            let walker = GitWalker::open_repository(
                reporef,
                &repo.disk_path,
                repo.branch_filter.as_ref().map(Into::into),
            )?;
            let count = walker.len();
            walker.for_each(pipes, file_worker(count));
        } else {
            let walker = FileWalker::index_directory(&repo.disk_path);
            let count = walker.len();
            walker.for_each(pipes, file_worker(count));
        };

        if pipes.is_cancelled() {
            bail!("cancelled");
        }

        info!(?repo.disk_path, "repo file indexing finished, took {:?}", start.elapsed());

        // files that are no longer tracked by the git index are to be removed
        // from the tantivy & qdrant indices
        let mut qdrant_remove_list = vec![];
        cache_snapshot.retain(|k, v| {
            if !v.fresh {
                writer.delete_term(Term::from_field_text(self.unique_hash, k));
                qdrant_remove_list.push(k.to_string());
            }

            v.fresh
        });

        // batch-delete points from qdrant index
        if !qdrant_remove_list.is_empty() {
            if let Some(semantic) = &self.semantic {
                let semantic = semantic.clone();
                let reporef = reporef.to_string();
                tokio::spawn(async move {
                    semantic
                        .delete_points_for_hash(reporef.as_str(), qdrant_remove_list.into_iter())
                        .await;
                });
            }
        }

        pipes.index_percent(100);
        file_cache.persist(cache_snapshot).await?;
        Ok(())
    }

    fn delete_by_repo(&self, writer: &IndexWriter, repo: &Repository) {
        writer.delete_term(Term::from_field_text(
            self.repo_disk_path,
            &repo.disk_path.to_string_lossy(),
        ));
    }

    fn schema(&self) -> Schema {
        self.schema.clone()
    }
}

impl Indexer<File> {
    /// Search this index for paths fuzzily matching a given string.
    ///
    /// For example, the string `Cargo` can return documents whose path is `foo/Cargo.toml`,
    /// or `bar/Cargo.lock`. Constructs regexes that permit an edit-distance of 2.
    ///
    /// If the regex filter fails to build, an empty list is returned.
    pub async fn fuzzy_path_match(
        &self,
        repo_ref: &RepoRef,
        query_str: &str,
        branch: Option<&str>,
        limit: usize,
    ) -> impl Iterator<Item = FileDocument> + '_ {
        // lifted from query::compiler
        let reader = self.reader.read().await;
        let searcher = reader.searcher();
        let collector = TopDocs::with_limit(100);
        let file_source = &self.source;

        // hits is a mapping between a document address and the number of trigrams in it that
        // matched the query
        let repo_ref_term = Term::from_field_text(self.source.repo_ref, &repo_ref.to_string());
        let branch_term = branch
            .map(|b| {
                trigrams(b)
                    .map(|token| Term::from_field_text(self.source.branches, token.as_str()))
                    .map(|term| TermQuery::new(term, IndexRecordOption::Basic))
                    .map(Box::new)
                    .map(|q| q as Box<dyn Query>)
                    .collect::<Vec<_>>()
            })
            .map(BooleanQuery::intersection);
        let mut hits = trigrams(query_str)
            .flat_map(|s| case_permutations(s.as_str()))
            .map(|token| Term::from_field_text(self.source.relative_path, token.as_str()))
            .map(|term| {
                let mut query: Vec<Box<dyn Query>> = vec![
                    Box::new(TermQuery::new(term, IndexRecordOption::Basic)),
                    Box::new(TermQuery::new(
                        repo_ref_term.clone(),
                        IndexRecordOption::Basic,
                    )),
                ];

                if let Some(b) = branch_term.as_ref() {
                    query.push(Box::new(b.clone()));
                };

                BooleanQuery::intersection(query)
            })
            .flat_map(|query| {
                searcher
                    .search(&query, &collector)
                    .expect("failed to search index")
                    .into_iter()
                    .map(move |(_, addr)| addr)
            })
            .fold(HashMap::new(), |mut map: HashMap<_, usize>, hit| {
                *map.entry(hit).or_insert(0) += 1;
                map
            })
            .into_iter()
            .map(move |(addr, count)| {
                let retrieved_doc = searcher
                    .doc(addr)
                    .expect("failed to get document by address");
                let doc = FileReader.read_document(file_source, retrieved_doc);
                (doc, count)
            })
            .collect::<Vec<_>>();

        // order hits in
        // - decsending order of number of matched trigrams
        // - alphabetical order of relative paths to break ties
        //
        //
        // for a list of hits like so:
        //
        //     apple.rs 2
        //     ball.rs  3
        //     cat.rs   2
        //
        // the ordering produced is:
        //
        //     ball.rs  3  -- highest number of hits
        //     apple.rs 2  -- same numeber of hits, but alphabetically preceeds cat.rs
        //     cat.rs   2
        //
        hits.sort_by(|(this_doc, this_count), (other_doc, other_count)| {
            let order_count_desc = other_count.cmp(this_count);
            let order_path_asc = this_doc
                .relative_path
                .as_str()
                .cmp(other_doc.relative_path.as_str());

            order_count_desc.then(order_path_asc)
        });

        let regex_filter = build_fuzzy_regex_filter(query_str);

        // if the regex filter fails to build for some reason, the filter defaults to returning
        // false and zero results are produced
        hits.into_iter()
            .map(|(doc, _)| doc)
            .filter(move |doc| {
                regex_filter
                    .as_ref()
                    .map(|f| f.is_match(&doc.relative_path))
                    .unwrap_or_default()
            })
            .filter(|doc| !doc.relative_path.ends_with(MAIN_SEPARATOR)) // omit directories
            .take(limit)
    }

    pub async fn by_path(
        &self,
        repo_ref: &RepoRef,
        relative_path: &str,
        branch: Option<&str>,
    ) -> Result<Option<ContentDocument>> {
        let reader = self.reader.read().await;
        let searcher = reader.searcher();

        let file_index = searcher.index();

        // query the `relative_path` field of the `File` index, using tantivy's query language
        //
        // XXX: can we use the bloop query language here instead?
        let query_parser = QueryParser::for_index(
            file_index,
            vec![self.source.repo_ref, self.source.relative_path],
        );

        let mut query_string =
            format!(r#"repo_ref:"{repo_ref}" AND relative_path:"{relative_path}""#);

        if let Some(b) = branch {
            query_string += &format!(r#" AND branches:"{b}""#);
        }

        let query = query_parser
            .parse_query(&query_string)
            .expect("failed to parse tantivy query");

        self.top_hit(query, searcher).await
    }

    async fn top_hit(
        &self,
        query: Box<dyn Query>,
        searcher: tantivy::Searcher,
    ) -> Result<Option<ContentDocument>> {
        let file_source = &self.source;

        let collector = TopDocs::with_limit(1);
        let search_results = searcher
            .search(&query, &collector)
            .expect("failed to search index");

        match search_results.as_slice() {
            // no paths matched, the input path was not well formed
            [] => Ok(None),

            // exactly one path, good
            [(_, doc_addr)] => {
                let retrieved_doc = searcher
                    .doc(*doc_addr)
                    .expect("failed to get document by address");
                Ok(Some(
                    ContentReader.read_document(file_source, retrieved_doc),
                ))
            }

            // more than one path matched, this can occur when top docs is no
            // longer limited to 1 and the index contains dupes
            _ => {
                warn!("TopDocs is not limited to 1 and index contains duplicates");
                Err(anyhow::Error::msg("multiple paths returned"))
            }
        }
    }

    // Produce all files in a repo
    //
    // TODO: Look at this again when:
    //  - directory retrieval is ready
    //  - unified referencing is ready
    pub async fn by_repo<S: AsRef<str>>(
        &self,
        repo_ref: &RepoRef,
        langs: impl Iterator<Item = S>,
        branch: Option<&str>,
    ) -> Vec<ContentDocument> {
        let reader = self.reader.read().await;
        let searcher = reader.searcher();

        let mut query = vec![];

        // repo query
        query.push(Box::new(TermQuery::new(
            Term::from_field_text(self.source.repo_ref, &repo_ref.to_string()),
            IndexRecordOption::Basic,
        )) as Box<dyn Query>);

        let branch_term = branch
            .map(|b| {
                trigrams(b)
                    .map(|token| Term::from_field_text(self.source.branches, token.as_str()))
                    .map(|term| TermQuery::new(term, IndexRecordOption::Basic))
                    .map(Box::new)
                    .map(|q| q as Box<dyn Query>)
                    .collect::<Vec<_>>()
            })
            .map(BooleanQuery::intersection);
        if let Some(b) = branch_term {
            query.push(Box::new(b) as Box<dyn Query>);
        };

        query.push({
            let queries = langs
                .map(|lang| {
                    Box::new(TermQuery::new(
                        Term::from_field_bytes(
                            self.source.lang,
                            lang.as_ref().to_ascii_lowercase().as_bytes(),
                        ),
                        IndexRecordOption::Basic,
                    )) as Box<dyn Query>
                })
                .collect::<Vec<_>>();
            Box::new(BooleanQuery::union(queries))
        });

        let query = BooleanQuery::intersection(query);
        let collector = TopDocs::with_limit(500);
        searcher
            .search(&query, &collector)
            .expect("failed to search index")
            .into_par_iter()
            .map(|(_, doc_addr)| {
                let retrieved_doc = searcher
                    .doc(doc_addr)
                    .expect("failed to get document by address");
                ContentReader.read_document(&self.source, retrieved_doc)
            })
            .collect()
    }
}

impl File {
    #[tracing::instrument(fields(repo=%workload.repo_ref, entry_disk_path=?workload.dir_entry.path()), skip_all)]
    fn worker(&self, workload: Workload<'_>, writer: &IndexWriter) -> Result<()> {
        let Workload {
            repo_ref,
            repo_disk_path,
            repo_name,
            repo_metadata,
            file_cache,
            cache_snapshot,
            dir_entry,
        } = workload;

        #[cfg(feature = "debug")]
        let start = Instant::now();
        trace!("processing file");

        let relative_path = {
            let entry_srcpath = PathBuf::from(dir_entry.path().ok_or(anyhow::anyhow!(
                "dir entry is not a valid file or directory"
            ))?);
            entry_srcpath
                .strip_prefix(repo_disk_path)
                .map(ToOwned::to_owned)
                .unwrap_or(entry_srcpath)
        };
        let entry_pathbuf = repo_disk_path.join(&relative_path);

        let semantic_hash = {
            let mut hash = blake3::Hasher::new();
            hash.update(crate::state::SCHEMA_VERSION.as_bytes());
            hash.update(relative_path.to_string_lossy().as_ref().as_ref());
            hash.update(repo_ref.as_bytes());
            hash.update(dir_entry.buffer().unwrap_or_default().as_bytes());
            hash.finalize().to_hex().to_string()
        };

        let tantivy_hash = {
            let branch_list = dir_entry.branches().unwrap_or_default();
            let mut hash = blake3::Hasher::new();
            hash.update(semantic_hash.as_ref());
            hash.update(branch_list.join("\n").as_bytes());
            hash.finalize().to_hex().to_string()
        };

        let last_commit = repo_metadata.last_commit_unix_secs.unwrap_or(0);

        match dir_entry {
            _ if is_cache_fresh(cache_snapshot, &tantivy_hash, &entry_pathbuf) => {
                info!("fresh; skipping");
                return Ok(());
            }
            RepoDirEntry::Dir(dir) => {
                trace!("writing dir document");
                let doc = dir.build_document(
                    self,
                    repo_name,
                    relative_path.as_path(),
                    repo_disk_path,
                    repo_ref.as_str(),
                    last_commit,
                    tantivy_hash,
                );
                writer.add_document(doc)?;
                trace!("dir document written");
            }
            RepoDirEntry::File(file) => {
                trace!("writing file document");
                let doc = file
                    .build_document(
                        self,
                        repo_name,
                        relative_path.as_path(),
                        repo_disk_path,
                        semantic_hash,
                        tantivy_hash,
                        entry_pathbuf.as_path(),
                        repo_ref.as_str(),
                        last_commit,
                        repo_metadata,
                        file_cache,
                    )
                    .ok_or(anyhow::anyhow!("failed to build document"))?;
                writer.add_document(doc)?;

                trace!("file document written");
            }
            RepoDirEntry::Other => anyhow::bail!("dir entry was neither a file nor a directory"),
        }

        #[cfg(feature = "debug")]
        {
            let elapsed = start.elapsed();
            let time: u64 = elapsed
                .as_millis()
                .try_into()
                .expect("nobody waits this long");
            self.histogram.write().unwrap().increment(time, 1).unwrap();

            if time
                > self
                    .histogram
                    .read()
                    .unwrap()
                    .percentile(99.9)
                    .unwrap()
                    .low()
            {
                // default console formatter is different when we're debugging. need to print more info here.
                warn!(?relative_path, ?elapsed, "file took too long to process")
            }
        }

        Ok(())
    }
}

impl RepoDir {
    #[allow(clippy::too_many_arguments)]
    fn build_document(
        self,
        schema: &File,
        repo_name: &str,
        relative_path: &Path,
        repo_disk_path: &Path,
        repo_ref: &str,
        last_commit: u64,
        tantivy_cache_key: String,
    ) -> tantivy::schema::Document {
        let relative_path_str = format!("{}{MAIN_SEPARATOR}", relative_path.to_string_lossy());

        let branches = self.branches.join("\n");

        doc!(
                schema.raw_repo_name => repo_name.as_bytes(),
                schema.raw_relative_path => relative_path_str.as_bytes(),
                schema.repo_disk_path => repo_disk_path.to_string_lossy().as_ref(),
                schema.relative_path => relative_path_str,
                schema.repo_ref => repo_ref,
                schema.repo_name => repo_name,
                schema.last_commit_unix_seconds => last_commit,
                schema.branches => branches,
                schema.is_directory => true,
                schema.unique_hash => tantivy_cache_key,

                // nulls
                schema.raw_content => Vec::<u8>::default(),
                schema.content => String::default(),
                schema.line_end_indices => Vec::<u8>::default(),
                schema.lang => Vec::<u8>::default(),
                schema.avg_line_length => f64::default(),
                schema.symbol_locations => bincode::serialize(&SymbolLocations::default()).unwrap(),
                schema.symbols => String::default(),
        )
    }
}

impl RepoFile {
    #[allow(clippy::too_many_arguments)]
    fn build_document(
        mut self,
        schema: &File,
        repo_name: &str,
        relative_path: &Path,
        repo_disk_path: &Path,
        semantic_cache_key: String,
        tantivy_cache_key: String,
        entry_pathbuf: &Path,
        repo_ref: &str,
        last_commit: u64,
        repo_metadata: &RepoMetadata,
        file_cache: &FileCache,
    ) -> Option<tantivy::schema::Document> {
        let relative_path_str = relative_path.to_string_lossy().to_string();
        let branches = self.branches.join("\n");
        let lang_str = repo_metadata
            .langs
            .get(entry_pathbuf, self.buffer.as_ref())
            .unwrap_or_else(|| {
                warn!(?entry_pathbuf, "Path not found in language map");
                ""
            });

        let symbol_locations = {
            // build a syntax aware representation of the file
            let scope_graph = TreeSitterFile::try_build(self.buffer.as_bytes(), lang_str)
                .and_then(TreeSitterFile::scope_graph);

            match scope_graph {
                // we have a graph, use that
                Ok(graph) => SymbolLocations::TreeSitter(graph),
                // no graph, it's empty
                Err(err) => {
                    warn!(?err, %lang_str, "failed to build scope graph");
                    SymbolLocations::Empty
                }
            }
        };

        // flatten the list of symbols into a string with just text
        let symbols = symbol_locations
            .list()
            .iter()
            .map(|sym| self.buffer[sym.range.start.byte..sym.range.end.byte].to_owned())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>()
            .join("\n");

        // add an NL if this file is not NL-terminated
        if !self.buffer.ends_with('\n') {
            self.buffer += "\n";
        }

        let line_end_indices = self
            .buffer
            .match_indices('\n')
            .flat_map(|(i, _)| u32::to_le_bytes(i as u32))
            .collect::<Vec<_>>();

        // Skip files that are too long. This is not necessarily caught in the filesize check, e.g.
        // for a file like `vocab.txt` which has thousands of very short lines.
        if line_end_indices.len() > MAX_LINE_COUNT as usize {
            return None;
        }

        let lines_avg = self.buffer.len() as f64 / self.buffer.lines().count() as f64;

        if let Some(semantic) = &schema.semantic {
            tokio::task::block_in_place(|| {
                Handle::current().block_on(async {
                    semantic
                        .insert_points_for_buffer(
                            repo_name,
                            repo_ref,
                            &relative_path_str,
                            &self.buffer,
                            lang_str,
                            &self.branches,
                            file_cache.chunks_for_file(&semantic_cache_key).await,
                        )
                        .await
                })
            });
        }

        Some(doc!(
            schema.raw_content => self.buffer.as_bytes(),
            schema.raw_repo_name => repo_name.as_bytes(),
            schema.raw_relative_path => relative_path_str.as_bytes(),
            schema.unique_hash => tantivy_cache_key,
            schema.repo_disk_path => repo_disk_path.to_string_lossy().as_ref(),
            schema.relative_path => relative_path_str,
            schema.repo_ref => repo_ref,
            schema.repo_name => repo_name,
            schema.content => self.buffer,
            schema.line_end_indices => line_end_indices,
            schema.lang => lang_str.to_ascii_lowercase().as_bytes(),
            schema.avg_line_length => lines_avg,
            schema.last_commit_unix_seconds => last_commit,
            schema.symbol_locations => bincode::serialize(&symbol_locations).unwrap(),
            schema.symbols => symbols,
            schema.branches => branches,
            schema.is_directory => false,
        ))
    }
}

#[tracing::instrument(skip(cache))]
fn is_cache_fresh(cache: &FileCacheSnapshot, unique_hash: &str, entry_pathbuf: &PathBuf) -> bool {
    match cache.entry(unique_hash.into()) {
        Entry::Occupied(mut val) => {
            // skip processing if contents are up-to-date in the cache
            val.get_mut().fresh = true;

            trace!("cache hit");
            return true;
        }
        Entry::Vacant(val) => {
            _ = val.insert_entry(().into());
        }
    }

    trace!("cache miss");
    false
}

fn build_fuzzy_regex_filter(query_str: &str) -> Option<regex::RegexSet> {
    fn additions(s: &str, i: usize, j: usize) -> String {
        if i > j {
            additions(s, j, i)
        } else {
            let mut s = s.to_owned();
            s.insert_str(j, ".?");
            s.insert_str(i, ".?");
            s
        }
    }

    fn replacements(s: &str, i: usize, j: usize) -> String {
        if i > j {
            replacements(s, j, i)
        } else {
            let mut s = s.to_owned();
            s.remove(j);
            s.insert_str(j, ".?");

            s.remove(i);
            s.insert_str(i, ".?");

            s
        }
    }

    fn one_of_each(s: &str, i: usize, j: usize) -> String {
        if i > j {
            one_of_each(s, j, i)
        } else {
            let mut s = s.to_owned();
            s.remove(j);
            s.insert_str(j, ".?");

            s.insert_str(i, ".?");
            s
        }
    }

    let all_regexes = (query_str.char_indices().map(|(idx, _)| idx))
        .flat_map(|i| (query_str.char_indices().map(|(idx, _)| idx)).map(move |j| (i, j)))
        .filter(|(i, j)| i <= j)
        .flat_map(|(i, j)| {
            let mut v = vec![];
            if j != query_str.len() {
                v.push(one_of_each(query_str, i, j));
                v.push(replacements(query_str, i, j));
            }
            v.push(additions(query_str, i, j));
            v
        });

    regex::RegexSetBuilder::new(all_regexes)
        // Increased from the default to account for long paths. At the time of writing,
        // the default was `10 * (1 << 20)`.
        .size_limit(10 * (1 << 25))
        .case_insensitive(true)
        .build()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fuzzy_multibyte_should_compile() {
        let multibyte_str = "查询解析器在哪";
        let filter = build_fuzzy_regex_filter(multibyte_str);
        assert!(filter.is_some());

        // tests removal of second character
        assert!(filter.as_ref().unwrap().is_match("查解析器在哪"));

        // tests replacement of second character with `n`
        assert!(filter.as_ref().unwrap().is_match("查n析器在哪"));

        // tests addition of character `n`
        assert!(filter.as_ref().unwrap().is_match("查询解析器在哪n"));
    }
}
