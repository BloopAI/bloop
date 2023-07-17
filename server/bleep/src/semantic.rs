use std::{borrow::Cow, collections::HashMap, env, ops::Not, path::Path, sync::Arc};

use crate::{query::parser::SemanticQuery, Configuration};

use ndarray::Axis;
use ort::{
    tensor::{FromArray, InputTensor, OrtOwnedTensor},
    Environment, ExecutionProvider, GraphOptimizationLevel, LoggingLevel, SessionBuilder,
};
use qdrant_client::{
    prelude::{QdrantClient, QdrantClientConfig},
    qdrant::{
        point_id::PointIdOptions, r#match::MatchValue, vectors::VectorsOptions, vectors_config,
        with_payload_selector, with_vectors_selector, CollectionOperationResponse,
        CreateCollection, Distance, FieldCondition, Filter, Match, PointId, RetrievedPoint,
        ScoredPoint, SearchPoints, Value, VectorParams, Vectors, VectorsConfig,
        WithPayloadSelector, WithVectorsSelector,
    },
};

use futures::{stream, StreamExt, TryStreamExt};
use rand::{prelude::Distribution, thread_rng};
use rayon::prelude::*;
use thiserror::Error;
use tracing::{debug, error, info, trace, warn};

pub mod chunk;
pub mod execute;
mod schema;

pub use schema::{Embedding, Payload};

pub(crate) const COLLECTION_NAME: &str = "documents";
pub(crate) const SCORE_THRESHOLD: f32 = 0.3;
pub(crate) const EMBEDDING_DIM: usize = 384;

#[derive(Error, Debug)]
pub enum SemanticError {
    /// Represents failure to initialize Qdrant client
    #[error("Qdrant initialization failed. Is Qdrant running on `qdrant-url`?")]
    QdrantInitializationError,

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
    tokenizer: Arc<tokenizers::Tokenizer>,
    session: Arc<ort::Session>,
    config: Arc<Configuration>,
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
    let Some(PointId { point_id_options: Some(PointIdOptions::Uuid(id)) }) = id
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

fn collection_config() -> CreateCollection {
    CreateCollection {
        collection_name: COLLECTION_NAME.to_string(),
        vectors_config: Some(VectorsConfig {
            config: Some(vectors_config::Config::Params(VectorParams {
                size: EMBEDDING_DIM as u64,
                distance: Distance::Cosine.into(),
                ..Default::default()
            })),
        }),
        ..Default::default()
    }
}

impl Semantic {
    pub async fn initialize(
        model_dir: &Path,
        qdrant_url: &str,
        config: Arc<Configuration>,
    ) -> Result<Self, SemanticError> {
        let qdrant = QdrantClient::new(Some(QdrantClientConfig::from_url(qdrant_url))).unwrap();

        match qdrant.has_collection(COLLECTION_NAME).await {
            Ok(has_collection) => {
                if has_collection.not() {
                    let CollectionOperationResponse { result, time } = qdrant
                        .create_collection(&collection_config())
                        .await
                        .unwrap();

                    debug!(
                        time,
                        created = result,
                        name = COLLECTION_NAME,
                        "created qdrant collection"
                    );

                    assert!(result);
                }
            }
            Err(_) => return Err(SemanticError::QdrantInitializationError),
        }

        if let Some(dylib_dir) = config.dylib_dir.as_ref() {
            init_ort_dylib(dylib_dir);
        }

        let environment = Arc::new(
            Environment::builder()
                .with_name("Encode")
                .with_log_level(LoggingLevel::Warning)
                .with_execution_providers([ExecutionProvider::cpu()])
                .with_telemetry(false)
                .build()?,
        );

        let threads = if let Ok(v) = std::env::var("NUM_OMP_THREADS") {
            str::parse(&v).unwrap_or(1)
        } else {
            1
        };

        Ok(Self {
            qdrant: qdrant.into(),
            tokenizer: tokenizers::Tokenizer::from_file(model_dir.join("tokenizer.json"))
                .unwrap()
                .into(),
            session: SessionBuilder::new(&environment)?
                .with_optimization_level(GraphOptimizationLevel::Level3)?
                .with_intra_threads(threads)?
                .with_model_from_file(model_dir.join("model.onnx"))?
                .into(),
            config,
        })
    }

    pub async fn health_check(&self) -> anyhow::Result<()> {
        self.qdrant.health_check().await?;
        Ok(())
    }

    pub fn embed(&self, sequence: &str) -> anyhow::Result<Embedding> {
        let tokenizer_output = self.tokenizer.encode(sequence, true).unwrap();

        let input_ids = tokenizer_output.get_ids();
        let attention_mask = tokenizer_output.get_attention_mask();
        let token_type_ids = tokenizer_output.get_type_ids();
        let length = input_ids.len();
        trace!("embedding {} tokens {:?}", length, sequence);

        let inputs_ids_array = ndarray::Array::from_shape_vec(
            (1, length),
            input_ids.iter().map(|&x| x as i64).collect(),
        )?;

        let attention_mask_array = ndarray::Array::from_shape_vec(
            (1, length),
            attention_mask.iter().map(|&x| x as i64).collect(),
        )?;

        let token_type_ids_array = ndarray::Array::from_shape_vec(
            (1, length),
            token_type_ids.iter().map(|&x| x as i64).collect(),
        )?;

        let outputs = self.session.run([
            InputTensor::from_array(inputs_ids_array.into_dyn()),
            InputTensor::from_array(attention_mask_array.into_dyn()),
            InputTensor::from_array(token_type_ids_array.into_dyn()),
        ])?;

        let output_tensor: OrtOwnedTensor<f32, _> = outputs[0].try_extract().unwrap();
        let sequence_embedding = &*output_tensor.view();
        let pooled = sequence_embedding.mean_axis(Axis(1)).unwrap();
        Ok(pooled.to_owned().as_slice().unwrap().to_vec())
    }

    pub async fn search_with<'a>(
        &self,
        parsed_query: &SemanticQuery<'a>,
        vector: Embedding,
        limit: u64,
        offset: u64,
    ) -> anyhow::Result<Vec<ScoredPoint>> {
        let response = self
            .qdrant
            .search_points(&SearchPoints {
                limit,
                vector,
                collection_name: COLLECTION_NAME.to_string(),
                offset: Some(offset),
                score_threshold: Some(SCORE_THRESHOLD),
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(with_payload_selector::SelectorOptions::Enable(true)),
                }),
                filter: Some(Filter {
                    must: build_conditions(parsed_query),
                    ..Default::default()
                }),
                with_vectors: Some(WithVectorsSelector {
                    selector_options: Some(with_vectors_selector::SelectorOptions::Enable(true)),
                }),
                ..Default::default()
            })
            .await?;

        Ok(response.result)
    }

    pub async fn batch_search_with<'a>(
        &self,
        parsed_queries: &[&SemanticQuery<'a>],
        vectors: Vec<Embedding>,
        limit: u64,
        offset: u64,
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
                    collection_name: COLLECTION_NAME.to_string(),
                    offset: Some(offset),
                    score_threshold: Some(SCORE_THRESHOLD),
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

    pub async fn search<'a>(
        &self,
        parsed_query: &SemanticQuery<'a>,
        limit: u64,
        offset: u64,
        retrieve_more: bool,
    ) -> anyhow::Result<Vec<Payload>> {
        let Some(query) = parsed_query.target() else {
            anyhow::bail!("no search target for query");
        };
        let vector = self.embed(&query)?;

        // TODO: Remove the need for `retrieve_more`. It's here because:
        // In /q `limit` is the maximum number of results returned (the actual number will often be lower due to deduplication)
        // In /answer we want to retrieve `limit` results exactly
        let results = self
            .search_with(
                parsed_query,
                vector.clone(),
                if retrieve_more { limit * 2 } else { limit }, // Retrieve double `limit` and deduplicate
                offset,
            )
            .await
            .map(|raw| {
                raw.into_iter()
                    .map(Payload::from_qdrant)
                    .collect::<Vec<_>>()
            })?;
        Ok(deduplicate_snippets(results, vector, limit))
    }

    pub async fn batch_search<'a>(
        &self,
        parsed_queries: &[&SemanticQuery<'a>],
        limit: u64,
        offset: u64,
        retrieve_more: bool,
    ) -> anyhow::Result<Vec<Payload>> {
        if parsed_queries.iter().any(|q| q.target().is_none()) {
            anyhow::bail!("no search target for query");
        };

        let vectors = parsed_queries
            .iter()
            .map(|q| self.embed(&q.target().unwrap()))
            .collect::<anyhow::Result<Vec<_>>>()?;

        tracing::trace!(?parsed_queries, "performing qdrant batch search");

        let result = self
            .batch_search_with(
                parsed_queries,
                vectors.clone(),
                if retrieve_more { limit * 2 } else { limit }, // Retrieve double `limit` and deduplicate
                offset,
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
    #[tracing::instrument(skip(self, repo_ref, relative_path, buffer))]
    pub async fn insert_points_for_buffer(
        &self,
        repo_name: &str,
        repo_ref: &str,
        tantivy_cache_key: &str,
        relative_path: &str,
        buffer: &str,
        lang_str: &str,
        branches: &[String],
        is_cold_run: bool,
    ) {
        let chunk_cache = 'cache: {
            // Wait for some time here.
            //
            // In practice it looks like IF there's a backlog in
            // qdrant, it will take a few seconds to resolve.
            //
            // To avoid exacerbating any issues, the individual worker
            // threads should ping qdrant offset, and not dump new
            // queries on it simultaneously.
            let rand = rand::distributions::Uniform::new(500, 1500);
            for (_, backoff) in (0..30).zip(rand.sample_iter(&mut thread_rng())) {
                let cache = crate::cache::ChunkCache::for_file(
                    &self.qdrant,
                    tantivy_cache_key,
                    is_cold_run,
                )
                .await;

                match cache {
                    Ok(cache) => break 'cache Some(cache),
                    Err(err) => {
                        error!(?err, "failed to initialize cache");
                        tokio::time::sleep(tokio::time::Duration::from_millis(backoff)).await;
                    }
                }
            }

            None
        }
        .expect("qdrant error");

        let chunks = chunk::by_tokens(
            repo_name,
            relative_path,
            buffer,
            &self.tokenizer,
            50..self.config.max_chunk_tokens,
            15,
            self.overlap_strategy(),
        );
        debug!(chunk_count = chunks.len(), "found chunks");

        let embedder = |c: &str| {
            info!("generating embedding");
            self.embed(c)
        };
        chunks.par_iter().for_each(|chunk| {
            let data = format!("{repo_name}\t{relative_path}\n{}", chunk.data,);
            let payload = Payload {
                repo_name: repo_name.to_owned(),
                repo_ref: repo_ref.to_owned(),
                relative_path: relative_path.to_owned(),
                content_hash: tantivy_cache_key.to_owned(),
                text: chunk.data.to_owned(),
                lang: lang_str.to_ascii_lowercase(),
                branches: branches.to_owned(),
                start_line: chunk.range.start.line as u64,
                end_line: chunk.range.end.line as u64,
                start_byte: chunk.range.start.byte as u64,
                end_byte: chunk.range.end.byte as u64,
                ..Default::default()
            };

            let cached = chunk_cache.update_or_embed(&data, embedder, payload);
            if let Err(err) = cached {
                warn!(?err, %repo_name, %relative_path, "embedding failed");
            }
        });

        match chunk_cache.commit().await {
            Ok((new, updated, deleted)) => {
                info!(
                    repo_name,
                    relative_path, new, updated, deleted, "Successful commit"
                )
            }
            Err(err) => {
                warn!(repo_name, relative_path, ?err, "Failed to upsert vectors")
            }
        }
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
            .delete_points(COLLECTION_NAME, &selector, None)
            .await;
    }

    pub fn overlap_strategy(&self) -> chunk::OverlapStrategy {
        self.config.overlap.unwrap_or_default()
    }
}

/// Initialize the `ORT_DYLIB_PATH` variable, consumed by the `ort` crate.
///
/// This doesn't do anything on Windows, as tauri on Windows will automatically bundle any `.dll`
/// files found in the `target/$profile` folder. The `ort` crate by default will also copy the
/// built dynamic library over to the `target/$profile` folder, when using the download strategy.
fn init_ort_dylib(dylib_dir: impl AsRef<Path>) {
    #[cfg(not(windows))]
    {
        #[cfg(target_os = "linux")]
        let lib_name = "libonnxruntime.so";
        #[cfg(target_os = "macos")]
        let lib_name = "libonnxruntime.dylib";

        let ort_dylib_path = dylib_dir.as_ref().join(lib_name);

        if env::var("ORT_DYLIB_PATH").is_err() {
            env::set_var("ORT_DYLIB_PATH", ort_dylib_path);
        }
    }
}

// Exact match filter
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

fn build_conditions(query: &SemanticQuery<'_>) -> Vec<qdrant_client::qdrant::Condition> {
    let repo_filter = {
        let conditions = query
            .repos()
            .map(|r| {
                if r.contains('/') && !r.starts_with("github.com/") {
                    format!("github.com/{r}")
                } else {
                    r.to_string()
                }
            })
            .map(|r| make_kv_keyword_filter("repo_name", r.as_ref()).into())
            .collect::<Vec<_>>();
        // one of the above repos should match
        if conditions.is_empty() {
            None
        } else {
            Some(Filter {
                should: conditions,
                ..Default::default()
            })
        }
    };

    let path_filter = {
        let conditions = query
            .paths()
            .map(|r| make_kv_text_filter("relative_path", r.as_ref()).into())
            .collect::<Vec<_>>();
        if conditions.is_empty() {
            None
        } else {
            Some(Filter {
                should: conditions,
                ..Default::default()
            })
        }
    };

    let lang_filter = {
        let conditions = query
            .langs()
            .map(|l| make_kv_keyword_filter("lang", l.as_ref()).into())
            .collect::<Vec<_>>();
        // one of the above langs should match
        if conditions.is_empty() {
            None
        } else {
            Some(Filter {
                should: conditions,
                ..Default::default()
            })
        }
    };

    let branch_filter = {
        let conditions = query
            .branch()
            .map(|l| make_kv_keyword_filter("branches", l.as_ref()).into())
            .collect::<Vec<_>>();

        if conditions.is_empty() {
            None
        } else {
            Some(Filter {
                should: conditions,
                ..Default::default()
            })
        }
    };

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
//    - we add a language diversity factor to the score to encourage a range of langauges in the results
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
