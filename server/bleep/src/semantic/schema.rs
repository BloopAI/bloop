//! Every change in this file will trigger a reset of the databases.
//! Use with care.
//!
use qdrant_client::{
    prelude::QdrantClient,
    qdrant::payload_index_params::IndexParams,
    qdrant::{
        vectors_config, CollectionOperationResponse, CreateCollection, Distance, FieldType,
        PayloadIndexParams, PointsOperationResponse, TextIndexParams, VectorParams, VectorsConfig,
    },
};

pub(super) const EMBEDDING_DIM: usize = 384;
pub type Embedding = Vec<f32>;

#[derive(Default, Clone, Debug, serde::Deserialize, serde::Serialize)]
pub struct Payload {
    pub lang: String,
    pub repo_name: String,
    pub repo_ref: String,
    pub relative_path: String,
    pub content_hash: String,
    pub text: String,
    pub start_line: u64,
    pub end_line: u64,
    pub start_byte: u64,
    pub end_byte: u64,
    pub branches: Vec<String>,

    #[serde(skip)]
    pub id: Option<String>,
    #[serde(skip)]
    pub embedding: Option<Embedding>,
    #[serde(skip)]
    pub score: Option<f32>,
}

impl PartialEq for Payload {
    fn eq(&self, other: &Self) -> bool {
        self.lang == other.lang
            && self.repo_name == other.repo_name
            && self.repo_ref == other.repo_ref
            && self.relative_path == other.relative_path
            && self.content_hash == other.content_hash
            && self.text == other.text
            && self.start_line == other.start_line
            && self.end_line == other.end_line
            && self.start_byte == other.start_byte
            && self.end_byte == other.end_byte
            && self.branches == other.branches

        // ignoring deserialized fields that will not exist on a newly
        // created payload
    }
}

pub(super) async fn create_collection(
    name: &str,
    qdrant: &QdrantClient,
) -> anyhow::Result<CollectionOperationResponse> {
    qdrant
        .create_collection(&CreateCollection {
            collection_name: name.to_string(),
            vectors_config: Some(VectorsConfig {
                config: Some(vectors_config::Config::Params(VectorParams {
                    size: EMBEDDING_DIM as u64,
                    distance: Distance::Cosine.into(),
                    on_disk: Some(true),
                    ..Default::default()
                })),
            }),
            ..Default::default()
        })
        .await
}

pub(super) async fn create_lexical_index(
    name: &str,
    qdrant: &QdrantClient,
) -> anyhow::Result<PointsOperationResponse> {
    qdrant
        .create_field_index(
            name.to_string(),
            "snippet",
            FieldType::Text,
            Some(&PayloadIndexParams {
                index_params: Some(IndexParams::TextIndexParams(TextIndexParams {
                    tokenizer: 3, // word tokenizer 
                    lowercase: Some(true),
                    min_token_len: Some(2),
                    max_token_len: Some(20),
                })),
            }),
            None,
        )
        .await
}
