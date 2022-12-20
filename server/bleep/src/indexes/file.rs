use std::{
    collections::HashSet,
    ops::Not,
    path::{Path, PathBuf},
    sync::Arc,
};

use anyhow::{Context, Result};
use async_trait::async_trait;
use dashmap::mapref::entry::Entry;
use maplit::hashmap;
use ndarray_linalg::norm::Norm;
use qdrant_client::{
    prelude::{QdrantClient, QdrantClientConfig},
    qdrant::{
        point_id::PointIdOptions, vectors_config, CreateCollection, Distance, PointId, PointStruct,
        VectorParams, VectorsConfig,
    },
};
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
use tract_onnx::{prelude::*, tract_hir::internal::InferenceOp};

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
    chunk,
    ctags::ctags_for_file,
    intelligence::TreeSitterFile,
    state::{FileCache, RepoHeadInfo, RepoRef, Repository},
    symbol::SymbolLocations,
    Configuration,
};

struct Workload<'a> {
    file_disk_path: PathBuf,
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
    qdrant: Arc<QdrantClient>,
    tokenizer: Arc<tokenizers::Tokenizer>,
    onnx: Arc<InferenceSimplePlan<Graph<InferenceFact, Box<dyn InferenceOp + 'static>>>>,

    #[cfg(feature = "debug")]
    histogram: Arc<RwLock<Histogram>>,

    // Path to the indexed file on disk
    pub file_disk_path: Field,
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
    pub async fn new(config: Arc<Configuration>) -> Self {
        let mut builder = tantivy::schema::SchemaBuilder::new();
        let trigram = TextOptions::default().set_stored().set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("default")
                .set_index_option(IndexRecordOption::WithFreqsAndPositions),
        );

        let file_disk_path = builder.add_text_field("file_disk_path", STRING);
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
        let qdrant = QdrantClient::new(Some(QdrantClientConfig::from_url(&config.qdrant_url)))
            .await
            .unwrap();

        // don't panic if the collection already exists
        _ = qdrant
            .create_collection(&CreateCollection {
                collection_name: "documents".to_string(),
                vectors_config: Some(VectorsConfig {
                    config: Some(vectors_config::Config::Params(VectorParams {
                        size: 384,
                        distance: Distance::Cosine.into(),
                    })),
                }),
                ..Default::default()
            })
            .await;

        Self {
            file_disk_path,
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
            qdrant: qdrant.into(),
            tokenizer: tokenizers::Tokenizer::from_file(Path::join(
                &config.model_dir,
                "tokenizer.json",
            ))
            .unwrap()
            .into(),
            onnx: onnx()
                .model_for_path(Path::join(&config.model_dir, "model.onnx"))
                .unwrap()
                .into_runnable()
                .unwrap()
                .into(),
            config,
            raw_content,
            raw_repo_name,
            raw_relative_path,

            #[cfg(feature = "debug")]
            histogram: Arc::new(
                Histogram::configure()
                    .max_memory(5 * 1024 * 1024)
                    .build()
                    .unwrap()
                    .into(),
            ),
        }
    }
}

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
        let walker = repo
            .open_walker()
            .filter_map(|entry| match entry {
                Ok(de) => match de.file_type() {
                    Some(ft) if ft.is_file() => Some(dunce::canonicalize(de.into_path()).unwrap()),
                    _ => None,
                },
                Err(err) => {
                    warn!(%err, "access failure; skipping");
                    None
                }
            })
            .collect::<Vec<PathBuf>>();

        let start = std::time::Instant::now();

        use rayon::prelude::*;
        walker.par_iter().for_each(|file_disk_path| {
            let workload = Workload {
                file_disk_path: file_disk_path.clone(),
                repo_disk_path: &repo.disk_path,
                repo_ref: reporef.to_string(),
                repo_name: &repo_name,
                cache: &file_cache,
                repo_info,
            };

            debug!(?file_disk_path, "queueing file");
            if let Err(err) = self.worker(workload, writer) {
                warn!(%err, ?file_disk_path, "indexing failed; skipping");
            }
        });

        info!(?repo.disk_path, "file indexing finished, took {:?}", start.elapsed());

        file_cache.retain(|k, v| {
            if v.fresh.not() {
                writer.delete_term(Term::from_field_text(
                    self.file_disk_path,
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
            Term::from_field_text(self.source.file_disk_path, file_disk_path),
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
                "repo_ref:\"{}\" AND relative_path:\"{}\"",
                repo_ref, relative_path
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
    #[tracing::instrument(fields(repo=%workload.repo_ref, file_path=?workload.file_disk_path), skip_all)]
    fn worker(&self, workload: Workload<'_>, writer: &IndexWriter) -> Result<()> {
        let Workload {
            file_disk_path,
            repo_ref,
            repo_disk_path,
            repo_name,
            repo_info,
            cache,
        } = workload;

        #[cfg(feature = "debug")]
        let start = Instant::now();

        let mut buffer = match std::fs::read_to_string(&file_disk_path) {
            Err(err) => {
                debug!(%err, ?file_disk_path, "read failed; skipping");
                return Ok(());
            }
            Ok(buffer) => buffer,
        };

        let relative_path = file_disk_path.strip_prefix(repo_disk_path)?;
        trace!("processing file");

        let content_hash = {
            let mut hash = blake3::Hasher::new();
            hash.update(crate::state::SCHEMA_VERSION.as_bytes());
            hash.update(buffer.as_bytes());
            hash.finalize().to_hex().to_string()
        };

        trace!("adding cache entry");

        match cache.entry(file_disk_path.clone()) {
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
            .get(&file_disk_path)
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
                            debug!(%lang_str, ?file_disk_path, "failed to build tags");
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

        let lines_avg = buffer.len() as f64 / buffer.lines().count() as f64;
        let last_commit = repo_info.last_commit_unix_secs;

        let chunks = chunk::tree_sitter(&buffer, lang_str).unwrap_or_else(|e| {
            debug!(?e, %lang_str, "failed to chunk, falling back to trivial chunker");
            chunk::trivial(&buffer, 15) // line-wise chunking, 15 lines per chunk
        });
        debug!("found {} chunks", chunks.len());
        let datapoints = chunks
            .par_iter()
            .filter_map(|&chunk| {
                trace!("ndarray");
                debug!(
                    "chunk size: {}b {}",
                    chunk.len(),
                    (chunk.len() > 800)
                        .then_some("(big chunk)")
                        .unwrap_or_default()
                );
                let tokenizer_output = self.tokenizer.encode(chunk, true).unwrap();

                let input_ids = tokenizer_output.get_ids();
                let attention_mask = tokenizer_output.get_attention_mask();
                let token_type_ids = tokenizer_output.get_type_ids();

                let length = input_ids.len();

                let input_ids: Tensor = tract_ndarray::Array2::from_shape_vec(
                    (1, length),
                    input_ids.iter().map(|&x| x as i64).collect(),
                )
                .map_err(|e| {
                    tracing::error!("{e}");
                    e
                })
                .ok()?
                .into();
                let attention_mask: Tensor = tract_ndarray::Array2::from_shape_vec(
                    (1, length),
                    attention_mask.iter().map(|&x| x as i64).collect(),
                )
                .map_err(|e| {
                    tracing::error!("{e}");
                    e
                })
                .ok()?
                .into();
                let token_type_ids: Tensor = tract_ndarray::Array2::from_shape_vec(
                    (1, length),
                    token_type_ids.iter().map(|&x| x as i64).collect(),
                )
                .map_err(|e| {
                    tracing::error!("{e}");
                    e
                })
                .ok()?
                .into();

                let outputs = self
                    .onnx
                    .run(tvec!(
                        input_ids.into(),
                        attention_mask.into(),
                        token_type_ids.into()
                    ))
                    .map_err(|e| {
                        tracing::error!("{e}");
                        e
                    })
                    .ok()?;

                let logits = outputs[0]
                    .to_array_view::<f32>()
                    .map_err(|e| {
                        tracing::error!("{e}");
                        e
                    })
                    .ok()?;

                let logits = logits.slice(tract_ndarray::s![.., 0, ..]);

                let norm = logits.to_owned().norm();

                let data = logits.to_owned() / norm;
                Some(PointStruct {
                    id: Some(PointId::from(uuid::Uuid::new_v4().to_string())),
                    vectors: Some(data.as_slice().unwrap().to_vec().into()),
                    payload: hashmap! {
                        "lang".into() => lang_str.to_ascii_lowercase().into(),
                        "file".into() => relative_path.to_string_lossy().as_ref().into(),
                        "snippet".into() => chunk.into(),
                    },
                    ..Default::default()
                })
            })
            .collect::<Vec<_>>();

        if datapoints.len() > 0 {
            debug!("updating docs with {} points", datapoints.len());
            Handle::current().block_on(async {
                let status = self.qdrant.upsert_points("documents", datapoints).await;
                if status.is_ok() {
                    debug!("successful upsert");
                }
            });
        }

        trace!("writing document");

        #[cfg(feature = "debug")]
        let buf_size = buffer.len();
        writer.add_document(doc!(
            self.repo_disk_path => repo_disk_path.to_string_lossy().as_ref(),
            self.file_disk_path => file_disk_path.to_string_lossy().as_ref(),
            self.relative_path => relative_path.to_string_lossy().as_ref(),
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
            self.raw_relative_path => relative_path.to_string_lossy().as_ref().as_bytes(),
        ))?;

        trace!("document written");

        #[cfg(feature = "debug")]
        {
            let elapsed = start.elapsed();
            let time: u64 = elapsed
                .as_millis()
                .try_into()
                .expect("nobody waits this long");
            self.histogram.write().unwrap().increment(time).unwrap();

            if time > self.histogram.read().unwrap().percentile(99.9).unwrap() {
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
