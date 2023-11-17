use std::{borrow::Cow, collections::HashMap, env, path::Path, sync::Arc};

use crate::{query::parser::Query, Configuration};

use anyhow::{bail, Context};
use qdrant_client::{
    prelude::{QdrantClient, QdrantClientConfig},
    qdrant::{
        point_id::PointIdOptions, r#match::MatchValue, vectors::VectorsOptions,
        with_payload_selector, with_vectors_selector, CollectionOperationResponse, FieldCondition,
        FieldType, Filter, Match, PointId, RetrievedPoint, ScoredPoint, SearchPoints, Value,
        Vectors, WithPayloadSelector, WithVectorsSelector,
    },
};

use futures::{stream, StreamExt, TryStreamExt};
use rayon::prelude::*;
use thiserror::Error;
use tracing::{debug, error, info, warn};

pub mod chunk;
pub mod embedder;
pub mod execute;
mod schema;

pub use embedder::Embedder;
use embedder::LocalEmbedder;
use schema::{create_collection, EMBEDDING_DIM};
pub use schema::{Embedding, Payload};

#[derive(Error, Debug)]
pub enum SemanticError {
    /// Represents failure to initialize Qdrant client
    #[error("Qdrant initialization failed. Is Qdrant running on `qdrant-url`?")]
    QdrantInitializationError,

    #[cfg(feature = "onnx")]
    #[error("ONNX runtime error")]
    OnnxRuntimeError {
        #[from]
        error: ort::OrtError,
    },

    #[error("semantic error")]
    Anyhow {
        #[from]
        error: anyhow::Error,
    },
}

#[derive(Clone)]
pub struct Semantic {
    qdrant: Arc<QdrantClient>,
    embedder: Arc<dyn Embedder>,
    pub(crate) config: Arc<Configuration>,
}

macro_rules! val_str(($hash:ident, $val:expr) => { serde_json::from_value($hash.remove($val).unwrap()).unwrap() });
macro_rules! val_parse_str(($hash:ident, $val:expr) => {
    serde_json::from_value::<Cow<'_, str>>($hash.remove($val).unwrap())
        .unwrap()
        .parse()
        .unwrap()
});

impl Payload {
    pub fn from_qdrant(orig: ScoredPoint) -> Payload {
        let ScoredPoint {
            id,
            payload,
            score,
            vectors,
            ..
        } = orig;

        parse_payload(id, vectors, payload, score)
    }

    pub fn from_scroll(orig: RetrievedPoint) -> Payload {
        let RetrievedPoint {
            id,
            payload,
            vectors,
            ..
        } = orig;

        parse_payload(id, vectors, payload, 0.0)
    }

    pub(crate) fn into_qdrant(self) -> HashMap<String, Value> {
        HashMap::from([
            ("lang".into(), self.lang.to_ascii_lowercase().into()),
            ("repo_name".into(), self.repo_name.into()),
            ("repo_ref".into(), self.repo_ref.into()),
            ("relative_path".into(), self.relative_path.into()),
            ("content_hash".into(), self.content_hash.into()),
            ("snippet".into(), self.text.into()),
            ("start_line".into(), self.start_line.to_string().into()),
            ("end_line".into(), self.end_line.to_string().into()),
            ("start_byte".into(), self.start_byte.to_string().into()),
            ("end_byte".into(), self.end_byte.to_string().into()),
            ("branches".into(), self.branches.into()),
        ])
    }
}

fn parse_payload(
    id: Option<PointId>,
    vectors: Option<Vectors>,
    payload: HashMap<String, Value>,
    score: f32,
) -> Payload {
    let Some(PointId {
        point_id_options: Some(PointIdOptions::Uuid(id)),
    }) = id
    else {
        // unless the db was corrupted/written by someone else,
        // this shouldn't happen
        unreachable!("corrupted db");
    };

    let embedding = match vectors {
        None => None,
        Some(Vectors {
            vectors_options: Some(VectorsOptions::Vector(v)),
        }) => Some(v.data),
        _ => {
            // this also should probably never happen
            unreachable!("got non-vector value");
        }
    };

    let mut converted = payload
        .into_iter()
        .map(|(key, value)| (key, kind_to_value(value.kind)))
        .collect::<HashMap<String, serde_json::Value>>();

    Payload {
        lang: val_str!(converted, "lang"),
        repo_name: val_str!(converted, "repo_name"),
        repo_ref: val_str!(converted, "repo_ref"),
        relative_path: val_str!(converted, "relative_path"),
        content_hash: val_str!(converted, "content_hash"),
        text: val_str!(converted, "snippet"),
        branches: val_str!(converted, "branches"),
        start_line: val_parse_str!(converted, "start_line"),
        end_line: val_parse_str!(converted, "end_line"),
        start_byte: val_parse_str!(converted, "start_byte"),
        end_byte: val_parse_str!(converted, "end_byte"),

        id: Some(id),
        score: Some(score),
        embedding,
    }
}

fn kind_to_value(kind: Option<qdrant_client::qdrant::value::Kind>) -> serde_json::Value {
    use qdrant_client::qdrant::value::Kind;
    match kind {
        Some(Kind::NullValue(_)) => serde_json::Value::Null,
        Some(Kind::BoolValue(v)) => serde_json::Value::Bool(v),
        Some(Kind::DoubleValue(v)) => {
            serde_json::Value::Number(serde_json::Number::from_f64(v).unwrap())
        }
        Some(Kind::IntegerValue(v)) => serde_json::Value::Number(v.into()),
        Some(Kind::StringValue(v)) => serde_json::Value::String(v),
        Some(Kind::ListValue(v)) => serde_json::Value::Array(
            v.values
                .into_iter()
                .map(|v| kind_to_value(v.kind))
                .collect(),
        ),
        Some(Kind::StructValue(_v)) => todo!(),
        None => serde_json::Value::Null,
    }
}

async fn create_indexes(collection_name: &str, qdrant: &QdrantClient) -> anyhow::Result<()> {
    let text_fields = &["repo_ref", "content_hash", "branches", "relative_path"];
    for field in text_fields {
        qdrant
            .create_field_index(collection_name, field, FieldType::Text, None, None)
            .await?;
    }

    Ok(())
}

impl Semantic {
    #[tracing::instrument(fields(collection=%config.collection_name, %qdrant_url), skip_all)]
    pub async fn initialize(
        model_dir: &Path,
        qdrant_url: &str,
        config: Arc<Configuration>,
    ) -> Result<Self, SemanticError> {
        let qdrant = QdrantClient::new(Some(QdrantClientConfig::from_url(qdrant_url))).unwrap();
        debug!("initialized client");

        match qdrant.has_collection(&config.collection_name).await {
            Ok(false) => {
                let CollectionOperationResponse { result, time } =
                    create_collection(&config.collection_name, &qdrant)
                        .await
                        .unwrap();

                debug!(time, created = result, "collection created");
                assert!(result);
            }
            Ok(true) => {
                debug!("collection already exists");
            }
            Err(_) => return Err(SemanticError::QdrantInitializationError),
        }

        create_indexes(&config.collection_name, &qdrant).await?;
        debug!("indexes created");

        if let Some(dylib_dir) = config.dylib_dir.as_ref() {
            init_ort_dylib(dylib_dir);
            debug!(
                dylib_dir = dylib_dir.to_string_lossy().as_ref(),
                "initialized ORT dylib"
            );
        }

        #[cfg(feature = "ee-cloud")]
        let embedder: Arc<dyn Embedder> = if let Some(ref url) = config.embedding_server_url {
            let embedder = Arc::new(embedder::RemoteEmbedder::new(url.clone(), model_dir)?);
            debug!("using remote embedder");
            embedder
        } else {
            let embedder = Arc::new(LocalEmbedder::new(model_dir)?);
            debug!("using local embedder");
            embedder
        };

        #[cfg(not(feature = "ee-cloud"))]
        let embedder: Arc<dyn Embedder> = Arc::new(LocalEmbedder::new(model_dir)?);
        debug!("using local embedder");

        Ok(Self {
            qdrant: qdrant.into(),
            embedder,
            config,
        })
    }

    pub fn collection_name(&self) -> &str {
        &self.config.collection_name
    }

    pub fn qdrant_client(&self) -> &QdrantClient {
        &self.qdrant
    }

    pub fn embedder(&self) -> &dyn Embedder {
        self.embedder.as_ref()
    }

    pub async fn reset_collection_blocking(&self) -> anyhow::Result<()> {
        _ = self
            .qdrant
            .delete_collection(&self.config.collection_name)
            .await?;

        let deleted = 'deleted: {
            for _ in 0..60 {
                match self
                    .qdrant
                    .has_collection(&self.config.collection_name)
                    .await
                {
                    Ok(true) => {
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    }
                    Ok(false) => {
                        break 'deleted true;
                    }
                    Err(err) => {
                        error!(?err, "failed to delete qdrant collection for migration");
                    }
                }
            }
            false
        };

        if !deleted {
            error!("failed to delete qdrant collection after 60s");
            bail!("deletion failed")
        }

        let CollectionOperationResponse { result, .. } =
            create_collection(&self.config.collection_name, &self.qdrant)
                .await
                .unwrap();

        assert!(result);

        Ok(())
    }

    pub async fn health_check(&self) -> anyhow::Result<()> {
        self.qdrant.health_check().await?;
        Ok(())
    }

    pub async fn batch_search_with<'a>(
        &self,
        parsed_queries: &[Query<'a>],
        vectors: Vec<Embedding>,
        limit: u64,
        offset: u64,
        threshold: f32,
    ) -> anyhow::Result<Vec<ScoredPoint>> {
        // FIXME: This method uses `search_points` internally, and not `search_batch_points`. It's
        // not clear why, but it seems that the `batch` variant of the `qdrant` calls leads to
        // HTTP2 errors on some deployment configurations. A typical example error:
        //
        // ```
        // hyper::proto::h2::client: client response error: stream error received: stream no longer needed
        // ```
        //
        // Given that qdrant uses `tonic`, this may be a `tonic` issue, possibly similar to:
        // https://github.com/hyperium/tonic/issues/222

        // Queries should contain the same filters, so we get the first one
        let parsed_query = parsed_queries.first().unwrap();
        let filters = &build_conditions(parsed_query);

        let responses = stream::iter(vectors.into_iter())
            .map(|vector| async move {
                let points = SearchPoints {
                    limit,
                    vector,
                    collection_name: self.config.collection_name.to_string(),
                    offset: Some(offset),
                    score_threshold: Some(threshold),
                    with_payload: Some(WithPayloadSelector {
                        selector_options: Some(with_payload_selector::SelectorOptions::Enable(
                            true,
                        )),
                    }),
                    filter: Some(Filter {
                        must: filters.clone(),
                        ..Default::default()
                    }),
                    with_vectors: Some(WithVectorsSelector {
                        selector_options: Some(with_vectors_selector::SelectorOptions::Enable(
                            true,
                        )),
                    }),
                    ..Default::default()
                };

                self.qdrant.search_points(&points).await
            })
            .buffered(10)
            .try_collect::<Vec<_>>()
            .await?;

        Ok(responses.into_iter().flat_map(|r| r.result).collect())
    }

    pub async fn batch_search<'a>(
        &self,
        parsed_queries: &[Query<'a>],
        limit: u64,
        offset: u64,
        threshold: f32,
        retrieve_more: bool,
    ) -> anyhow::Result<Vec<Payload>> {
        let contents = parsed_queries
            .iter()
            .map(|q| {
                q.target
                    .as_ref()
                    .and_then(|t| t.content())
                    .and_then(|lit| lit.as_plain())
            })
            .collect::<Option<Vec<_>>>()
            .context("no search target for query")?;

        let vectors = futures::future::join_all(
            contents
                .into_iter()
                .map(|content| async move { self.embedder.embed(&content).await }),
        )
        .await
        .into_iter()
        .collect::<anyhow::Result<Vec<_>>>()?;

        tracing::trace!(?parsed_queries, "performing qdrant batch search");

        let result = self
            .batch_search_with(
                parsed_queries,
                vectors.clone(),
                if retrieve_more { limit * 2 } else { limit }, // Retrieve double `limit` and deduplicate
                offset,
                threshold,
            )
            .await;

        tracing::trace!(?result, "qdrant batch search returned");

        let results = result?
            .into_iter()
            .map(Payload::from_qdrant)
            .collect::<Vec<_>>();

        // deduplicate with mmr with respect to the mean of query vectors
        // TODO: implement a more robust multi-vector deduplication strategy
        let target_vector = mean_pool(vectors);
        Ok(deduplicate_snippets(results, target_vector, limit))
    }

    #[allow(clippy::too_many_arguments)]
    #[tracing::instrument(skip(self, repo_name, buffer))]
    pub fn chunks_for_buffer<'a>(
        &'a self,
        file_cache_key: String,
        repo_name: &'a str,
        repo_ref: &'a str,
        relative_path: &'a str,
        buffer: &'a str,
        lang_str: &'a str,
        branches: &'a [String],
    ) -> impl ParallelIterator<Item = (String, Payload)> + 'a {
        const MIN_CHUNK_TOKENS: usize = 50;

        let chunks = chunk::by_tokens(
            repo_name,
            relative_path,
            buffer,
            self.embedder.tokenizer(),
            MIN_CHUNK_TOKENS..self.config.max_chunk_tokens,
            chunk::OverlapStrategy::default(),
        );
        debug!(chunk_count = chunks.len(), "found chunks");

        chunks.into_par_iter().map(move |chunk| {
            let data = format!("{repo_name}\t{relative_path}\n{}", chunk.data);
            let payload = Payload {
                repo_name: repo_name.to_owned(),
                repo_ref: repo_ref.to_owned(),
                relative_path: relative_path.to_owned(),
                content_hash: file_cache_key.to_string(),
                text: chunk.data.to_owned(),
                lang: lang_str.to_ascii_lowercase(),
                branches: branches.to_owned(),
                start_line: chunk.range.start.line as u64,
                end_line: chunk.range.end.line as u64,
                start_byte: chunk.range.start.byte as u64,
                end_byte: chunk.range.end.byte as u64,
                ..Default::default()
            };

            (data, payload)
        })
    }

    pub async fn delete_points_for_hash(
        &self,
        repo_ref: &str,
        paths: impl Iterator<Item = String>,
    ) {
        let repo_filter = make_kv_keyword_filter("repo_ref", repo_ref).into();
        let file_filter = paths
            .map(|p| make_kv_keyword_filter("content_hash", &p).into())
            .collect::<Vec<_>>();

        let selector = Filter {
            must: vec![repo_filter],
            should: file_filter,
            ..Default::default()
        }
        .into();

        let _ = self
            .qdrant
            .delete_points(&self.config.collection_name, &selector, None)
            .await;
    }
}

/// Initialize the `ORT_DYLIB_PATH` variable, consumed by the `ort` crate.
///
/// This doesn't do anything on Windows, as tauri on Windows will automatically bundle any `.dll`
/// files found in the `target/$profile` folder. The `ort` crate by default will also copy the
/// built dynamic library over to the `target/$profile` folder, when using the download strategy.
fn init_ort_dylib(dylib_dir: impl AsRef<Path>) {
    #[cfg(target_os = "linux")]
    let lib_name = "libonnxruntime.so";
    #[cfg(target_os = "macos")]
    let lib_name = "libonnxruntime.dylib";
    #[cfg(windows)]
    let lib_name = "onnxruntime.dll";

    let ort_dylib_path = dylib_dir.as_ref().join(lib_name);

    if env::var("ORT_DYLIB_PATH").is_err() {
        env::set_var("ORT_DYLIB_PATH", ort_dylib_path);
    }
}

/// Exact match filter
pub(crate) fn make_kv_keyword_filter(key: &str, value: &str) -> FieldCondition {
    let key = key.to_owned();
    let value = value.to_owned();
    FieldCondition {
        key,
        r#match: Some(Match {
            match_value: MatchValue::Keyword(value).into(),
        }),
        ..Default::default()
    }
}

// Substring match filter
fn make_kv_text_filter(key: &str, value: &str) -> FieldCondition {
    let key = key.to_owned();
    let value = value.to_owned();
    FieldCondition {
        key,
        r#match: Some(Match {
            match_value: MatchValue::Text(value).into(),
        }),
        ..Default::default()
    }
}

fn build_conditions(query: &Query<'_>) -> Vec<qdrant_client::qdrant::Condition> {
    let repo_filter = query
        .repo
        .as_ref()
        .and_then(|lit| lit.as_plain())
        .map(|r| {
            if r.contains('/') && !r.starts_with("github.com/") {
                format!("github.com/{r}")
            } else {
                r.to_string()
            }
        })
        .map(|r| make_kv_keyword_filter("repo_name", r.as_ref()).into())
        .map(|c| Filter {
            should: vec![c],
            ..Default::default()
        });

    let path_filter = query
        .path
        .as_ref()
        .and_then(|lit| lit.as_plain())
        .map(|r| make_kv_text_filter("relative_path", r.as_ref()).into())
        .map(|c| Filter {
            should: vec![c],
            ..Default::default()
        });

    let lang_filter = query
        .lang
        .as_ref()
        .map(|l| make_kv_keyword_filter("lang", l.as_ref()).into())
        .map(|c| Filter {
            should: vec![c],
            ..Default::default()
        });

    let branch_filter = query
        .branch
        .as_ref()
        .and_then(|lit| lit.as_plain())
        .map(|l| make_kv_keyword_filter("branches", l.as_ref()).into())
        .map(|c| Filter {
            should: vec![c],
            ..Default::default()
        });

    let filters: Vec<_> = [repo_filter, path_filter, lang_filter, branch_filter]
        .into_iter()
        .flatten()
        .map(Into::into)
        .collect();

    filters
}

fn dot(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b.iter()).map(|(ai, bi)| ai * bi).sum()
}

fn norm(a: &[f32]) -> f32 {
    dot(a, a)
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    dot(a, b) / (norm(a) * norm(b))
}

// Calculate the element-wise mean of the embeddings
fn mean_pool(embeddings: Vec<Vec<f32>>) -> Vec<f32> {
    let len = embeddings.len() as f32;
    let mut result = vec![0.0; EMBEDDING_DIM];
    for embedding in embeddings {
        for (i, v) in embedding.iter().enumerate() {
            result[i] += v;
        }
    }
    result.iter_mut().for_each(|v| *v /= len);
    result
}

// returns a list of indices to preserve from `snippets`
//
// query_embedding: the embedding of the query terms
// embeddings: the list of embeddings to select from
// lambda: MMR is a weighted selection of two opposing factors:
//    - relevance to the query
//    - "novelty" or, the measure of how minimal the similarity is
//      to existing documents in the selection
//      The value of lambda skews the weightage in favor of either relevance or novelty.
//    - we add a language diversity factor to the score to encourage a range of languages in the results
//    - we also add a path diversity factor to the score to encourage a range of paths in the results
//  k: the number of embeddings to select
pub fn deduplicate_with_mmr(
    query_embedding: &[f32],
    embeddings: &[&[f32]],
    languages: &[&str],
    paths: &[&str],
    lambda: f32,
    k: usize,
) -> Vec<usize> {
    let mut idxs = vec![];
    let mut lang_counts = HashMap::new();
    let mut path_counts = HashMap::new();

    if embeddings.len() < k {
        return (0..embeddings.len()).collect();
    }

    while idxs.len() < k {
        let mut best_score = f32::NEG_INFINITY;
        let mut idx_to_add = None;

        for (i, emb) in embeddings.iter().enumerate() {
            if idxs.contains(&i) {
                continue;
            }
            let first_part = cosine_similarity(query_embedding, emb);
            let mut second_part = 0.;
            for j in idxs.iter() {
                let cos_sim = cosine_similarity(emb, embeddings[*j]);
                if cos_sim > second_part {
                    second_part = cos_sim;
                }
            }
            let mut equation_score = lambda * first_part - (1. - lambda) * second_part;

            // MMR + (1/2)^n where n is the number of times a language has been selected
            let lang_count = lang_counts.get(languages[i]).unwrap_or(&0);
            equation_score += 0.5_f32.powi(*lang_count);

            // MMR + (3/4)^n where n is the number of times a path has been selected
            let path_count = path_counts.get(paths[i]).unwrap_or(&0);
            equation_score += 0.75_f32.powi(*path_count);

            if equation_score > best_score {
                best_score = equation_score;
                idx_to_add = Some(i);
            }
        }
        if let Some(i) = idx_to_add {
            idxs.push(i);
            *lang_counts.entry(languages[i]).or_insert(0) += 1;
            *path_counts.entry(paths[i]).or_insert(0) += 1;
        }
    }
    idxs
}

fn filter_overlapping_snippets(mut snippets: Vec<Payload>) -> Vec<Payload> {
    snippets.sort_by(|a, b| {
        a.relative_path
            .cmp(&b.relative_path)
            .then(a.start_line.cmp(&b.start_line))
    });

    snippets = snippets
        .into_iter()
        .fold(Vec::<Payload>::new(), |mut deduped_snippets, snippet| {
            if let Some(prev) = deduped_snippets.last_mut() {
                if prev.relative_path == snippet.relative_path
                    && prev.end_line >= snippet.start_line
                {
                    debug!(
                        "Filtering overlapping snippets. End: {:?} - Start: {:?} from {:?}",
                        prev.end_line, snippet.start_line, prev.relative_path
                    );
                    return deduped_snippets;
                }
            }
            deduped_snippets.push(snippet);
            deduped_snippets
        });

    snippets.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
    snippets
}

pub fn deduplicate_snippets(
    mut all_snippets: Vec<Payload>,
    query_embedding: Embedding,
    output_count: u64,
) -> Vec<Payload> {
    all_snippets = filter_overlapping_snippets(all_snippets);

    let idxs = {
        let lambda = 0.5;
        let k = output_count; // number of snippets
        let embeddings = all_snippets
            .iter()
            .map(|s| s.embedding.as_deref().unwrap())
            .collect::<Vec<_>>();
        let languages = all_snippets
            .iter()
            .map(|s| s.lang.as_ref())
            .collect::<Vec<_>>();
        let paths = all_snippets
            .iter()
            .map(|s| s.relative_path.as_ref())
            .collect::<Vec<_>>();
        deduplicate_with_mmr(
            &query_embedding,
            &embeddings,
            &languages,
            &paths,
            lambda,
            k as usize,
        )
    };

    info!("preserved idxs after MMR are {:?}", idxs);

    all_snippets
        .drain(..)
        .enumerate()
        .filter_map(|(ref i, payload)| {
            if idxs.contains(i) {
                Some(payload)
            } else {
                None
            }
        })
        .collect()
}
