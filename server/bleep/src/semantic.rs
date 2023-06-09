use std::{borrow::Cow, collections::HashMap, ops::Not, path::Path, sync::Arc};

use crate::{query::parser::SemanticQuery, Configuration};

use ndarray::Axis;
use ort::{
    tensor::{FromArray, InputTensor, OrtOwnedTensor},
    Environment, ExecutionProvider, GraphOptimizationLevel, LoggingLevel, SessionBuilder,
};
use qdrant_client::{
    prelude::{QdrantClient, QdrantClientConfig},
    qdrant::{
        r#match::MatchValue, vectors::VectorsOptions, vectors_config, with_payload_selector,
        with_vectors_selector, CollectionOperationResponse, CreateCollection, Distance,
        FieldCondition, Filter, Match, PointId, PointStruct, ScoredPoint, SearchPoints, Value,
        VectorParams, Vectors, VectorsConfig, WithPayloadSelector, WithVectorsSelector,
    },
};

use rayon::prelude::*;
use thiserror::Error;
use tracing::{debug, info, trace, warn};

pub mod chunk;
pub mod execute;
mod schema;

pub use schema::{Embedding, Payload};

const COLLECTION_NAME: &str = "documents";

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
    gpt2_tokenizer: Arc<tokenizers::Tokenizer>,
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

impl<'a> Payload<'a> {
    pub fn from_qdrant(orig: ScoredPoint) -> Payload<'static> {
        let ScoredPoint {
            payload,
            score,
            vectors,
            ..
        } = orig;

        let mut converted = payload
            .into_iter()
            .map(|(key, value)| (key, kind_to_value(value.kind)))
            .collect::<HashMap<String, serde_json::Value>>();

        let embedding = if let Some(Vectors {
            vectors_options: Some(VectorsOptions::Vector(v)),
        }) = vectors
        {
            v.data
        } else {
            panic!("got non-vector value");
        };

        Payload {
            lang: val_str!(converted, "lang"),
            repo_name: val_str!(converted, "repo_name"),
            repo_ref: val_str!(converted, "repo_ref"),
            relative_path: val_str!(converted, "relative_path"),
            text: val_str!(converted, "snippet"),
            branches: val_str!(converted, "branches"),
            start_line: val_parse_str!(converted, "start_line"),
            end_line: val_parse_str!(converted, "end_line"),
            start_byte: val_parse_str!(converted, "start_byte"),
            end_byte: val_parse_str!(converted, "end_byte"),

            score: Some(score),
            embedding: Some(embedding),
        }
    }

    fn into_qdrant(self) -> HashMap<String, Value> {
        HashMap::from([
            ("lang".into(), self.lang.to_ascii_lowercase().into()),
            ("repo_name".into(), self.repo_name.as_ref().into()),
            ("repo_ref".into(), self.repo_ref.as_ref().into()),
            ("relative_path".into(), self.relative_path.as_ref().into()),
            ("snippet".into(), self.text.as_ref().into()),
            ("start_line".into(), self.start_line.to_string().into()),
            ("end_line".into(), self.end_line.to_string().into()),
            ("start_byte".into(), self.start_byte.to_string().into()),
            ("end_byte".into(), self.end_byte.to_string().into()),
            ("branches".into(), self.branches.into()),
        ])
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
                size: 384,
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

        let environment = Arc::new(
            Environment::builder()
                .with_name("Encode")
                .with_log_level(LoggingLevel::Warning)
                .with_execution_providers([ExecutionProvider::cpu()])
                .build()?,
        );

        #[cfg(windows)]
        {
            unsafe {
                let api_base = ort::sys::OrtGetApiBase();
                let api = (*api_base).GetApi.as_ref().unwrap()(ort::sys::ORT_API_VERSION);
                (*api).DisableTelemetryEvents.as_ref().unwrap()(environment.env_ptr());
            }
        }

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
            gpt2_tokenizer: tokenizers::Tokenizer::from_file(model_dir.join("gpt-2").join("tokenizer.json"))
                .expect("unable to open gpt2-tokenizer, try `git lfs pull` and pass `--model-dir bloop/model` at the CLI")
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
        let repo_filter = {
            let conditions = parsed_query
                .repos()
                .map(|r| {
                    if r.contains('/') && !r.starts_with("github.com/") {
                        format!("github.com/{r}")
                    } else {
                        r.to_string()
                    }
                })
                .map(|r| make_kv_keyword_filter("repo_name", r.as_str()).into())
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
            let conditions = parsed_query
                .paths()
                .map(|r| make_kv_text_filter("relative_path", r).into())
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
            let conditions = parsed_query
                .langs()
                .map(|l| make_kv_keyword_filter("lang", l).into())
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
            let conditions = parsed_query
                .branch()
                .map(|l| make_kv_keyword_filter("branches", l).into())
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

        let filters = [repo_filter, path_filter, lang_filter, branch_filter]
            .into_iter()
            .flatten()
            .map(Into::into)
            .collect();

        let response = self
            .qdrant
            .search_points(&SearchPoints {
                limit,
                vector,
                collection_name: COLLECTION_NAME.to_string(),
                offset: Some(offset),
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(with_payload_selector::SelectorOptions::Enable(true)),
                }),
                filter: Some(Filter {
                    must: filters,
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
        let vector = self.embed(query)?;

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

    #[tracing::instrument(skip(self, repo_ref, relative_path, buffer))]
    pub async fn insert_points_for_buffer(
        &self,
        repo_name: &str,
        repo_ref: &str,
        relative_path: &str,
        buffer: &str,
        lang_str: &str,
        branches: &[String],
    ) {
        // Delete all points corresponding to the same path
        self.delete_points_by_path(repo_ref, std::iter::once(relative_path))
            .await;

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

        // Prepend all chunks with `repo_name   relative_path`
        let chunk_prefix = format!("{repo_name}\t{relative_path}\n");

        let datapoints = chunks
            .par_iter()
            .filter_map(
                |chunk| match self.embed(&(chunk_prefix.clone() + chunk.data)) {
                    Ok(ok) => Some(PointStruct {
                        id: Some(PointId::from(uuid::Uuid::new_v4().to_string())),
                        vectors: Some(ok.into()),
                        payload: Payload {
                            lang: lang_str.to_ascii_lowercase().into(),
                            repo_name: repo_name.into(),
                            repo_ref: repo_ref.into(),
                            relative_path: relative_path.into(),
                            branches: branches.to_owned(),
                            text: chunk.data.into(),
                            start_line: chunk.range.start.line as u64,
                            end_line: chunk.range.end.line as u64,
                            start_byte: chunk.range.start.byte as u64,
                            end_byte: chunk.range.end.byte as u64,
                            ..Default::default()
                        }
                        .into_qdrant(),
                    }),
                    Err(err) => {
                        warn!(?err, %chunk_prefix, "embedding failed");
                        None
                    }
                },
            )
            .collect::<Vec<_>>();

        if !datapoints.is_empty() {
            let num_datapoints = datapoints.len();
            debug!(point_count = num_datapoints, "updating docs");
            let upserted = self
                .qdrant
                .upsert_points(COLLECTION_NAME, datapoints, None)
                .await;
            if upserted.is_ok() {
                info!(
                    ?chunk_prefix,
                    "Successfully upserted {:?} vectors", num_datapoints
                );
            } else {
                warn!(
                    ?chunk_prefix,
                    "Failed to upsert {:?} vectors", num_datapoints
                );
            }
        } else {
            warn!(?chunk_prefix, "No vectors to insert");
        }
    }

    pub async fn delete_points_by_path(&self, repo_ref: &str, paths: impl Iterator<Item = &str>) {
        let repo_filter = make_kv_keyword_filter("repo_ref", repo_ref).into();
        let file_filter = paths
            .map(|p| make_kv_keyword_filter("relative_path", p).into())
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

    pub fn gpt2_token_count(&self, input: &str) -> usize {
        self.gpt2_tokenizer
            .encode(input, false)
            .map(|code| code.len())
            .unwrap_or(0)
    }

    pub fn overlap_strategy(&self) -> chunk::OverlapStrategy {
        self.config.overlap.unwrap_or_default()
    }
}

// Exact match filter
fn make_kv_keyword_filter(key: &str, value: &str) -> FieldCondition {
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

fn dot(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b.iter()).map(|(ai, bi)| ai * bi).sum()
}

fn norm(a: &[f32]) -> f32 {
    dot(a, a)
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    dot(a, b) / (norm(a) * norm(b))
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
