use std::{collections::HashMap, ops::Not, path::Path, sync::Arc};

use anyhow::Result;
use maplit::hashmap;
use ndarray::{s, ArrayBase, Dim, IxDynImpl, OwnedRepr};
use ort::{
    tensor::{FromArray, InputTensor, OrtOwnedTensor},
    Environment, ExecutionProvider, GraphOptimizationLevel, LoggingLevel, SessionBuilder,
};
use qdrant_client::{
    prelude::{QdrantClient, QdrantClientConfig},
    qdrant::{
        vectors_config, with_payload_selector::SelectorOptions, CollectionOperationResponse,
        CreateCollection, Distance, PointId, PointStruct, SearchPoints, Value, VectorParams,
        VectorsConfig, WithPayloadSelector,
    },
};
use rayon::prelude::*;
use tokenizers::Encoding;
use tracing::{debug, trace};

pub mod chunk;

const COLLECTION_NAME: &str = "documents";

#[derive(Clone)]
pub struct Semantic {
    qdrant: Arc<QdrantClient>,
    pub embed_tokenizer: Arc<tokenizers::Tokenizer>,
    embed_session: Arc<ort::Session>,
    pub rank_session: Arc<ort::Session>,
    pub rank_tokenizer: Arc<tokenizers::Tokenizer>,
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
    pub async fn new(model_dir: &Path, qdrant_url: &str) -> Result<Self> {
        let qdrant = QdrantClient::new(Some(QdrantClientConfig::from_url(qdrant_url))).await?;

        if qdrant.has_collection(COLLECTION_NAME).await?.not() {
            let CollectionOperationResponse { result, time } =
                qdrant.create_collection(&collection_config()).await?;

            debug!(
                time,
                created = result,
                name = COLLECTION_NAME,
                "created qdrant collection"
            );

            assert!(result);
        }

        let environment = Arc::new(
            Environment::builder()
                .with_name("CodeGen")
                .with_log_level(LoggingLevel::Warning)
                .with_execution_providers([ExecutionProvider::cpu()])
                .build()?,
        );

        Ok(Self {
            qdrant: qdrant.into(),
            embed_tokenizer: tokenizers::Tokenizer::from_file(
                model_dir.join("embedder/tokenizer.json"),
            )
            .unwrap()
            .into(),
            embed_session: SessionBuilder::new(&environment)?
                .with_optimization_level(GraphOptimizationLevel::Level3)?
                .with_intra_threads(1)?
                .with_model_from_file(model_dir.join("embedder/model.onnx"))?
                .into(),
            rank_session: SessionBuilder::new(&environment)?
                .with_optimization_level(GraphOptimizationLevel::Level3)?
                .with_intra_threads(1)?
                .with_model_from_file(model_dir.join("ranker/model.onnx"))?
                .into(),
            rank_tokenizer: tokenizers::Tokenizer::from_file(
                model_dir.join("ranker/tokenizer.json"),
            )
            .unwrap()
            .into(),
        })
    }

    pub fn encode(
        &self,
        tokens: &Encoding,
        session: Arc<ort::Session>,
    ) -> Result<ArrayBase<OwnedRepr<f32>, Dim<IxDynImpl>>> {
        let input_ids = tokens.get_ids();
        let attention_mask = tokens.get_attention_mask();
        let token_type_ids = tokens.get_type_ids();

        let length = input_ids.len();

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

        let outputs = session.run([
            InputTensor::from_array(inputs_ids_array.into_dyn()),
            InputTensor::from_array(attention_mask_array.into_dyn()),
            InputTensor::from_array(token_type_ids_array.into_dyn()),
        ])?;

        let tensor: OrtOwnedTensor<f32, _> = outputs[0].try_extract()?;
        let array = tensor.view();
        Ok(array.to_owned())
    }

    pub fn embed(&self, chunk: &str) -> Result<Vec<f32>> {
        let tokens = self.embed_tokenizer.encode(chunk, true).unwrap();
        let logits = self.encode(&tokens, self.embed_session.clone())?;
        let pooled = logits.slice(s![.., 0, ..]);
        Ok(pooled.to_owned().as_slice().unwrap().to_vec())
    }

    pub async fn search(&self, query: &str, limit: u64) -> Result<Vec<HashMap<String, Value>>> {
        let response = self
            .qdrant
            .search_points(&SearchPoints {
                collection_name: COLLECTION_NAME.to_string(),
                limit,
                vector: self.embed(query)?,
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(SelectorOptions::Enable(true)),
                }),
                ..Default::default()
            })
            .await?;

        Ok(response.result.into_iter().map(|pt| pt.payload).collect())
    }

    #[tracing::instrument(skip(self, repo_name, relative_path, buffer))]
    pub async fn insert_points_for_buffer(
        &self,
        repo_name: &str,
        relative_path: &str,
        buffer: &str,
        lang_str: &str,
    ) {
        let chunks = chunk::trivial(buffer, 15); // line-wise chunking, 15 lines per chunk

        debug!(chunk_count = chunks.len(), "found chunks");
        let datapoints = chunks
            .par_iter()
            .filter(|chunk| chunk.len() > 50) // small chunks tend to skew results
            .filter_map(|chunk| {
                debug!(
                    len = chunk.len(),
                    big_chunk = chunk.len() > 800,
                    "new chunk",
                );

                match self.embed(chunk.data) {
                    Ok(ok) => Some(PointStruct {
                        id: Some(PointId::from(uuid::Uuid::new_v4().to_string())),
                        vectors: Some(ok.into()),
                        payload: hashmap! {
                            "lang".into() => lang_str.to_ascii_lowercase().into(),
                            "repo_name".into() => repo_name.into(),
                            "relative_path".into() => relative_path.into(),
                            "snippet".into() => chunk.data.into(),
                            "start_line".into() => chunk.range.start.line.to_string().into(),
                        },
                    }),
                    Err(err) => {
                        trace!(?err, "embedding failed");
                        None
                    }
                }
            })
            .collect::<Vec<_>>();

        if !datapoints.is_empty() {
            debug!(point_count = datapoints.len(), "updating docs");
            let upserted = self.qdrant.upsert_points(COLLECTION_NAME, datapoints).await;
            if upserted.is_ok() {
                debug!("successful upsert");
            }
        }
    }
}
