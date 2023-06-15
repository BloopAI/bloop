//! A Rust-friendly interface to Bloop's LLM Gateway service.

use std::time::Duration;

use anyhow::{anyhow, bail};
use axum::http::StatusCode;
use futures::{Stream, StreamExt};
use reqwest_eventsource::EventSource;
use tracing::{debug, error, warn};

use self::api::FunctionCall;

pub mod api {
    use std::collections::HashMap;

    #[derive(Debug, Default, Clone, serde::Serialize, serde::Deserialize)]
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
    #[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
    #[serde(untagged)]
    pub enum Message {
        PlainText {
            role: String,
            content: String,
        },
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
    pub struct Request {
        pub messages: Messages,
        pub functions: Option<Functions>,
        pub provider: Provider,
        pub max_tokens: Option<u32>,
        pub temperature: Option<f32>,
        pub model: Option<String>,
        #[serde(default)]
        pub extra_stop_sequences: Vec<String>,
    }

    #[derive(Debug, Copy, Clone, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "lowercase")]
    pub enum Provider {
        OpenAi,
        Anthropic,
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
    }

    pub type Result = std::result::Result<String, Error>;
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

    pub fn function_call(call: &FunctionCall) -> Self {
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

enum ChatError {
    BadRequest,
    TooManyRequests,
    Other(anyhow::Error),
}

#[derive(Clone)]
pub struct Client {
    http: reqwest::Client,
    pub base_url: String,
    pub max_retries: u32,

    pub bearer_token: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub provider: api::Provider,
    pub model: Option<String>,
}

impl Client {
    pub fn new(base_url: &str) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url: base_url.to_owned(),
            max_retries: 5,

            bearer_token: None,
            provider: api::Provider::OpenAi,
            temperature: None,
            max_tokens: None,
            model: None,
        }
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

    pub fn bearer(mut self, bearer: impl Into<Option<String>>) -> Self {
        self.bearer_token = bearer.into();
        self
    }

    pub async fn is_compatible(
        &self,
        version: semver::Version,
    ) -> Result<reqwest::Response, reqwest::Error> {
        self.http
            .get(format!("{}/v1/compatibility", self.base_url))
            .query(&[("version", version)])
            .send()
            .await
    }

    pub async fn chat(
        &self,
        messages: &[api::Message],
        functions: Option<&[api::Function]>,
    ) -> anyhow::Result<impl Stream<Item = anyhow::Result<String>>> {
        const INITIAL_DELAY: Duration = Duration::from_millis(100);
        const SCALE_FACTOR: f32 = 1.5;

        let mut delay = INITIAL_DELAY;
        for _ in 0..self.max_retries {
            match self.chat_oneshot(messages, functions).await {
                Err(ChatError::TooManyRequests) => {
                    warn!(?delay, "too many LLM requests, retrying with delay...");
                    tokio::time::sleep(delay).await;
                    delay = Duration::from_millis((delay.as_millis() as f32 * SCALE_FACTOR) as u64);
                }
                Err(ChatError::BadRequest) => {
                    // We log the messages in a separate `debug!` statement so that they can be
                    // filtered out, due to their verbosity.
                    debug!("LLM message list: {messages:?}");
                    error!("LLM request failed, request not eligible for retry");
                    bail!("request not eligible for retry");
                }
                Err(ChatError::Other(e)) => {
                    // We log the messages in a separate `debug!` statement so that they can be
                    // filtered out, due to their verbosity.
                    debug!("LLM message list: {messages:?}");
                    error!("LLM request failed due to unknown reason: {e}");
                    return Err(e);
                }
                Ok(stream) => return Ok(stream),
            }
        }

        bail!("request failed {} times", self.max_retries)
    }

    /// Like `chat`, but without exponential backoff.
    async fn chat_oneshot(
        &self,
        messages: &[api::Message],
        functions: Option<&[api::Function]>,
    ) -> Result<impl Stream<Item = anyhow::Result<String>>, ChatError> {
        let mut event_source = Box::pin(
            EventSource::new({
                let mut builder = self.http.post(format!("{}/v1/q", self.base_url));

                if let Some(bearer) = &self.bearer_token {
                    builder = builder.bearer_auth(bearer);
                }

                builder.json(dbg!(&api::Request {
                    messages: api::Messages {
                        messages: messages.to_owned(),
                    },
                    functions: functions.map(|funcs| api::Functions {
                        functions: funcs.to_owned(),
                    }),
                    max_tokens: self.max_tokens,
                    temperature: self.temperature,
                    provider: self.provider,
                    model: self.model.clone(),
                    extra_stop_sequences: vec![],
                }))
            })
            // We don't have a `Stream` body so this can't fail.
            .expect("couldn't clone requestbuilder")
            // `reqwest_eventsource` returns an error to signify a stream end, instead of simply ending
            // the stream. So we catch the error here and close the stream.
            .take_while(|result| {
                let is_end = matches!(result, Err(reqwest_eventsource::Error::StreamEnded));
                async move { !is_end }
            }),
        );

        match event_source.next().await {
            Some(Ok(reqwest_eventsource::Event::Open)) => {}
            Some(Err(reqwest_eventsource::Error::InvalidStatusCode(status)))
                if status == StatusCode::BAD_REQUEST =>
            {
                warn!("bad request to LLM");
                return Err(ChatError::BadRequest);
            }
            Some(Err(reqwest_eventsource::Error::InvalidStatusCode(status)))
                if status == StatusCode::TOO_MANY_REQUESTS =>
            {
                warn!("too many requests to LLM");
                return Err(ChatError::TooManyRequests);
            }
            Some(Err(e)) => {
                return Err(ChatError::Other(anyhow!("event source error: {:?}", e)));
            }
            _ => {
                return Err(ChatError::Other(anyhow!("event source failed to open")));
            }
        }

        Ok(event_source
            .filter_map(|result| async move {
                match result {
                    Ok(reqwest_eventsource::Event::Message(msg)) => Some(Ok(msg.data)),
                    Ok(reqwest_eventsource::Event::Open) => None,
                    Err(reqwest_eventsource::Error::StreamEnded) => None,
                    Err(e) => Some(Err(e)),
                }
            })
            .map(|result| match result {
                Ok(s) => Ok(serde_json::from_str::<api::Result>(&s)??),
                Err(e) => bail!("event source error {e:?}"),
            }))
    }
}
