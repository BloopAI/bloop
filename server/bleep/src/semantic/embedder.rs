use std::{
    collections::HashMap,
    path::Path,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
};

use async_trait::async_trait;
use tokenizers::Tokenizer;

use super::Embedding;

#[cfg(feature = "ee-cloud")]
pub use crate::ee::embedder::*;

#[derive(Default)]
pub struct EmbedQueue {
    log: scc::Queue<Mutex<Option<EmbedChunk>>>,
    len: AtomicUsize,
}

impl EmbedQueue {
    pub fn pop(&self) -> Option<EmbedChunk> {
        let Some(val) = self.log.pop() else {
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
    async fn embed(&self, data: &str) -> anyhow::Result<Embedding>;
    fn tokenizer(&self) -> &Tokenizer;
    async fn batch_embed(&self, log: Vec<&str>) -> anyhow::Result<Vec<Embedding>>;
}

#[cfg(all(not(feature = "metal"), feature = "onnx"))]
pub use cpu::LocalEmbedder;
#[cfg(all(not(feature = "onnx"), feature = "metal"))]
pub use gpu::LocalEmbedder;

#[cfg(all(not(feature = "metal"), feature = "onnx"))]
mod cpu {
    use super::*;
    #[cfg(feature = "ee")]
    pub use crate::ee::embedder::*;
    use ndarray::Axis;
    use ort::{
        tensor::OrtOwnedTensor, value::Value, Environment, ExecutionProvider,
        GraphOptimizationLevel, LoggingLevel, SessionBuilder,
    };
    use tracing::trace;

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
                    .with_execution_providers([
                        ExecutionProvider::DirectML(None),
                        ExecutionProvider::CPU(None),
                    ])
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
        async fn embed(&self, sequence: &str) -> anyhow::Result<Embedding> {
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

            let outputs = self.session.run(vec![
                Value::from_array(
                    self.session.allocator(),
                    &ndarray::CowArray::from(inputs_ids_array).into_dyn(),
                )
                .unwrap(),
                Value::from_array(
                    self.session.allocator(),
                    &ndarray::CowArray::from(attention_mask_array).into_dyn(),
                )
                .unwrap(),
                Value::from_array(
                    self.session.allocator(),
                    &ndarray::CowArray::from(token_type_ids_array).into_dyn(),
                )
                .unwrap(),
            ])?;

            let output_tensor: OrtOwnedTensor<f32, _> = outputs[0].try_extract().unwrap();
            let sequence_embedding = &*output_tensor.view();
            let pooled = sequence_embedding.mean_axis(Axis(1)).unwrap();
            Ok(pooled.to_owned().as_slice().unwrap().to_vec())
        }

        fn tokenizer(&self) -> &Tokenizer {
            &self.tokenizer
        }

        async fn batch_embed(&self, log: Vec<&str>) -> anyhow::Result<Vec<Embedding>> {
            log.into_iter()
                .map(|entry| {
                    tokio::task::block_in_place(|| {
                        tokio::runtime::Handle::current()
                            .block_on(async { self.embed(entry).await })
                    })
                })
                .collect::<anyhow::Result<Vec<Embedding>>>()
        }
    }
}

#[cfg(all(not(feature = "onnx"), feature = "metal"))]
mod gpu {
    use super::*;
    use tracing::{error, info};

    pub struct LocalEmbedder {
        model: Box<dyn llm::Model>,
        sessions: Vec<Arc<tokio::sync::Mutex<llm::InferenceSession>>>,
        tokenizer: Tokenizer,
        permits: Arc<tokio::sync::Semaphore>,
    }

    // InferenceSession is explicitly not Sync because it uses ggml::Tensor internally,
    // Bert does not make use of these tensors however
    unsafe impl Sync for LocalEmbedder {}

    impl LocalEmbedder {
        pub fn new(model_dir: &Path) -> anyhow::Result<Self> {
            let model_params = llm::ModelParameters {
                use_gpu: true,
                ..Default::default()
            };

            let model = llm::load_dynamic(
                Some(llm::ModelArchitecture::Bert),
                &model_dir.join("ggml").join("ggml-model-q4_0.bin"),
                // this tokenizer is used for embedding
                llm::TokenizerSource::HuggingFaceTokenizerFile(
                    model_dir.join("ggml").join("tokenizer.json"),
                ),
                model_params,
                llm::load_progress_callback_stdout,
            )?;

            // TODO: this can be parameterized
            //
            // the lower this number, the more time we might spend waiting to run an embedding.
            // the higher this number, the more vram we use, currently we use ~2G per session. this
            // can be fixed by disabling scratch buffers in ggml, bert has no use for this.
            let session_count = 3;

            info!(%session_count, "spawned inference sessions");

            let sessions = (0..session_count)
                .map(|_| {
                    model.start_session(llm::InferenceSessionConfig {
                        ..Default::default()
                    })
                })
                .map(tokio::sync::Mutex::new)
                .map(Arc::new)
                .collect();

            // this tokenizer is used for chunking - do not pad or truncate chunks
            let mut tokenizer =
                Tokenizer::from_file(model_dir.join("ggml").join("tokenizer.json")).unwrap();
            let _ = tokenizer.with_padding(None).with_truncation(None);

            Ok(Self {
                model,
                sessions,
                tokenizer,
                permits: Arc::new(tokio::sync::Semaphore::new(session_count)),
            })
        }
    }

    #[async_trait]
    impl Embedder for LocalEmbedder {
        async fn embed(&self, sequence: &str) -> anyhow::Result<Embedding> {
            let mut output_request = llm::OutputRequest {
                all_logits: None,
                embeddings: Some(Vec::new()),
            };
            let vocab = self.model.tokenizer();
            let beginning_of_sentence = true;
            let query_token_ids = vocab
                .tokenize(sequence, beginning_of_sentence)
                .unwrap()
                .iter()
                .map(|(_, tok)| *tok)
                .collect::<Vec<_>>();

            if let Ok(_permit) = self.permits.acquire().await {
                for s in &self.sessions {
                    if let Ok(mut session) = s.try_lock() {
                        self.model
                            .evaluate(&mut session, &query_token_ids, &mut output_request);
                        return Ok(output_request.embeddings.unwrap());
                    }
                }
            }

            unreachable!();
        }

        fn tokenizer(&self) -> &Tokenizer {
            &self.tokenizer
        }

        async fn batch_embed(&self, log: Vec<&str>) -> anyhow::Result<Vec<Embedding>> {
            // do not send empty batches to the model
            if log.is_empty() {
                return Ok(vec![]);
            }
            let mut output_request = llm::OutputRequest {
                all_logits: None,
                embeddings: Some(Vec::new()),
            };
            let vocab = self.model.tokenizer();
            let beginning_of_sentence = true;
            let query_token_ids = log
                .iter()
                .map(|sequence| {
                    vocab
                        .tokenize(sequence, beginning_of_sentence)
                        .unwrap()
                        .iter()
                        .map(|(_, tok)| *tok)
                        .collect::<Vec<_>>()
                })
                .collect::<Vec<_>>();
            let query_token_ids: Vec<_> = query_token_ids.iter().map(AsRef::as_ref).collect();

            if let Ok(_permit) = self.permits.acquire().await {
                for s in &self.sessions {
                    if let Ok(mut session) = s.try_lock() {
                        self.model.batch_evaluate(
                            &mut session,
                            &query_token_ids,
                            &mut output_request,
                        );
                        let embedding: Vec<Vec<f32>> = output_request
                            .embeddings
                            .unwrap()
                            .chunks(crate::semantic::schema::EMBEDDING_DIM)
                            .inspect(|chunk| {
                                if chunk.iter().any(|f| f.is_nan()) {
                                    error!("found nan in sequence");
                                }
                            })
                            .map(|chunk| chunk.to_vec())
                            .collect();
                        return Ok(embedding);
                    }
                }
            }
            unreachable!()
        }
    }
}
