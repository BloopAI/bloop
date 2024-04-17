use std::{
    collections::HashSet,
    panic::AssertUnwindSafe,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

use anyhow::{bail, Result};
use async_trait::async_trait;
use rayon::prelude::*;
use tantivy::{
    collector::TopDocs,
    doc,
    query::{BooleanQuery, Query, QueryParser, TermQuery},
    schema::{IndexRecordOption, Schema, Term},
    IndexWriter,
};
use tokenizers as _;
use tokio::runtime::Handle;
use tracing::{error, info, trace, warn};

pub use super::{
    analytics::{StatsGatherer, WorkerStats},
    schema::File,
};

#[cfg(feature = "debug")]
use std::time::Instant;

use super::{
    reader::{ContentDocument, ContentReader, FileDocument, FileReader},
    DocumentRead, Indexable, Indexer,
};
use crate::{
    background::SyncHandle,
    cache::{CacheKeys, FileCache, FileCacheSnapshot},
    intelligence::TreeSitterFile,
    query::compiler::{case_permutations, trigrams},
    repo::{iterator::*, RepoMetadata, RepoRef, Repository},
    symbol::SymbolLocations,
};

struct Workload<'a> {
    cache: &'a FileCacheSnapshot<'a>,
    file_filter: &'a FileFilter,
    repo_ref: &'a RepoRef,
    repo_disk_path: &'a Path,
    repo_name: &'a str,
    repo_metadata: &'a RepoMetadata,
    relative_path: PathBuf,
    normalized_path: PathBuf,
    stats_tx: tokio::sync::mpsc::UnboundedSender<WorkerStats>,
}

impl<'a> Workload<'a> {
    fn cache_keys(&self, dir_entry: &RepoDirEntry) -> CacheKeys {
        let semantic_hash = {
            let mut hash = blake3::Hasher::new();
            hash.update(crate::state::SCHEMA_VERSION.as_bytes());
            hash.update(self.relative_path.to_string_lossy().as_ref().as_ref());
            hash.update(self.repo_ref.to_string().as_bytes());
            hash.update(dir_entry.buffer().unwrap_or_default().as_bytes());
            hash.update(
                self.file_filter
                    .is_allowed(&self.relative_path)
                    .map(|include| {
                        if include {
                            &b"__filter_override_include"[..]
                        } else {
                            &b"__filter_override_exclude"[..]
                        }
                    })
                    .unwrap_or(&b"__no_filter_override"[..]),
            );
            hash.finalize().to_hex().to_string()
        };

        let tantivy_hash = {
            let branch_list = dir_entry.branches();
            let mut hash = blake3::Hasher::new();
            hash.update(semantic_hash.as_ref());
            hash.update(branch_list.join("\n").as_bytes());
            hash.finalize().to_hex().to_string()
        };

        CacheKeys::new(semantic_hash, tantivy_hash)
    }

    fn transmit_stats(&self, stats: WorkerStats) {
        if let Err(e) = self.stats_tx.send(stats) {
            warn!("failed to transmit worker stats: {e}");
        }
    }
}

#[async_trait]
impl Indexable for File {
    async fn index_repository(
        &self,
        SyncHandle {
            ref reporef,
            ref file_cache,
            ref pipes,
            ref app,
            ..
        }: &SyncHandle,
        repo: &Repository,
        repo_metadata: &RepoMetadata,
        writer: &IndexWriter,
    ) -> Result<()> {
        let file_filter = FileFilter::compile(&repo.file_filter)?;
        let cache = file_cache.retrieve(reporef).await;
        let repo_name = reporef.indexed_name();
        let processed = &AtomicU64::new(0);
        let mut stats_gatherer = StatsGatherer::for_repo(reporef.clone());
        stats_gatherer.is_first_index = cache.is_empty();
        stats_gatherer.was_index_reset = app.indexes.was_index_reset;

        let worker_stats_tx = stats_gatherer.sender();
        let file_worker = |count: usize| {
            let cache = &cache;
            let callback = move |dir_entry: RepoDirEntry| {
                let completed = processed.fetch_add(1, Ordering::Relaxed);
                pipes.index_percent(((completed as f32 / count as f32) * 100f32) as u8);

                let worker_stats_tx = worker_stats_tx.clone();
                let entry_disk_path = dir_entry.path().to_owned();
                let relative_path = {
                    let entry_srcpath = PathBuf::from(&entry_disk_path);
                    entry_srcpath
                        .strip_prefix(&repo.disk_path)
                        .map(ToOwned::to_owned)
                        .unwrap_or(entry_srcpath)
                };
                let normalized_path = repo.disk_path.join(&relative_path);

                let workload = Workload {
                    repo_disk_path: &repo.disk_path,
                    repo_name: &repo_name,
                    file_filter: &file_filter,
                    repo_ref: reporef,
                    relative_path,
                    normalized_path,
                    repo_metadata,
                    cache,
                    stats_tx: worker_stats_tx,
                };

                trace!(entry_disk_path, "queueing entry");

                if let Err(err) = self.worker(dir_entry, workload, writer) {
                    warn!(%err, entry_disk_path, "indexing failed; skipping");
                }

                if let Err(err) = cache.parent().process_embedding_queue() {
                    warn!(?err, "failed to commit embeddings");
                }
            };

            move |dir_entry: RepoDirEntry| {
                let result = std::panic::catch_unwind(AssertUnwindSafe(|| (callback)(dir_entry)));
                if let Err(err) = result {
                    error!(
                        ?err,
                        "Indexing crashed. This is bad. Please send these logs to support!"
                    );
                }
            }
        };

        let start = std::time::Instant::now();

        if reporef.is_remote() {
            let walker = GitWalker::open_repository(
                reporef,
                &repo.disk_path,
                repo.branch_filter.as_ref().map(Into::into),
            )?;
            let count = walker.len();
            stats_gatherer.event.add_payload("file_count", &count);
            walker.for_each(pipes, file_worker(count));
        } else {
            let branch = gix::open::Options::isolated()
                .filter_config_section(|_| false)
                .open(&repo.disk_path)
                .ok()
                .and_then(|r| {
                    r.to_thread_local()
                        .head()
                        .ok()?
                        .try_into_referent()
                        .map(|r| {
                            use gix::bstr::ByteSlice;
                            r.name().shorten().to_str_lossy().into_owned()
                        })
                })
                .unwrap_or_else(|| "HEAD".to_owned());

            let walker = FileWalker::index_directory(&repo.disk_path, branch);
            let count = walker.len();
            stats_gatherer.event.add_payload("file_count", &count);
            walker.for_each(pipes, file_worker(count));
        };

        if pipes.is_cancelled() {
            bail!("cancelled");
        }

        info!(?repo.disk_path, "repo file indexing finished, took {:?}", start.elapsed());

        stats_gatherer.finish().await;
        if stats_gatherer.repo_stats.reindex_count > 0 {
            let user = app.user().await;
            let event = stats_gatherer.event();
            app.with_analytics(|hub| hub.track_repo(event, &user));
        }

        file_cache
            .synchronize(cache, |key| {
                writer.delete_term(Term::from_field_text(self.unique_hash, key));
            })
            .await?;

        pipes.index_percent(100);
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
    pub async fn skim_fuzzy_path_match(
        &self,
        repo_refs: impl IntoIterator<Item = RepoRef>,
        query_str: &str,
        branch: Option<&str>,
        langs: impl Iterator<Item = &str>,
        limit: usize,
    ) -> impl Iterator<Item = FileDocument> + '_ {
        let searcher = self.reader.searcher();
        let file_source = &self.source;

        let repo_ref_terms = {
            let term_queries = repo_refs
                .into_iter()
                .map(|repo_ref| {
                    TermQuery::new(
                        Term::from_field_text(self.source.repo_ref, &repo_ref.to_string()),
                        IndexRecordOption::Basic,
                    )
                })
                .map(|q| Box::new(q) as Box<dyn Query>)
                .collect::<Vec<_>>();

            Box::new(BooleanQuery::union(term_queries))
        };

        let branch_term = branch
            .map(|b| {
                trigrams(b)
                    .map(|token| Term::from_field_text(self.source.branches, token.as_str()))
                    .map(|term| TermQuery::new(term, IndexRecordOption::Basic))
                    .map(Box::new)
                    .map(|q| q as Box<dyn Query>)
                    .collect::<Vec<_>>()
            })
            .map(BooleanQuery::intersection)
            .map(Box::new);

        let langs_term = langs
            .map(|l| Term::from_field_bytes(self.source.lang, l.as_bytes()))
            .map(|t| TermQuery::new(t, IndexRecordOption::Basic))
            .map(Box::new)
            .map(|q| q as Box<dyn Query>)
            .collect::<Vec<_>>();

        let langs_term = match langs_term.len() {
            0 => None,
            _ => Some(Box::new(BooleanQuery::union(langs_term))),
        };

        let search_terms = trigrams(query_str)
            .flat_map(|s| case_permutations(s.as_str()))
            .map(|token| Term::from_field_text(self.source.relative_path, token.as_str()))
            .map(|term| {
                BooleanQuery::intersection(
                    [
                        Some(Box::new(TermQuery::new(term, IndexRecordOption::Basic))
                            as Box<dyn Query>),
                        Some(Box::clone(&repo_ref_terms) as Box<dyn Query>),
                        branch_term
                            .as_ref()
                            .map(Box::clone)
                            .map(|t| t as Box<dyn Query>),
                        langs_term
                            .as_ref()
                            .map(Box::clone)
                            .map(|t| t as Box<dyn Query>),
                    ]
                    .into_iter()
                    .flatten()
                    .collect(),
                )
            })
            .map(|t| Box::new(t) as Box<dyn Query>)
            .collect::<Vec<_>>();

        let matcher = fuzzy_matcher::skim::SkimMatcherV2::default();

        let mut results = searcher
            .search(
                &BooleanQuery::union(search_terms),
                &TopDocs::with_limit(50_000),
            )
            .expect("failed to search index")
            .into_iter()
            .map(move |(_, addr)| {
                let retrieved_doc = searcher
                    .doc(addr)
                    .expect("failed to get document by address");
                FileReader.read_document(file_source, retrieved_doc)
            })
            .filter(|doc| !doc.relative_path.ends_with('/'))
            .filter_map(|doc| {
                let (score, positions) = matcher.fuzzy(&doc.relative_path, query_str, true)?;

                // the closer the position is to the end, the higher its score is
                let position_bonus = positions
                    .iter()
                    .map(|p| *p as f32 / doc.relative_path.len() as f32)
                    .sum::<f32>();

                // add bonus if hits occur in the file-name
                let file_name_bonus = {
                    let file_name_start = doc.relative_path.rfind('/').unwrap_or(0);
                    positions.iter().filter(|&p| p > &file_name_start).count() as f32
                };

                Some((doc, score as f32 + position_bonus + file_name_bonus))
            })
            .collect::<Vec<_>>();

        results.sort_by(|(_, a_score), (_, b_score)| {
            b_score
                .partial_cmp(a_score)
                .unwrap_or(std::cmp::Ordering::Less)
        });
        results.into_iter().map(|(doc, _)| doc).take(limit)
    }

    pub async fn by_path(
        &self,
        repo_ref: &RepoRef,
        relative_path: &str,
        branch: Option<&str>,
    ) -> Result<Option<ContentDocument>> {
        let searcher = self.reader.searcher();

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
        let searcher = self.reader.searcher();

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
    #[tracing::instrument(fields(repo=%workload.repo_ref, entry_disk_path=?dir_entry.path()), skip_all)]
    fn worker(
        &self,
        dir_entry: RepoDirEntry,
        workload: Workload<'_>,
        writer: &IndexWriter,
    ) -> Result<()> {
        #[cfg(feature = "debug")]
        let start = Instant::now();
        trace!("processing file");

        let cache_keys = workload.cache_keys(&dir_entry);
        let last_commit = workload.repo_metadata.last_commit_unix_secs.unwrap_or(0);

        match dir_entry {
            _ if workload.cache.is_fresh(&cache_keys) => {
                info!("fresh; skipping");
            }
            RepoDirEntry::Dir(dir) => {
                trace!("writing dir document");
                let doc = dir.build_document(self, &workload, last_commit as u64, &cache_keys);
                writer.add_document(doc)?;
                trace!("dir document written");
            }
            RepoDirEntry::File(file) => {
                trace!("writing file document");
                let doc = file
                    .build_document(
                        self,
                        &workload,
                        &cache_keys,
                        last_commit as u64,
                        workload.cache.parent(),
                    )
                    .ok_or(anyhow::anyhow!("failed to build document"))?;
                writer.add_document(doc)?;
                trace!("file document written");
            }
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
                warn!(?self.relative_path, ?elapsed, "file took too long to process")
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
        workload: &Workload<'_>,
        last_commit: u64,
        cache_keys: &CacheKeys,
    ) -> tantivy::schema::Document {
        let Workload {
            relative_path,
            repo_name,
            repo_disk_path,
            repo_ref,
            ..
        } = workload;

        let relative_path_str = format!("{}/", relative_path.to_string_lossy());
        #[cfg(windows)]
        let relative_path_str = relative_path_str.replace('\\', "/");

        let branches = self.branches.join("\n");
        let stats = WorkerStats {
            size: self.size(),
            chunks: 0,
            reindex_count: 1,
        };
        workload.transmit_stats(stats);

        doc!(
            schema.raw_repo_name => repo_name.as_bytes(),
            schema.raw_relative_path => relative_path_str.as_bytes(),
            schema.repo_disk_path => repo_disk_path.to_string_lossy().as_ref(),
            schema.relative_path => relative_path_str,
            schema.repo_ref => repo_ref.to_string(),
            schema.repo_name => *repo_name,
            schema.last_commit_unix_seconds => last_commit,
            schema.branches => branches,
            schema.is_directory => true,
            schema.unique_hash => cache_keys.tantivy(),

            // always indicate dirs as indexed
            schema.indexed => true,

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
        self,
        schema: &File,
        workload: &Workload<'_>,
        cache_keys: &CacheKeys,
        last_commit: u64,
        file_cache: &FileCache,
    ) -> Option<tantivy::schema::Document> {
        let Workload {
            relative_path,
            repo_name,
            repo_disk_path,
            repo_ref,
            repo_metadata,
            normalized_path,
            file_filter,
            ..
        } = workload;

        let relative_path_str = relative_path.to_string_lossy().to_string();
        #[cfg(windows)]
        let relative_path_str = relative_path_str.replace('\\', "/");

        let branches = self.branches.join("\n");
        let explicitly_allowed = file_filter.is_allowed(relative_path);
        let indexed = explicitly_allowed.unwrap_or_else(|| self.should_index());
        let mut stats = WorkerStats {
            size: self.size(),
            reindex_count: 1,
            ..Default::default()
        };

        if !indexed {
            let lang_str = repo_metadata
                .langs
                .get(normalized_path, b"")
                .unwrap_or_else(|| {
                    warn!(?normalized_path, "Path not found in language map");
                    ""
                });

            return Some(doc!(
                schema.raw_content => vec![],
                schema.content => "",
                schema.line_end_indices => vec![],
                schema.avg_line_length => 0f64,
                schema.symbol_locations => vec![],
                schema.symbols => vec![],
                schema.raw_repo_name => repo_name.as_bytes(),
                schema.raw_relative_path => relative_path_str.as_bytes(),
                schema.unique_hash => cache_keys.tantivy(),
                schema.repo_disk_path => repo_disk_path.to_string_lossy().as_ref(),
                schema.relative_path => relative_path_str,
                schema.repo_ref => repo_ref.to_string(),
                schema.repo_name => *repo_name,
                schema.lang => lang_str.to_ascii_lowercase().as_bytes(),
                schema.last_commit_unix_seconds => last_commit,
                schema.branches => branches,
                schema.is_directory => false,
                schema.indexed => false,
            ));
        }

        let mut buffer = match self.buffer() {
            Ok(b) => b,
            Err(err) => {
                warn!(?err, "failed to open file buffer; skipping file");
                return None;
            }
        };
        let lang_str = repo_metadata
            .langs
            .get(normalized_path, buffer.as_ref())
            .unwrap_or_else(|| {
                warn!(?normalized_path, "Path not found in language map");
                ""
            });

        let symbol_locations = {
            // build a syntax aware representation of the file
            let scope_graph = TreeSitterFile::try_build(buffer.as_bytes(), lang_str)
                .and_then(TreeSitterFile::scope_graph);

            match scope_graph {
                // we have a graph, use that
                Ok(graph) => SymbolLocations::TreeSitter(graph),
                // no graph, it's empty
                Err(_) => SymbolLocations::Empty,
            }
        };

        // flatten the list of symbols into a string with just text
        let symbols = symbol_locations
            .list()
            .iter()
            .map(|sym| buffer[sym.range.start.byte..sym.range.end.byte].to_owned())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>()
            .join("\n");

        // add an NL if this file is not NL-terminated
        if !buffer.ends_with('\n') {
            buffer += "\n";
        }

        let line_end_indices = buffer
            .match_indices('\n')
            .flat_map(|(i, _)| u32::to_le_bytes(i as u32))
            .collect::<Vec<_>>();

        // Skip files that are too long. This is not necessarily caught in the filesize check, e.g.
        // for a file like `vocab.txt` which has thousands of very short lines.
        if !matches!(explicitly_allowed, Some(true))
            && line_end_indices.len() > MAX_LINE_COUNT as usize
        {
            return None;
        }

        let lines_avg = buffer.len() as f64 / buffer.lines().count() as f64;

        let insert_stats = tokio::task::block_in_place(|| {
            Handle::current().block_on(async {
                file_cache
                    .process_semantic(
                        cache_keys,
                        repo_name,
                        repo_ref,
                        &relative_path_str,
                        &buffer,
                        lang_str,
                        &self.branches,
                    )
                    .await
            })
        });

        stats.chunks += insert_stats.new;
        workload.transmit_stats(stats);

        Some(doc!(
            schema.raw_content => buffer.as_bytes(),
            schema.raw_repo_name => repo_name.as_bytes(),
            schema.raw_relative_path => relative_path_str.as_bytes(),
            schema.unique_hash => cache_keys.tantivy(),
            schema.repo_disk_path => repo_disk_path.to_string_lossy().as_ref(),
            schema.relative_path => relative_path_str,
            schema.repo_ref => repo_ref.to_string(),
            schema.repo_name => *repo_name,
            schema.content => buffer,
            schema.line_end_indices => line_end_indices,
            schema.lang => lang_str.to_ascii_lowercase().as_bytes(),
            schema.avg_line_length => lines_avg,
            schema.last_commit_unix_seconds => last_commit,
            schema.symbol_locations => bincode::serialize(&symbol_locations).unwrap(),
            schema.symbols => symbols,
            schema.branches => branches,
            schema.is_directory => false,
            schema.indexed => true,
        ))
    }
}
