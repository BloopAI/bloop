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

#[cfg(feature = "ee")]
pub use crate::ee::embedder::*;

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
    async fn embed(&self, data: &str) -> anyhow::Result<Embedding>;
    fn tokenizer(&self) -> &Tokenizer;
    async fn batch_embed(&self, log: Vec<&str>) -> anyhow::Result<Vec<Embedding>>;
}

#[cfg(not(feature = "metal"))]
pub use cpu::LocalEmbedder;
#[cfg(feature = "metal")]
pub use gpu::LocalEmbedder;

#[cfg(not(feature = "metal"))]
mod cpu {
    use super::*;
    #[cfg(feature = "ee")]
    pub use crate::ee::embedder::*;
    use ndarray::Axis;
    use ort::{
        tensor::{FromArray, InputTensor, OrtOwnedTensor},
        Environment, ExecutionProvider, GraphOptimizationLevel, LoggingLevel, SessionBuilder,
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

#[cfg(feature = "metal")]
mod gpu {
    use super::*;
    use tracing::{error, info};

    pub struct LocalEmbedder {
        ctx: Vec<Arc<tokio::sync::Mutex<(Box<dyn llm::Model>, llm::InferenceSession)>>>,
        tokenizer: Tokenizer,
        permits: Arc<tokio::sync::Semaphore>,
    }

    // InferenceSession is explicitly not Sync because it uses ggml::Tensor internally,
    // Bert does not make use of these tensors however
    unsafe impl Sync for LocalEmbedder {}

    impl LocalEmbedder {
        pub fn new(model_dir: &Path) -> anyhow::Result<Self> {
            // TODO: this can be parameterized
            //
            // the lower this number, the more time we might spend waiting to run an embedding.
            // the higher this number, the more vram we use, currently we use ~2G per session. this
            // can be fixed by disabling scratch buffers in ggml, bert has no use for this.
            let session_count = 1;

            info!(%session_count, "spawned inference sessions");

            let ctx = (0..session_count)
                .map(|_| {
                    let mut model_params = llm::ModelParameters::default();
                    model_params.use_gpu = true;
                    let model = llm::load_dynamic(
                        Some(llm::ModelArchitecture::Bert),
                        &model_dir.join("ggml").join("ggml-model-q4_0.bin"),
                        // this tokenizer is used for embedding
                        llm::TokenizerSource::HuggingFaceTokenizerFile(
                            model_dir.join("ggml").join("tokenizer.json"),
                        ),
                        model_params,
                        llm::load_progress_callback_stdout,
                    )
                    .unwrap();
                    let session = model.start_session(Default::default());
                    (model, session)
                })
                .map(tokio::sync::Mutex::new)
                .map(Arc::new)
                .collect();

            // this tokenizer is used for chunking - do not pad or truncate chunks
            let mut tokenizer =
                Tokenizer::from_file(model_dir.join("ggml").join("tokenizer.json")).unwrap();
            let _ = tokenizer.with_padding(None).with_truncation(None);

            Ok(Self {
                ctx,
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
            if let Ok(_permit) = self.permits.acquire().await {
                for s in &self.ctx {
                    if let Ok(mut guard) = s.try_lock() {
                        let guard = &mut *guard;
                        let model = &guard.0;
                        let session = &mut guard.1;
                        let vocab = model.tokenizer();
                        let beginning_of_sentence = true;
                        let query_token_ids = vocab
                            .tokenize(sequence, beginning_of_sentence)
                            .unwrap()
                            .iter()
                            .map(|(_, tok)| *tok)
                            .collect::<Vec<_>>();

                        let n = tokio::time::Instant::now();
                        model.evaluate(session, &query_token_ids, &mut output_request);
                        println!("took {}ms", n.elapsed().as_millis());
                        return Ok(output_request.embeddings.unwrap());
                    }
                }
            }

            unreachable!();
        }

        async fn batch_embed(&self, log: Vec<&str>) -> anyhow::Result<Vec<Embedding>> {
            if log.len() == 1 {
                return self.embed(log[0]).await.map(|v| vec![v]);
            }
            let mut output_request = llm::OutputRequest {
                all_logits: None,
                embeddings: Some(Vec::new()),
            };
            if let Ok(_permit) = self.permits.acquire().await {
                for s in &self.ctx {
                    if let Ok(mut guard) = s.try_lock() {
                        let guard = &mut *guard;
                        let model = &guard.0;
                        let session = &mut guard.1;
                        let vocab = model.tokenizer();
                        let beginning_of_sentence = true;
                        let query_token_ids = log
                            .iter()
                            .map(|sequence| {
                                vocab
                                    .tokenize(&sequence, beginning_of_sentence)
                                    .unwrap()
                                    .iter()
                                    .map(|(_, tok)| *tok)
                                    .collect::<Vec<_>>()
                            })
                            .collect::<Vec<_>>();
                        let query_token_ids: Vec<_> =
                            query_token_ids.iter().map(AsRef::as_ref).collect();

                        let n = tokio::time::Instant::now();
                        model.batch_evaluate(session, &query_token_ids, &mut output_request);
                        println!("took {}ms", n.elapsed().as_millis());
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

        fn tokenizer(&self) -> &Tokenizer {
            &self.tokenizer
        }
    }
}
