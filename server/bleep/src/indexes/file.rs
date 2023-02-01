use std::{
    collections::{HashMap, HashSet},
    ops::Not,
    path::{Path, PathBuf, MAIN_SEPARATOR},
    sync::Arc,
};

use anyhow::{Context, Result};
use async_trait::async_trait;
use dashmap::mapref::entry::Entry;
use once_cell::sync::Lazy;
use regex::Regex;
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
use tracing::{debug, info, trace, warn};

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
    semantic::Semantic,
    state::{FileCache, RepoHeadInfo, RepoRef, Repository},
    symbol::SymbolLocations,
    Configuration,
};

struct Workload<'a> {
    entry_disk_path: PathBuf,
    repo_disk_path: &'a Path,
    repo_ref: String,
    repo_name: &'a str,
    repo_info: &'a RepoHeadInfo,
    cache: &'a FileCache,
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

        let symbols = builder.add_text_field("symbols", trigram);
        let symbol_locations =
            builder.add_bytes_field("symbol_locations", BytesOptions::default().set_stored());

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
        "log", "wad", "bsp", "bak", "sav", "dat",
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
        repo_info: &RepoHeadInfo,
        writer: &IndexWriter,
    ) -> Result<()> {
        let file_cache = repo.open_file_cache(&self.config.index_dir)?;
        let repo_name = reporef.indexed_name();

        // note: this WILL observe .gitignore files for the respective repos.
        let walker = ignore::Walk::new(&repo.disk_path)
            .filter_map(|de| match de {
                Ok(de) => Some(de),
                Err(err) => {
                    warn!(%err, "access failure; skipping");
                    None
                }
            })
            // Preliminarily ignore files that are very large, without reading the contents.
            .filter(|de| matches!(de.metadata(), Ok(meta) if meta.len() < MAX_FILE_LEN))
            .map(|de| crate::canonicalize(de.into_path()).unwrap())
            .filter(|p| should_index(&p.strip_prefix(&repo.disk_path).unwrap()))
            .collect::<Vec<PathBuf>>();

        let start = std::time::Instant::now();

        use rayon::prelude::*;
        walker.into_par_iter().for_each(|entry_disk_path| {
            let workload = Workload {
                entry_disk_path: entry_disk_path.clone(),
                repo_disk_path: &repo.disk_path,
                repo_ref: reporef.to_string(),
                repo_name: &repo_name,
                cache: &file_cache,
                repo_info,
            };

            debug!(?entry_disk_path, "queueing entry");
            if let Err(err) = self.worker(workload, writer) {
                warn!(%err, ?entry_disk_path, "indexing failed; skipping");
            }
        });

        info!(?repo.disk_path, "file indexing finished, took {:?}", start.elapsed());

        file_cache.retain(|k, v| {
            if v.fresh.not() {
                writer.delete_term(Term::from_field_text(
                    self.entry_disk_path,
                    &k.to_string_lossy(),
                ));
            }

            v.fresh
        });

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
    #[tracing::instrument(fields(repo=%workload.repo_ref, entry_disk_path=?workload.entry_disk_path), skip_all)]
    fn worker(&self, workload: Workload<'_>, writer: &IndexWriter) -> Result<()> {
        let Workload {
            entry_disk_path,
            repo_ref,
            repo_disk_path,
            repo_name,
            repo_info,
            cache,
        } = workload;

        #[cfg(feature = "debug")]
        let start = Instant::now();

        let mut buffer = if entry_disk_path.is_file() {
            match std::fs::read_to_string(&entry_disk_path) {
                Err(err) => {
                    debug!(%err, ?entry_disk_path, "read failed; skipping");
                    return Ok(());
                }
                Ok(buffer) => buffer,
            }
        } else {
            String::new()
        };

        let relative_path = entry_disk_path.strip_prefix(repo_disk_path)?;
        let relative_path_str = if entry_disk_path.is_dir() {
            format!("{}{MAIN_SEPARATOR}", relative_path.to_string_lossy()).into()
        } else {
            relative_path.to_string_lossy()
        };

        trace!("processing file");

        let content_hash = {
            let mut hash = blake3::Hasher::new();
            hash.update(crate::state::SCHEMA_VERSION.as_bytes());
            hash.update(buffer.as_bytes());
            hash.finalize().to_hex().to_string()
        };

        trace!("adding cache entry");

        match cache.entry(entry_disk_path.clone()) {
            Entry::Occupied(mut val) if val.get().value == content_hash => {
                // skip processing if contents are up-to-date in the cache
                val.get_mut().fresh = true;
                return Ok(());
            }
            Entry::Occupied(mut val) => {
                val.insert(content_hash.into());
            }
            Entry::Vacant(val) => {
                val.insert(content_hash.into());
            }
        }
        trace!("added cache entry");

        let lang_str = repo_info
            .langs
            .path_map
            .get(&entry_disk_path)
            .unwrap_or_else(|| {
                warn!("Path not found in language map");
                &Some("")
            })
            .unwrap_or("");

        // calculate symbol locations
        let symbol_locations = {
            // build a syntax aware representation of the file
            let scope_graph = TreeSitterFile::try_build(buffer.as_bytes(), lang_str)
                .and_then(TreeSitterFile::scope_graph);

            match scope_graph {
                // we have a graph, use that
                Ok(graph) => SymbolLocations::TreeSitter(graph),
                // no graph, try ctags instead
                Err(err) => {
                    debug!(?err, %lang_str, "failed to build scope graph");
                    match repo_info.symbols.get(relative_path) {
                        Some(syms) => SymbolLocations::Ctags(syms.clone()),
                        // no ctags either
                        _ => {
                            debug!(%lang_str, ?entry_disk_path, "failed to build tags");
                            SymbolLocations::Empty
                        }
                    }
                }
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
        if line_end_indices.len() > MAX_LINE_COUNT as usize {
            return Ok(());
        }

        let lines_avg = buffer.len() as f64 / buffer.lines().count() as f64;
        let last_commit = repo_info.last_commit_unix_secs;

        if let Some(semantic) = &self.semantic {
            tokio::task::block_in_place(|| {
                Handle::current().block_on(semantic.insert_points_for_buffer(
                    repo_name,
                    &repo_ref,
                    &relative_path.to_string_lossy(),
                    &buffer,
                    lang_str,
                ))
            });
        }

        trace!("writing document");
        #[cfg(feature = "debug")]
        let buf_size = buffer.len();
        writer.add_document(doc!(
            self.repo_disk_path => repo_disk_path.to_string_lossy().as_ref(),
            self.entry_disk_path => entry_disk_path.to_string_lossy().as_ref(),
            self.relative_path => relative_path_str.as_ref(),
            self.repo_ref => repo_ref,
            self.repo_name => repo_name,
            self.content => buffer.as_str(),
            self.line_end_indices => line_end_indices,
            self.lang => lang_str.to_ascii_lowercase().as_bytes(),
            self.avg_line_length => lines_avg,
            self.last_commit_unix_seconds => last_commit,
            self.symbol_locations => bincode::serialize(&symbol_locations)?,
            self.symbols => symbols,
            self.raw_content => buffer.as_bytes(),
            self.raw_repo_name => repo_name.as_bytes(),
            self.raw_relative_path => relative_path_str.as_ref().as_bytes(),
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
            assert_eq!(should_index(&Path::new(dbg!(path))), index);
        }
    }
}
