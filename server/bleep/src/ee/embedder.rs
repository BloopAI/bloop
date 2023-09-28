use std::path::Path;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokenizers::Tokenizer;

use crate::semantic::{embedder::*, Embedding};

pub struct RemoteEmbedder {
    url: reqwest::Url,
    session: reqwest::Client,
    embedder: LocalEmbedder,
}

impl RemoteEmbedder {
    pub fn new(url: reqwest::Url, model_dir: &Path) -> anyhow::Result<Self> {
        let url = url.join("encode")?;
        Ok(Self {
            url,
            session: reqwest::Client::builder().gzip(true).build()?,
            embedder: LocalEmbedder::new(model_dir)?,
        })
    }

    async fn make_request(&self, request: ServerRequest<'_>) -> anyhow::Result<ServerResponse> {
        Ok(self
            .session
            .post(self.url.clone())
            .json(&request)
            .send()
            .await?
            .json()
            .await?)
    }
}

#[async_trait]
impl Embedder for RemoteEmbedder {
    async fn embed(&self, data: &str) -> anyhow::Result<Embedding> {
        self.embedder.embed(data)
    }

    fn tokenizer(&self) -> &Tokenizer {
        self.embedder.tokenizer()
    }

    async fn batch_embed(&self, sequence: Vec<&str>) -> anyhow::Result<Vec<Embedding>> {
        Ok(self
            .make_request(ServerRequest { sequence })
            .await?
            .data
            .into_iter()
            .map(|p| p.embedding)
            .collect())
    }
}

#[derive(Serialize)]
struct ServerRequest<'a> {
    sequence: Vec<&'a str>,
}

#[derive(Debug, Deserialize)]
struct ServerResponse {
    data: Vec<Processed>,
}

#[derive(Debug, Deserialize)]
struct Processed {
    embedding: Embedding,
}
