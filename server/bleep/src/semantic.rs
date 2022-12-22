use std::{collections::HashMap, path::Path};

use anyhow::Result;
use maplit::hashmap;
use ndarray_linalg::Norm;
use qdrant_client::{
    prelude::{QdrantClient, QdrantClientConfig},
    qdrant::{
        vectors_config, with_payload_selector::SelectorOptions, CreateCollection, Distance,
        PointId, PointStruct, SearchPoints, Value, VectorParams, VectorsConfig,
        WithPayloadSelector,
    },
};
use rayon::prelude::*;
use tracing::{debug, trace};
use tract_onnx::prelude::*;

pub mod chunk;

#[derive(Clone)]
pub struct Semantic {
    qdrant: Arc<QdrantClient>,
    tokenizer: Arc<tokenizers::Tokenizer>,
    onnx: Arc<SimplePlan<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>>,
}

impl Semantic {
    pub async fn new(model_dir: &Path, qdrant_url: &str) -> Self {
        let qdrant = QdrantClient::new(Some(QdrantClientConfig::from_url(qdrant_url)))
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
            qdrant: qdrant.into(),
            tokenizer: tokenizers::Tokenizer::from_file(model_dir.join("tokenizer.json"))
                .unwrap()
                .into(),
            onnx: onnx()
                .model_for_path(model_dir.join("model.onnx"))
                .unwrap()
                .into_optimized()
                .unwrap()
                .into_runnable()
                .unwrap()
                .into(),
        }
    }

    pub fn embed(&self, chunk: &str) -> Result<Vec<f32>> {
        let tokenizer_output = self.tokenizer.encode(chunk, true).unwrap();

        let input_ids = tokenizer_output.get_ids();
        let attention_mask = tokenizer_output.get_attention_mask();
        let token_type_ids = tokenizer_output.get_type_ids();

        let length = input_ids.len();

        let input_ids: Tensor = tract_ndarray::Array2::from_shape_vec(
            (1, length),
            input_ids.iter().map(|&x| x as i64).collect(),
        )?
        .into();

        let attention_mask: Tensor = tract_ndarray::Array2::from_shape_vec(
            (1, length),
            attention_mask.iter().map(|&x| x as i64).collect(),
        )?
        .into();

        let token_type_ids: Tensor = tract_ndarray::Array2::from_shape_vec(
            (1, length),
            token_type_ids.iter().map(|&x| x as i64).collect(),
        )?
        .into();

        let outputs = self
            .onnx
            .run(tvec!(input_ids, attention_mask, token_type_ids))?;

        let logits = outputs[0].to_array_view::<f32>()?;
        let logits = logits.slice(tract_ndarray::s![.., 0, ..]);
        let norm = logits.norm();

        Ok((logits.to_owned() / norm).as_slice().unwrap().to_vec())
    }

    pub async fn search(&self, query: &str, limit: u64) -> Result<Vec<HashMap<String, Value>>> {
        let response = self
            .qdrant
            .search_points(&SearchPoints {
                collection_name: "documents".to_string(),
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
        let chunks = chunk::tree_sitter(buffer, lang_str).unwrap_or_else(|e| {
            debug!(?e, %lang_str, "failed to chunk, falling back to trivial chunker");
            chunk::trivial(buffer, 15) // line-wise chunking, 15 lines per chunk
        });

        debug!(chunk_count = chunks.len(), "found chunks");
        let datapoints = chunks
            .par_iter()
            .filter(|chunk| chunk.len() > 50) // small chunks tend to skew results
            .filter_map(|&chunk| {
                debug!(
                    chunk_len = chunk.len(),
                    big_chunk = chunk.len() > 800,
                    "new chunk",
                );

                match self.embed(chunk) {
                    Ok(ok) => Some(PointStruct {
                        id: Some(PointId::from(uuid::Uuid::new_v4().to_string())),
                        vectors: Some(ok.into()),
                        payload: hashmap! {
                            "lang".into() => lang_str.to_ascii_lowercase().into(),
                            "repo_name".into() => repo_name.into(),
                            "relative_path".into() => relative_path.into(),
                            "snippet".into() => chunk.into(),
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
            let upserted = self.qdrant.upsert_points("documents", datapoints).await;
            if upserted.is_ok() {
                debug!("successful upsert");
            }
        }
    }
}
