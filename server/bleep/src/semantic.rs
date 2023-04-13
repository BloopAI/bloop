use std::{collections::HashMap, ops::Not, path::Path, sync::Arc};

use crate::{query::parser::NLQuery, Configuration};

use ndarray::Axis;
use ort::{
    tensor::{FromArray, InputTensor, OrtOwnedTensor},
    Environment, ExecutionProvider, GraphOptimizationLevel, LoggingLevel, SessionBuilder,
};
use qdrant_client::{
    prelude::{QdrantClient, QdrantClientConfig},
    qdrant::{
        r#match::MatchValue, vectors_config, with_payload_selector, with_vectors_selector,
        CollectionOperationResponse, CreateCollection, Distance, FieldCondition, Filter, Match,
        PointId, PointStruct, ScoredPoint, SearchPoints, VectorParams, VectorsConfig,
        WithPayloadSelector, WithVectorsSelector,
    },
};

use rayon::prelude::*;
use thiserror::Error;
use tracing::{debug, info, trace, warn};

pub mod chunk;

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

fn collection_config() -> CreateCollection {
    CreateCollection {
        collection_name: COLLECTION_NAME.to_string(),
        vectors_config: Some(VectorsConfig {
            config: Some(vectors_config::Config::Params(VectorParams {
                size: 384,
                distance: Distance::Cosine.into(),
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
        let qdrant = QdrantClient::new(Some(QdrantClientConfig::from_url(qdrant_url)))
            .await
            .unwrap();

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

    pub fn embed(&self, sequence: &str) -> anyhow::Result<Vec<f32>> {
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

    pub async fn search<'a>(
        &self,
        parsed_query: &NLQuery<'a>,
        limit: u64,
    ) -> anyhow::Result<Vec<ScoredPoint>> {
        let Some(query) = parsed_query.target() else {
            anyhow::bail!("no search target for query");
        };

        let repo_filter = parsed_query
            .repo()
            .map(|r| make_kv_filter("repo_name", r).into());

        let lang_filter = parsed_query
            .lang()
            .map(|l| make_kv_filter("lang", l).into());

        let filters = [repo_filter, lang_filter]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>();

        let response = self
            .qdrant
            .search_points(&SearchPoints {
                collection_name: COLLECTION_NAME.to_string(),
                limit,
                vector: self.embed(query)?,
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

    #[tracing::instrument(skip(self, repo_ref, relative_path, buffer))]
    pub async fn insert_points_for_buffer(
        &self,
        repo_name: &str,
        repo_ref: &str,
        relative_path: &str,
        buffer: &str,
        lang_str: &str,
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
                        payload: HashMap::from([
                            ("lang".into(), lang_str.to_ascii_lowercase().into()),
                            ("repo_name".into(), repo_name.into()),
                            ("repo_ref".into(), repo_ref.into()),
                            ("relative_path".into(), relative_path.into()),
                            ("snippet".into(), chunk.data.into()),
                            (
                                "start_line".into(),
                                chunk.range.start.line.to_string().into(),
                            ),
                            ("end_line".into(), chunk.range.end.line.to_string().into()),
                            (
                                "start_byte".into(),
                                chunk.range.start.byte.to_string().into(),
                            ),
                            ("end_byte".into(), chunk.range.end.byte.to_string().into()),
                        ]),
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
            let upserted = self.qdrant.upsert_points(COLLECTION_NAME, datapoints).await;
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
        let repo_filter = make_kv_filter("repo_ref", repo_ref).into();
        let file_filter = paths
            .map(|p| make_kv_filter("relative_path", p).into())
            .collect::<Vec<_>>();
        let selector = Filter {
            must: vec![repo_filter],
            should: file_filter,
            ..Default::default()
        }
        .into();
        let _ = self.qdrant.delete_points(COLLECTION_NAME, &selector).await;
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

fn make_kv_filter(key: &str, value: &str) -> FieldCondition {
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
//  k: the number of embeddings to select
pub fn deduplicate_with_mmr(
    query_embedding: &[f32],
    embeddings: &[&[f32]],
    lambda: f32,
    k: usize,
) -> Vec<usize> {
    let mut idxs = vec![];

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
            let equation_score = lambda * first_part - (1. - lambda) * second_part;
            if equation_score > best_score {
                best_score = equation_score;
                idx_to_add = Some(i);
            }
        }
        if let Some(i) = idx_to_add {
            idxs.push(i);
        }
    }
    idxs
}
