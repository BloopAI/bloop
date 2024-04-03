use std::time::Duration;

use anyhow::{anyhow, bail};
use futures::{Stream, StreamExt};
use secrecy::ExposeSecret;
use tracing::{debug, error, warn};

use super::call::llm_call;
use crate::{periodic::sync_github_status_once, Application};

pub mod api {
    use std::collections::HashMap;

    #[derive(Debug, Default, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
    pub struct FunctionCall {
        pub name: Option<String>,
        pub arguments: String,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    pub struct Function {
        pub name: String,
        pub description: String,
        pub parameters: Parameters,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    pub struct Parameters {
        #[serde(rename = "type")]
        pub _type: String,
        pub properties: HashMap<String, Parameter>,
        pub required: Vec<String>,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    pub struct Parameter {
        #[serde(rename = "type")]
        pub _type: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub description: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub items: Option<Box<Parameter>>,
    }
    #[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
    #[serde(untagged)]
    pub enum Message {
        FunctionReturn {
            role: String,
            name: String,
            content: String,
        },
        FunctionCall {
            role: String,
            function_call: FunctionCall,
            content: (),
        },
        // NB: This has to be the last variant as this enum is marked `#[serde(untagged)]`, so
        // deserialization will always try this variant last. Otherwise, it is possible to
        // accidentally deserialize a `FunctionReturn` value as `PlainText`.
        PlainText {
            role: String,
            content: String,
        },
    }

    #[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
    pub struct Messages {
        pub messages: Vec<Message>,
    }

    #[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
    pub struct Functions {
        pub functions: Vec<Function>,
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize)]
    pub struct LLMRequest {
        pub openai_key: String,
        pub messages: Messages,
        pub functions: Option<Functions>,
        pub max_tokens: Option<u32>,
        pub temperature: Option<f32>,
        pub presence_penalty: Option<f32>,
        pub frequency_penalty: Option<f32>,
        pub model: Option<String>,
        #[serde(default)]
        pub extra_stop_sequences: Vec<String>,
    }

    #[derive(Debug, Copy, Clone, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "lowercase")]
    pub enum FunctionCallOptions {
        Auto,
        None,
    }

    #[derive(thiserror::Error, Debug, serde::Deserialize, serde::Serialize)]
    pub enum Error {
        #[error("bad OpenAI request")]
        BadOpenAiRequest,

        #[error("incorrect configuration")]
        BadConfiguration,

        #[error("waiting for the next token took longer than allowed")]
        TokenDelayTooLarge,
    }
}

impl api::Message {
    pub fn new_text(role: &str, content: &str) -> Self {
        Self::PlainText {
            role: role.to_owned(),
            content: content.to_owned(),
        }
    }

    pub fn system(content: &str) -> Self {
        Self::new_text("system", content)
    }

    pub fn user(content: &str) -> Self {
        Self::new_text("user", content)
    }

    pub fn assistant(content: &str) -> Self {
        Self::new_text("assistant", content)
    }

    pub fn function_call(call: &api::FunctionCall) -> Self {
        Self::FunctionCall {
            role: "assistant".to_string(),
            function_call: call.clone(),
            content: (),
        }
    }

    pub fn function_return(name: &str, content: &str) -> Self {
        Self::FunctionReturn {
            role: "function".to_string(),
            name: name.to_string(),
            content: content.to_string(),
        }
    }
}

impl From<&api::Message> for tiktoken_rs::ChatCompletionRequestMessage {
    fn from(m: &api::Message) -> tiktoken_rs::ChatCompletionRequestMessage {
        match m {
            api::Message::PlainText { role, content } => {
                tiktoken_rs::ChatCompletionRequestMessage {
                    role: role.clone(),
                    content: Some(content.clone()),
                    name: None,
                    function_call: None,
                }
            }
            api::Message::FunctionReturn {
                role,
                name,
                content,
            } => tiktoken_rs::ChatCompletionRequestMessage {
                role: role.clone(),
                content: Some(content.clone()),
                name: Some(name.clone()),
                function_call: None,
            },
            api::Message::FunctionCall {
                role,
                function_call,
                content: _,
            } => tiktoken_rs::ChatCompletionRequestMessage {
                role: role.clone(),
                content: None,
                name: None,
                function_call: Some(tiktoken_rs::FunctionCall {
                    name: function_call
                        .name
                        .clone()
                        .expect("FunctionCall has no name"),
                    arguments: function_call.arguments.clone(),
                }),
            },
        }
    }
}

enum ChatError {
    BadRequest(String),
    #[allow(dead_code)]
    TooManyRequests(String),
    #[allow(dead_code)]
    InvalidToken,
    Other(anyhow::Error),
}

impl From<anyhow::Error> for ChatError {
    fn from(error: anyhow::Error) -> Self {
        ChatError::BadRequest(error.to_string())
    }
}

#[derive(Clone)]
pub struct Client {
    app: Application,
    pub max_retries: u32,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub presence_penalty: Option<f32>,
    pub frequency_penalty: Option<f32>,
    pub model: Option<String>,
}

impl Client {
    pub fn new(app: Application) -> Self {
        Self {
            app,
            max_retries: 5,
            temperature: None,
            max_tokens: None,
            presence_penalty: None,
            frequency_penalty: None,
            model: None,
        }
    }

    pub fn model(mut self, model: &str) -> Self {
        if model.is_empty() {
            self.model = None;
        } else {
            self.model = Some(model.to_owned());
        }

        self
    }

    #[allow(unused)]
    pub fn frequency_penalty(mut self, frequency: impl Into<Option<f32>>) -> Self {
        self.frequency_penalty = frequency.into();
        self
    }

    #[allow(unused)]
    pub fn presence_penalty(mut self, presence_penalty: impl Into<Option<f32>>) -> Self {
        self.presence_penalty = presence_penalty.into();
        self
    }

    pub fn temperature(mut self, temperature: impl Into<Option<f32>>) -> Self {
        self.temperature = temperature.into();
        self
    }

    #[allow(unused)]
    pub fn max_tokens(mut self, max_tokens: impl Into<Option<u32>>) -> Self {
        self.max_tokens = max_tokens.into();
        self
    }

    pub async fn chat(
        &self,
        messages: &[api::Message],
        functions: Option<&[api::Function]>,
    ) -> anyhow::Result<String> {
        const TOTAL_CHAT_RETRIES: usize = 5;

        'retry_loop: for _ in 0..TOTAL_CHAT_RETRIES {
            let mut buf = String::new();
            let stream = self.chat_stream(messages, functions).await?;
            tokio::pin!(stream);

            loop {
                match stream.next().await {
                    None => break,
                    Some(Ok(s)) => buf += &s,
                    Some(Err(e)) => {
                        warn!(?e, "token stream errored out, retrying...");
                        continue 'retry_loop;
                    }
                }
            }

            return Ok(buf);
        }

        Err(anyhow!(
            "chat stream errored too many times, failed to generate response"
        ))
    }

    pub async fn chat_stream(
        &self,
        messages: &[api::Message],
        functions: Option<&[api::Function]>,
    ) -> anyhow::Result<impl Stream<Item = anyhow::Result<String>>> {
        const INITIAL_DELAY: Duration = Duration::from_millis(100);
        const SCALE_FACTOR: f32 = 1.5;

        let mut delay = INITIAL_DELAY;
        for _ in 0..self.max_retries {
            match self.chat_stream_oneshot(messages, functions).await {
                Err(ChatError::TooManyRequests(_)) => {
                    warn!(?delay, "too many LLM requests, retrying with delay...");
                    tokio::time::sleep(delay).await;
                    delay = Duration::from_millis((delay.as_millis() as f32 * SCALE_FACTOR) as u64);
                }
                Err(ChatError::BadRequest(body)) => {
                    // We log the messages in a separate `debug!` statement so that they can be
                    // filtered out, due to their verbosity.
                    debug!("LLM message list: {messages:?}");
                    error!("LLM request failed, request not eligible for retry: {body}");
                    bail!("request failed (not eligible for retry): {body}");
                }
                Err(ChatError::InvalidToken) => {
                    warn!("invalid token, retrying LLM request");
                    sync_github_status_once(&self.app).await;
                }
                Err(ChatError::Other(e)) => {
                    // We log the messages in a separate `debug!` statement so that they can be
                    // filtered out, due to their verbosity.
                    debug!("LLM message list: {messages:?}");
                    error!("LLM request failed due to unknown reason: {e:?}");
                    return Err(e);
                }
                Ok(stream) => return Ok(stream),
            }
        }

        bail!("request failed {} times", self.max_retries)
    }

    /// Like `chat`, but without exponential backoff.
    async fn chat_stream_oneshot(
        &self,
        messages: &[api::Message],
        functions: Option<&[api::Function]>,
    ) -> Result<impl Stream<Item = anyhow::Result<String>>, ChatError> {
        let mut stream = Box::pin(
            llm_call(api::LLMRequest {
                openai_key: self
                    .app
                    .config
                    .openai_api_key
                    .as_ref()
                    .expect("OpenAI API key not set")
                    .expose_secret()
                    .to_string(),
                messages: api::Messages {
                    messages: messages.to_owned(),
                },
                functions: functions.map(|funcs| api::Functions {
                    functions: funcs.to_owned(),
                }),
                max_tokens: self.max_tokens,
                temperature: self.temperature,
                presence_penalty: self.presence_penalty,
                frequency_penalty: self.frequency_penalty,
                model: self.model.clone(),
                extra_stop_sequences: vec![],
            })
            .await?,
        );

        let first_item = stream.next().await;
        match first_item {
            Some(Ok(_)) => {}
            Some(Err(api::Error::BadOpenAiRequest)) => {
                warn!("bad request to LLM");
                return Err(ChatError::BadRequest("Bad request to LLM".into()));
            }
            Some(Err(e)) => {
                warn!(?e, "LLM request failed");
                return Err(ChatError::Other(anyhow!(
                    "failed to make event source request to answer API: {e}",
                )));
            }
            _ => {
                warn!("Failed to open Event Source");
                return Err(ChatError::Other(anyhow!("event source failed to open")));
            }
        }

        Ok(futures::stream::once(async { first_item.unwrap() })
            .chain(stream)
            .filter_map(|result| async move {
                match result {
                    Ok(d) => Some(Ok(d)),
                    Err(e) => Some(Err(e)),
                }
            })
            .map(|result| match result {
                Ok(s) => Ok(s.to_string()),
                Err(e) => bail!("event source error {e:?}"),
            }))
    }
}
