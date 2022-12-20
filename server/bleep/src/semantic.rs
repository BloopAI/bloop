use std::path::Path;

use maplit::hashmap;
use ndarray_linalg::Norm;
use qdrant_client::{
    prelude::{QdrantClient, QdrantClientConfig},
    qdrant::{
        vectors_config, CreateCollection, Distance, PointId, PointStruct, VectorParams,
        VectorsConfig,
    },
};
use rayon::prelude::*;
use tracing::{debug, trace};
use tract_onnx::{prelude::*, tract_hir::internal::InferenceOp};

pub mod chunk;

#[derive(Clone)]
pub struct Semantic {
    qdrant: Arc<QdrantClient>,
    tokenizer: Arc<tokenizers::Tokenizer>,
    onnx: Arc<InferenceSimplePlan<Graph<InferenceFact, Box<dyn InferenceOp + 'static>>>>,
}

impl Semantic {
    pub async fn new(model_dir: &Path, qdrant_url: &str) -> Self {
        let qdrant = QdrantClient::new(Some(QdrantClientConfig::from_url(&qdrant_url)))
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
            tokenizer: tokenizers::Tokenizer::from_file(Path::join(&model_dir, "tokenizer.json"))
                .unwrap()
                .into(),
            onnx: onnx()
                .model_for_path(Path::join(&model_dir, "model.onnx"))
                .unwrap()
                .into_runnable()
                .unwrap()
                .into(),
        }
    }

    #[tracing::instrument(skip(self, buffer))]
    pub async fn insert_points_for_buffer(&self, file_path: &Path, buffer: &str, lang_str: &str) {
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
                        "file".into() => file_path.to_string_lossy().as_ref().into(),
                        "snippet".into() => chunk.into(),
                    },
                    ..Default::default()
                })
            })
            .collect::<Vec<_>>();

        if datapoints.len() > 0 {
            debug!("updating docs with {} points", datapoints.len());
            let upserted = self.qdrant.upsert_points("documents", datapoints).await;
            if upserted.is_ok() {
                debug!("successful upsert");
            }
        }
    }
}
