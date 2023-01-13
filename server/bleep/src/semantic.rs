use std::{collections::HashMap, ops::Not, path::Path, sync::Arc};

use crate::{query::parser::NLQuery, Configuration};

use anyhow::Result;
use ndarray::Axis;
use ort::{
    tensor::{FromArray, InputTensor, OrtOwnedTensor},
    Environment, ExecutionProvider, GraphOptimizationLevel, LoggingLevel, SessionBuilder,
};
use qdrant_client::{
    prelude::{QdrantClient, QdrantClientConfig},
    qdrant::{
        r#match::MatchValue, vectors_config, with_payload_selector::SelectorOptions,
        CollectionOperationResponse, CreateCollection, Distance, FieldCondition, Filter, Match,
        PointId, PointStruct, SearchPoints, Value, VectorParams, VectorsConfig,
        WithPayloadSelector,
    },
};
use rayon::prelude::*;
use tracing::{debug, trace};

pub mod chunk;

const COLLECTION_NAME: &str = "documents";

#[derive(Clone)]
pub struct Semantic {
    qdrant: Arc<QdrantClient>,
    tokenizer: Arc<tokenizers::Tokenizer>,
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
    pub async fn new(
        model_dir: &Path,
        qdrant_url: &str,
        config: Arc<Configuration>,
    ) -> Result<Self> {
        let qdrant = QdrantClient::new(Some(QdrantClientConfig::from_url(qdrant_url)))
            .await
            .unwrap();

        if qdrant.has_collection(COLLECTION_NAME).await.unwrap().not() {
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

        let environment = Arc::new(
            Environment::builder()
                .with_name("Encode")
                .with_log_level(LoggingLevel::Warning)
                .with_execution_providers([ExecutionProvider::cpu()])
                .build()?,
        );

        Ok(Self {
            qdrant: qdrant.into(),
            tokenizer: tokenizers::Tokenizer::from_file(model_dir.join("tokenizer.json"))
                .unwrap()
                .into(),
            session: SessionBuilder::new(&environment)?
                .with_optimization_level(GraphOptimizationLevel::Level3)?
                .with_intra_threads(1)?
                .with_model_from_file(model_dir.join("model.onnx"))?
                .into(),
            config,
        })
    }

    pub fn embed(&self, chunk: &str, prefix: &str) -> Result<Vec<f32>> {
        let mut sequence = prefix.to_owned();
        sequence.push_str(chunk);

        let tokenizer_output = self.tokenizer.encode(sequence, true).unwrap();

        let input_ids = tokenizer_output.get_ids();
        let attention_mask = tokenizer_output.get_attention_mask();
        let token_type_ids = tokenizer_output.get_type_ids();
        let length = input_ids.len();
        trace!("embedding {} tokens {:?}", length, chunk);

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
        nl_query: &NLQuery<'a>,
        limit: u64,
    ) -> Result<Vec<HashMap<String, Value>>> {
        let Some(query) = nl_query.target() else {
            anyhow::bail!("no search target for query");
        };

        let make_kv_filter = |key, value| {
            FieldCondition {
                key,
                r#match: Some(Match {
                    match_value: MatchValue::Text(value).into(),
                }),
                ..Default::default()
            }
            .into()
        };

        let repo_filter = nl_query
            .repo()
            .map(|r| make_kv_filter("repo_name".to_string(), r.to_string()));

        let lang_filter = nl_query
            .lang()
            .map(|l| make_kv_filter("lang".to_string(), l.to_string()));

        let filters = [repo_filter, lang_filter]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>();

        let response = self
            .qdrant
            .search_points(&SearchPoints {
                collection_name: COLLECTION_NAME.to_string(),
                limit,
                vector: self.embed(query, "query: ")?,
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(SelectorOptions::Enable(true)),
                }),
                filter: Some(Filter {
                    must: filters,
                    ..Default::default()
                }),
                ..Default::default()
            })
            .await?;

        Ok(response.result.into_iter().map(|pt| pt.payload).collect())
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
        let chunks = chunk::by_tokens(
            repo_name,
            relative_path,
            buffer,
            &self.tokenizer,
            self.config.embedding_input_size,
            15,
            self.config
                .overlap
                .unwrap_or(chunk::OverlapStrategy::Partial(0.5)),
        );
        let repo_plus_file = repo_name.to_owned() + "\t" + relative_path + "\n";
        debug!(chunk_count = chunks.len(), "found chunks");
        let datapoints = chunks
            .par_iter()
            .filter(|chunk| chunk.len() > 50) // small chunks tend to skew results
            .filter_map(|chunk| {
                match self.embed(&(repo_plus_file.clone() + chunk.data), "passage: ") {
                    Ok(ok) => Some(PointStruct {
                        id: Some(PointId::from(uuid::Uuid::new_v4().to_string())),
                        vectors: Some(ok.into()),
                        payload: HashMap::from([
                            ("lang".into(), lang_str.to_ascii_lowercase().into()),
                            ("repo_name".into(), repo_name.into()),
                            ("repo_ref".into(), repo_ref.into()),
                            ("relative_path".into(), relative_path.into()),
                            ("snippet".into(), chunk.data.into()),
                            ("start_line".into(), chunk.range.start.line.to_string().into()),
                            ("end_line".into(), chunk.range.end.line.to_string().into()),
                            ("start_byte".into(), chunk.range.start.byte.to_string().into()),
                            ("end_byte".into(), chunk.range.end.byte.to_string().into()),
                        ]),
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
