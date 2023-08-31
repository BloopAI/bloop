use std::{
    collections::HashMap,
    path::Path,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::Instant,
};

use async_trait::async_trait;
use ndarray::Axis;
use ort::{
    tensor::{FromArray, InputTensor, OrtOwnedTensor},
    Environment, ExecutionProvider, GraphOptimizationLevel, LoggingLevel, SessionBuilder,
};
use qdrant_client::qdrant::{PointId, PointStruct};
use serde::{Deserialize, Serialize};
use tokenizers::Tokenizer;
use tracing::{error, info, trace};

use super::Embedding;

#[derive(Default)]
pub struct EmbedQueue {
    log: scc::Queue<Mutex<Option<EmbedChunk>>>,
    len: AtomicUsize,
}

impl EmbedQueue {
    pub fn pop(&self) -> Option<EmbedChunk> {
        let Some(val) = self.log.pop()
	else {
	    return None;
	};

        // wrapping shouldn't happen, because only decrements when
        // `log` is non-empty.
        self.len.fetch_sub(1, Ordering::SeqCst);

        let val = val.lock().unwrap().take().unwrap();
        Some(val)
    }

    pub fn push(&self, chunk: EmbedChunk) {
        self.log.push(Mutex::new(Some(chunk)));
        self.len.fetch_add(1, Ordering::SeqCst);
    }

    pub fn len(&self) -> usize {
        self.len.load(Ordering::SeqCst)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[derive(Default)]
pub struct EmbedChunk {
    pub id: String,
    pub data: String,
    pub payload: HashMap<String, qdrant_client::qdrant::Value>,
}

#[async_trait]
pub trait Embedder: Send + Sync {
    fn embed(&self, data: &str) -> anyhow::Result<Embedding>;
    fn tokenizer(&self) -> &Tokenizer;
    async fn batch_embed(&self, log: &EmbedQueue, flush: bool) -> anyhow::Result<Vec<PointStruct>>;
}

pub struct LocalEmbedder {
    session: ort::Session,
    tokenizer: Tokenizer,
}

impl LocalEmbedder {
    pub fn new(model_dir: &Path) -> anyhow::Result<Self> {
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

        let session = SessionBuilder::new(&environment)?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_intra_threads(threads)?
            .with_model_from_file(model_dir.join("model.onnx"))?;

        let tokenizer = Tokenizer::from_file(model_dir.join("tokenizer.json")).unwrap();

        Ok(Self { session, tokenizer })
    }
}

#[async_trait]
impl Embedder for LocalEmbedder {
    fn embed(&self, sequence: &str) -> anyhow::Result<Embedding> {
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

    fn tokenizer(&self) -> &Tokenizer {
        &self.tokenizer
    }

    async fn batch_embed(
        &self,
        log: &EmbedQueue,
        _flush: bool,
    ) -> anyhow::Result<Vec<PointStruct>> {
        let mut output = vec![];
        while let Some(entry) = log.pop() {
            output.push(PointStruct {
                id: Some(PointId::from(entry.id)),
                vectors: Some(
                    tokio::task::block_in_place(|| self.embed(entry.data.as_ref()))?.into(),
                ),
                payload: entry.payload,
            });
        }

        Ok(output)
    }
}

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
    fn embed(&self, data: &str) -> anyhow::Result<Embedding> {
        self.embedder.embed(data)
    }

    fn tokenizer(&self) -> &Tokenizer {
        self.embedder.tokenizer()
    }

    async fn batch_embed(&self, log: &EmbedQueue, flush: bool) -> anyhow::Result<Vec<PointStruct>> {
        const MAX_BATCH_SIZE: usize = 128;
        let mut output = vec![];

        loop {
            // if we're not currently flushing the log, only process full batches
            if log.is_empty() || (log.len() < MAX_BATCH_SIZE && !flush) {
                return Ok(output);
            }

            let mut batch = vec![];

            // fill this batch with embeddings
            while let Some(embedding) = log.pop() {
                batch.push(embedding);

                if batch.len() == MAX_BATCH_SIZE {
                    break;
                }
            }

            let time = Instant::now();
            let res = self
                .make_request(ServerRequest {
                    sequence: batch
                        .iter()
                        .map(|embed| embed.data.as_ref())
                        .collect::<Vec<_>>(),
                })
                .await;
            let elapsed = time.elapsed();

            match res {
                Ok(res) => {
                    info!(?elapsed, size = batch.len(), "batch embedding successful");
                    output.extend(res.data.into_iter().zip(batch).map(|(result, src)| {
                        PointStruct {
                            id: Some(PointId::from(src.id)),
                            vectors: Some(result.embedding.into()),
                            payload: src.payload,
                        }
                    }))
                }
                Err(err) => {
                    error!(
                        ?err,
                        ?elapsed,
                        size = batch.len(),
                        "remote batch embeddings failed"
                    )
                }
            }
        }
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
