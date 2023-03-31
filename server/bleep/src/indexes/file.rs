use std::{
    collections::{HashMap, HashSet},
    ops::Not,
    path::{Path, PathBuf, MAIN_SEPARATOR},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};

use anyhow::{Context, Result};
use async_trait::async_trait;
use gix::ThreadSafeRepository;
use once_cell::sync::Lazy;
use regex::Regex;
use scc::hash_map::Entry;
use smallvec::SmallVec;
use tantivy::{
    collector::TopDocs,
    doc,
    query::{BooleanQuery, QueryParser, TermQuery},
    schema::{
        BytesOptions, Field, IndexRecordOption, Schema, Term, TextFieldIndexing, TextOptions, FAST,
        STORED, STRING,
    },
    IndexWriter,
};
use tokenizers as _;
use tokio::runtime::Handle;
use tracing::{debug, error, info, trace, warn};

#[cfg(feature = "debug")]
use {
    histogram::Histogram,
    std::{sync::RwLock, time::Instant},
};

use super::{
    reader::{ContentDocument, ContentReader},
    DocumentRead, Indexable, Indexer,
};
use crate::{
    intelligence::TreeSitterFile,
    repo::{FileCache, RepoMetadata, RepoRef, RepoRemote, Repository},
    semantic::Semantic,
    symbol::SymbolLocations,
    Configuration,
};

struct Workload<'a> {
    repo_disk_path: &'a Path,
    repo_ref: String,
    repo_name: &'a str,
    repo_metadata: &'a RepoMetadata,
    cache: &'a FileCache,
    file: RepoFile,
}

#[derive(Clone)]
pub struct File {
    config: Arc<Configuration>,
    schema: Schema,
    semantic: Option<Semantic>,

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
}

impl File {
    pub fn new(config: Arc<Configuration>, semantic: Option<Semantic>) -> Self {
        let mut builder = tantivy::schema::SchemaBuilder::new();
        let trigram = TextOptions::default().set_stored().set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("default")
                .set_index_option(IndexRecordOption::WithFreqsAndPositions),
        );

        let entry_disk_path = builder.add_text_field("entry_disk_path", STRING);
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

        Self {
            entry_disk_path,
            repo_disk_path,
            relative_path,
            repo_ref,
            repo_name,
            content,
            line_end_indices,
            symbols,
            symbol_locations,
            lang,
            avg_line_length,
            last_commit_unix_seconds,
            schema: builder.build(),
            semantic,
            config,
            raw_content,
            raw_repo_name,
            raw_relative_path,
            branches,

            #[cfg(feature = "debug")]
            histogram: Arc::new(Histogram::builder().build().unwrap().into()),
        }
    }
}

fn should_index<P: AsRef<Path>>(p: &P) -> bool {
    let path = p.as_ref();

    #[rustfmt::skip]
    const EXT_BLACKLIST: &[&str] = &[
        // graphics
        "png", "jpg", "jpeg", "ico", "bmp", "bpg", "eps", "pcx", "ppm", "tga", "tiff", "wmf", "xpm",
        "svg",
        // fonts
        "ttf", "woff2", "fnt", "fon", "otf",
        // documents
        "pdf", "ps", "doc", "dot", "docx", "dotx", "xls", "xlsx", "xlt", "odt", "ott", "ods", "ots", "dvi", "pcl",
        // media
        "mp3", "ogg", "ac3", "aac", "mod", "mp4", "mkv", "avi", "m4v", "mov", "flv",
        // compiled
        "jar", "pyc", "war", "ear",
        // compression
        "tar", "gz", "bz2", "xz", "7z", "bin", "apk", "deb", "rpm",
        // executable
        "com", "exe", "out", "coff", "obj", "dll", "app", "class",
        // misc.
        "log", "wad", "bsp", "bak", "sav", "dat", "lock",
    ];

    let Some(ext) = path.extension() else {
        return true;
    };

    let ext = ext.to_string_lossy();
    if EXT_BLACKLIST.contains(&&*ext) {
        return false;
    }

    static VENDOR_PATTERNS: Lazy<HashMap<&'static str, SmallVec<[Regex; 1]>>> = Lazy::new(|| {
        let patterns: &[(&[&str], &[&str])] = &[
            (
                &["go", "proto"],
                &["^(vendor|third_party)/.*\\.\\w+$", "\\w+\\.pb\\.go$"],
            ),
            (
                &["js", "jsx", "ts", "tsx", "css", "md", "json", "txt", "conf"],
                &["^(node_modules|vendor|dist)/.*\\.\\w+$"],
            ),
        ];

        patterns
            .iter()
            .flat_map(|(exts, rxs)| exts.iter().map(move |&e| (e, rxs)))
            .map(|(ext, rxs)| {
                let regexes = rxs
                    .iter()
                    .filter_map(|source| match Regex::new(source) {
                        Ok(r) => Some(r),
                        Err(e) => {
                            warn!(%e, "failed to compile vendor regex {source:?}");
                            None
                        }
                    })
                    .collect();

                (ext, regexes)
            })
            .collect()
    });

    match VENDOR_PATTERNS.get(&*ext) {
        None => true,
        Some(rxs) => !rxs.iter().any(|r| r.is_match(&path.to_string_lossy())),
    }
}

// Empirically calculated using:
//     cat **/*.rs | awk '{SUM+=length;N+=1}END{print SUM/N}'
const AVG_LINE_LEN: u64 = 30;
const MAX_LINE_COUNT: u64 = 20000;
const MAX_FILE_LEN: u64 = AVG_LINE_LEN * MAX_LINE_COUNT;

#[async_trait]
impl Indexable for File {
    fn index_repository(
        &self,
        reporef: &RepoRef,
        repo: &Repository,
        repo_metadata: &RepoMetadata,
        writer: &IndexWriter,
        progress: &(dyn Fn(u8) + Sync),
    ) -> Result<()> {
        let file_cache = repo.open_file_cache(&self.config.index_dir)?;
        let repo_name = reporef.indexed_name();
        let processed = &AtomicU64::new(0);

        let file_worker = |count: usize| {
            let file_cache = file_cache.clone();
            move |file: RepoFile| {
                let completed = processed.fetch_add(1, Ordering::Relaxed);
                progress(((completed as f32 / count as f32) * 100f32) as u8);

                let entry_disk_path = file.path.clone();
                let workload = Workload {
                    repo_disk_path: &repo.disk_path,
                    repo_ref: reporef.to_string(),
                    repo_name: &repo_name,
                    cache: &file_cache,
                    repo_metadata,
                    file,
                };

                debug!(entry_disk_path, "queueing entry");
                if let Err(err) = self.worker(workload, writer) {
                    warn!(%err, entry_disk_path, "indexing failed; skipping");
                }
            }
        };

        let start = std::time::Instant::now();
        if reporef.is_remote() && matches!(repo.remote, RepoRemote::Git { .. }) {
            let walker = GitWalker::open_repository(&repo.disk_path, None)?;
            let count = walker.len();
            walker.for_each(file_worker(count));
        } else {
            let walker = FileWalker::index_directory(&repo.disk_path);
            let count = walker.len();
            walker.for_each(file_worker(count));
        };

        info!(?repo.disk_path, "repo file indexing finished, took {:?}", start.elapsed());

        // files that are no longer tracked by the git index are to be removed
        // from the tantivy & qdrant indices
        let mut qdrant_remove_list = vec![];
        file_cache.retain(|k, v| {
            if v.fresh.not() {
                // delete from tantivy
                writer.delete_term(Term::from_field_text(
                    self.entry_disk_path,
                    &k.to_string_lossy(),
                ));

                // delete from qdrant
                if let Ok(relative_path) = k.strip_prefix(&repo.disk_path) {
                    qdrant_remove_list.push(relative_path.to_string_lossy().to_string());
                }
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
                        .delete_points_by_path(
                            reporef.as_str(),
                            qdrant_remove_list.iter().map(|t| t.as_str()),
                        )
                        .await;
                });
            }
        }

        progress(100);
        repo.save_file_cache(&self.config.index_dir, file_cache)?;
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
    pub async fn file_body(&self, file_disk_path: &str) -> Result<String> {
        // Mostly taken from `by_path`, below.
        //
        // TODO: This can be unified with `by_path` below, but we first need to decide on a unified
        // path referencing API throughout the webserver.

        let reader = self.reader.read().await;
        let searcher = reader.searcher();

        let query = TermQuery::new(
            Term::from_field_text(self.source.entry_disk_path, file_disk_path),
            IndexRecordOption::Basic,
        );

        let collector = TopDocs::with_limit(1);
        let search_results = searcher
            .search(&query, &collector)
            .context("failed to search index")?;

        match search_results.as_slice() {
            [] => Err(anyhow::Error::msg("no path found")),
            [(_, doc_addr)] => Ok(searcher
                .doc(*doc_addr)
                .context("failed to get document by address")?
                .get_first(self.source.content)
                .context("content field was missing")?
                .as_text()
                .context("content field did not contain text")?
                .to_owned()),
            _ => {
                warn!("TopDocs is not limited to 1 and index contains duplicates");
                Err(anyhow::Error::msg("multiple paths returned"))
            }
        }
    }

    pub async fn by_path(
        &self,
        repo_ref: &RepoRef,
        relative_path: &str,
    ) -> Result<ContentDocument> {
        let reader = self.reader.read().await;
        let searcher = reader.searcher();

        let file_index = searcher.index();
        let file_source = &self.source;

        // query the `relative_path` field of the `File` index, using tantivy's query language
        //
        // XXX: can we use the bloop query language here instead?
        let query_parser = QueryParser::for_index(
            file_index,
            vec![self.source.repo_disk_path, self.source.relative_path],
        );
        let query = query_parser
            .parse_query(&format!(
                "repo_ref:\"{repo_ref}\" AND relative_path:\"{relative_path}\""
            ))
            .expect("failed to parse tantivy query");

        let collector = TopDocs::with_limit(1);
        let search_results = searcher
            .search(&query, &collector)
            .expect("failed to search index");

        match search_results.as_slice() {
            // no paths matched, the input path was not well formed
            [] => Err(anyhow::Error::msg("no path found")),

            // exactly one path, good
            [(_, doc_addr)] => {
                let retrieved_doc = searcher
                    .doc(*doc_addr)
                    .expect("failed to get document by address");
                Ok(ContentReader.read_document(file_source, retrieved_doc))
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
    pub async fn by_repo(&self, repo_ref: &RepoRef, lang: Option<&str>) -> Vec<ContentDocument> {
        let reader = self.reader.read().await;
        let searcher = reader.searcher();

        // repo query
        let path_query = Box::new(TermQuery::new(
            Term::from_field_text(self.source.repo_ref, &repo_ref.to_string()),
            IndexRecordOption::Basic,
        ));

        // if file has a recognised language, constrain by files of the same lang
        let query = match lang {
            Some(l) => BooleanQuery::intersection(vec![
                path_query,
                // language query
                Box::new(TermQuery::new(
                    Term::from_field_bytes(self.source.lang, l.to_ascii_lowercase().as_bytes()),
                    IndexRecordOption::Basic,
                )),
            ]),
            None => BooleanQuery::intersection(vec![path_query]),
        };

        let collector = TopDocs::with_limit(100);
        searcher
            .search(&query, &collector)
            .expect("failed to search index")
            .into_iter()
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
    #[tracing::instrument(fields(repo=%workload.repo_ref, entry_disk_path=?workload.file.path), skip_all)]
    fn worker(&self, workload: Workload<'_>, writer: &IndexWriter) -> Result<()> {
        let Workload {
            repo_ref,
            repo_disk_path,
            repo_name,
            repo_metadata,
            cache,
            mut file,
        } = workload;

        #[cfg(feature = "debug")]
        let start = Instant::now();

        let relative_path = {
            let entry_srcpath = PathBuf::from(&file.path);
            entry_srcpath
                .strip_prefix(repo_disk_path)
                .map(ToOwned::to_owned)
                .unwrap_or(entry_srcpath)
        };
        let entry_pathbuf = repo_disk_path.join(&relative_path);

        let relative_path_str = if file.kind.is_dir() {
            format!("{}{MAIN_SEPARATOR}", relative_path.to_string_lossy())
        } else {
            relative_path.to_string_lossy().to_string()
        };
        trace!("processing file");

        let content_hash = {
            let mut hash = blake3::Hasher::new();
            hash.update(crate::state::SCHEMA_VERSION.as_bytes());
            hash.update(file.buffer.as_bytes());
            hash.finalize().to_hex().to_string()
        };
        trace!("adding cache entry");

        match cache.entry(entry_pathbuf.clone()) {
            Entry::Occupied(mut val) if val.get().value == content_hash => {
                // skip processing if contents are up-to-date in the cache
                val.get_mut().fresh = true;
                return Ok(());
            }
            Entry::Occupied(mut val) => {
                _ = val.insert(content_hash.into());
            }
            Entry::Vacant(val) => {
                _ = val.insert_entry(content_hash.into());
            }
        }
        trace!("added cache entry");

        let lang_str = if file.kind.is_file() {
            repo_metadata
                .langs
                .path_map
                .get(&entry_pathbuf)
                .unwrap_or_else(|| {
                    warn!(?entry_pathbuf, "Path not found in language map");
                    &Some("")
                })
                .unwrap_or("")
        } else {
            ""
        };

        // calculate symbol locations
        let symbol_locations = if file.kind.is_file() {
            // build a syntax aware representation of the file
            let scope_graph = TreeSitterFile::try_build(file.buffer.as_bytes(), lang_str)
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
        } else {
            SymbolLocations::Empty
        };

        // flatten the list of symbols into a string with just text
        let symbols = symbol_locations
            .list()
            .iter()
            .map(|sym| file.buffer[sym.range.start.byte..sym.range.end.byte].to_owned())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>()
            .join("\n");

        let branches = file.branches.join("\n");

        // add an NL if this file is not NL-terminated
        if !file.buffer.ends_with('\n') {
            file.buffer += "\n";
        }

        let line_end_indices = file
            .buffer
            .match_indices('\n')
            .flat_map(|(i, _)| u32::to_le_bytes(i as u32))
            .collect::<Vec<_>>();

        // Skip files that are too long. This is not necessarily caught in the filesize check, e.g.
        // for a file like `vocab.txt` which has thousands of very short lines.
        if line_end_indices.len() > MAX_LINE_COUNT as usize {
            return Ok(());
        }

        let lines_avg = file.buffer.len() as f64 / file.buffer.lines().count() as f64;
        let last_commit = repo_metadata.last_commit_unix_secs;

        // produce vectors for this document if it is a file
        if file.kind.is_file() {
            if let Some(semantic) = &self.semantic {
                tokio::task::block_in_place(|| {
                    Handle::current().block_on(semantic.insert_points_for_buffer(
                        repo_name,
                        &repo_ref,
                        &relative_path_str,
                        &file.buffer,
                        lang_str,
                        &file.branches,
                    ))
                });
            }
        }

        trace!("writing document");
        #[cfg(feature = "debug")]
        let buf_size = buffer.len();
        writer.add_document(doc!(
            self.raw_content => file.buffer.as_bytes(),
            self.raw_repo_name => repo_name.as_bytes(),
            self.raw_relative_path => relative_path_str.as_bytes(),
            self.repo_disk_path => repo_disk_path.to_string_lossy().as_ref(),
            self.entry_disk_path => entry_pathbuf.to_string_lossy().as_ref(),
            self.relative_path => relative_path_str,
            self.repo_ref => repo_ref,
            self.repo_name => repo_name,
            self.content => file.buffer,
            self.line_end_indices => line_end_indices,
            self.lang => lang_str.to_ascii_lowercase().as_bytes(),
            self.avg_line_length => lines_avg,
            self.last_commit_unix_seconds => last_commit,
            self.symbol_locations => bincode::serialize(&symbol_locations)?,
            self.symbols => symbols,
            self.branches => branches,
        ))?;

        trace!("document written");

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
                warn!(
                    ?relative_path,
                    ?elapsed,
                    buf_size,
                    "file took too long to process"
                )
            }
        }

        Ok(())
    }
}

struct RepoFile {
    path: String,
    buffer: String,
    kind: FileType,
    branches: Vec<String>,
}

#[derive(Hash, Eq, PartialEq)]
enum FileType {
    File,
    Dir,
    Other,
}

impl FileType {
    fn is_dir(&self) -> bool {
        matches!(self, Self::Dir)
    }
    fn is_file(&self) -> bool {
        matches!(self, Self::File)
    }
}

trait FileSource {
    fn len(&self) -> usize;
    fn for_each(self, iterator: impl Fn(RepoFile) + Sync + Send);
}

struct FileWalker {
    file_list: Vec<PathBuf>,
}

impl FileWalker {
    fn index_directory(dir: impl AsRef<Path>) -> impl FileSource {
        // note: this WILL observe .gitignore files for the respective repos.
        let file_list = ignore::Walk::new(&dir)
            .filter_map(|de| match de {
                Ok(de) => Some(de),
                Err(err) => {
                    warn!(%err, "access failure; skipping");
                    None
                }
            })
            // Preliminarily ignore files that are very large, without reading the contents.
            .filter(|de| matches!(de.metadata(), Ok(meta) if meta.len() < MAX_FILE_LEN))
            .filter_map(|de| crate::canonicalize(de.into_path()).ok())
            .filter(|p| {
                p.strip_prefix(&dir)
                    .as_ref()
                    .map(should_index)
                    .unwrap_or_default()
            })
            .collect();

        Self { file_list }
    }
}

impl FileSource for FileWalker {
    fn len(&self) -> usize {
        self.file_list.len()
    }

    fn for_each(self, iterator: impl Fn(RepoFile) + Sync + Send) {
        use rayon::prelude::*;
        self.file_list
            .into_par_iter()
            .filter_map(|entry_disk_path| {
                let buffer = if entry_disk_path.is_file() {
                    match std::fs::read_to_string(&entry_disk_path) {
                        Err(err) => {
                            warn!(%err, ?entry_disk_path, "read failed; skipping");
                            return None;
                        }
                        Ok(buffer) => buffer,
                    }
                } else {
                    String::new()
                };

                let file_type = if entry_disk_path.is_dir() {
                    FileType::Dir
                } else if entry_disk_path.is_file() {
                    FileType::File
                } else {
                    FileType::Other
                };

                Some(RepoFile {
                    buffer,
                    path: entry_disk_path.to_string_lossy().to_string(),
                    kind: file_type,
                    branches: vec!["head".into()],
                })
            })
            .for_each(iterator);
    }
}

enum BranchFilter {
    All,
    Select(Vec<Regex>),
}

impl BranchFilter {
    fn filter(&self, branch: &str) -> bool {
        match self {
            BranchFilter::All => true,
            BranchFilter::Select(patterns) => patterns.iter().any(|r| r.is_match(branch)),
        }
    }
}

impl Default for BranchFilter {
    fn default() -> Self {
        Self::All
    }
}

struct GitWalker {
    git: ThreadSafeRepository,
    entries: HashMap<(String, FileType, gix::ObjectId), Vec<String>>,
}

impl GitWalker {
    fn open_repository(
        dir: impl AsRef<Path>,
        filter: impl Into<Option<BranchFilter>>,
    ) -> Result<impl FileSource> {
        let branches = filter.into().unwrap_or_default();
        let git = gix::open::Options::isolated()
            .filter_config_section(|_| false)
            .open(dir.as_ref())?;

        let local_git = git.to_thread_local();
        let head = local_git
            .head()?
            .try_into_referent()
            .map(|r| r.name().to_owned());

        let refs = local_git.references()?;
        let entries = refs
            .prefixed("refs/heads")?
            .peeled()
            .filter_map(Result::ok)
            .map(|r| (human_readable_branch_name(&r), r))
            .filter(|(name, _)| branches.filter(name))
            .filter_map(|(branch, r)| -> Option<_> {
                let is_head = head
                    .as_ref()
                    .map(|head| head.as_ref() == r.name())
                    .unwrap_or_default();

                let tree = r
                    .into_fully_peeled_id()
                    .ok()?
                    .object()
                    .ok()?
                    .peel_to_tree()
                    .ok()?;

                let files = tree.traverse().breadthfirst.files().unwrap().into_iter();

                Some(files.map(move |entry| {
                    (
                        is_head,
                        branch.clone(),
                        String::from_utf8_lossy(entry.filepath.as_ref()).to_string(),
                        entry.mode,
                        entry.oid,
                    )
                }))
            })
            .flatten()
            .fold(
                HashMap::new(),
                |mut acc, (is_head, branch, file, mode, oid)| {
                    let kind = if mode.is_tree() {
                        FileType::Dir
                    } else if mode.is_blob() {
                        FileType::File
                    } else {
                        FileType::Other
                    };

                    let branches = acc.entry((file, kind, oid)).or_insert_with(Vec::new);
                    if is_head {
                        branches.push("head".to_string());
                    }

                    branches.push(branch);
                    acc
                },
            );

        Ok(Self { git, entries })
    }
}

fn human_readable_branch_name(r: &gix::Reference<'_>) -> String {
    use gix::bstr::ByteSlice;
    r.name().shorten().to_str_lossy().to_string()
}

impl FileSource for GitWalker {
    fn len(&self) -> usize {
        self.entries.len()
    }

    fn for_each(self, iterator: impl Fn(RepoFile) + Sync + Send) {
        use rayon::prelude::*;
        self.entries
            .into_par_iter()
            .filter_map(|((file, kind, oid), branches)| {
                let git = self.git.to_thread_local();

                let Ok(Some(object)) = git.try_find_object(oid) else {
		    error!(?file, ?branches, "can't find object for file");
		    return None;
		};

                let buffer = String::from_utf8_lossy(&object.data).to_string();

                Some(RepoFile {
                    path: file,
                    kind,
                    branches,
                    buffer,
                })
            })
            .for_each(iterator)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_should_index() {
        let tests = [
            // Ignore these extensions completely.
            ("image.png", false),
            ("image.jpg", false),
            ("image.jpeg", false),
            ("font.ttf", false),
            ("font.otf", false),
            ("font.woff2", false),
            ("icon.ico", false),
            // Simple paths that should be indexed.
            ("foo.js", true),
            ("bar.ts", true),
            ("quux/fred.ts", true),
            // Typical vendored paths.
            ("vendor/jquery.js", false),
            ("dist/react.js", false),
            ("vendor/github.com/Microsoft/go-winio/file.go", false),
            (
                "third_party/protobuf/google/protobuf/descriptor.proto",
                false,
            ),
            ("src/defs.pb.go", false),
            // These are not typically vendored in Rust.
            ("dist/main.rs", true),
            ("vendor/foo.rs", true),
        ];

        for (path, index) in tests {
            assert_eq!(should_index(&Path::new(path)), index);
        }
    }
}
