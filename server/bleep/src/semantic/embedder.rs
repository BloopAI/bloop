use std::{path::Path, sync::Arc};

use ndarray::Axis;
use ort::{
    tensor::{FromArray, InputTensor, OrtOwnedTensor},
    Environment, ExecutionProvider, GraphOptimizationLevel, LoggingLevel, SessionBuilder,
};
use tokenizers::Tokenizer;
use tracing::trace;

use super::Embedding;

pub trait Embedder {
    fn embed(&self, data: &str) -> anyhow::Result<Embedding>;
    fn tokenizer(&self) -> &Tokenizer;
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
}
