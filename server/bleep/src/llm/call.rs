use std::{fmt, sync::Arc, time::Duration};

use async_stream::try_stream;
use futures_util::{pin_mut, Stream, StreamExt, TryStreamExt};
use reqwest_eventsource::EventSource;
use tokio::sync::Mutex;
use tracing::error;

use super::client::api;

const MAX_TOKEN_DURATION: Duration = Duration::from_secs(16);

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct ChatCompletion {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct ChatChoice {
    name: Option<String>,
    delta: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Delta {
    Content(Option<String>),
    FunctionCall(FunctionCallDelta),
}

impl fmt::Display for Delta {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Self::Content(Some(opt)) => write!(f, "{opt}"),
            Self::Content(None) => write!(f, "null"),
            Self::FunctionCall(delta) => {
                let json = serde_json::to_string(&delta).map_err(|_| fmt::Error)?;
                write!(f, "{json}")
            }
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FunctionCallDelta {
    name: Option<String>,
    #[serde(default)]
    arguments: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct ChatMessage {
    content: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(serde::Serialize, Debug)]
struct OpenAiRequest {
    model: String,
    messages: Vec<api::Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    functions: Option<Vec<api::Function>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    function_call: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    presence_penalty: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    frequency_penalty: Option<f32>,
    temperature: f32,
    stream: bool,
}

pub async fn llm_call(
    req: api::LLMRequest,
) -> anyhow::Result<impl Stream<Item = Result<Delta, api::Error>>> {
    let model = match req.model.as_deref() {
        Some(model) => model.to_owned(),
        None => "gpt-4-turbo".into(),
    };

    let builder = {
        let request = OpenAiRequest {
            messages: req.messages.messages.clone(),
            function_call: if req.functions.is_some() {
                Some("auto".to_string()) // `auto` allows the model to respond dynamically with a function call
            } else {
                None
            },
            functions: req.functions.as_ref().map(|t| &t.functions).cloned(),
            model: model.clone(),
            max_tokens: req.max_tokens,
            temperature: req.temperature.unwrap_or(0.0),
            presence_penalty: req.presence_penalty,
            frequency_penalty: req.frequency_penalty,
            stream: true,
        };

        reqwest::Client::new()
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(req.openai_key)
            .json(&request)
    };

    // This should never fail, as our request body is not a stream.
    let mut response = EventSource::new(builder).expect("failed to build request");
    response.set_retry_policy(Box::new(reqwest_eventsource::retry::Never));

    match response.next().await {
        Some(Ok(reqwest_eventsource::Event::Open)) => {}
        Some(Err(reqwest_eventsource::Error::InvalidStatusCode(status, _))) => {
            error!("{}", &status);
            return Err(api::Error::BadOpenAiRequest.into());
        }
        Some(Err(e)) => {
            error!("{}", e);
            return Err(api::Error::BadOpenAiRequest.into());
        }
        _ => return Err(api::Error::BadOpenAiRequest.into()),
    }

    let previous = Arc::new(Mutex::new("".to_string()));

    let message_stream = try_stream! {
        for await result in response {
            // The `reqwest_eventsource` library uses errors to signal a successful stream close,
            // so we make sure to avoid passing down this close message as an error.
            if matches!(result, Err(reqwest_eventsource::Error::StreamEnded)) {
                break;
            }

            let msg = match result {
                Ok(reqwest_eventsource::Event::Message(msg)) => msg,
                Ok(_) => Err(api::Error::BadOpenAiRequest)?,
                Err(e) => {
                    error!("{}", e);
                    Err(api::Error::BadOpenAiRequest)?
                }
            };

            if msg.data == "[DONE]" {
                break;
            }

            yield msg.data;
        }
    }
    .map_ok(move |d| (d, Arc::clone(&previous)))
    .try_filter_map(move |(msg_data, _)| async move {
        let mut data: ChatCompletion = serde_json::from_str(&msg_data).map_err(|e| {
            error!(%msg_data, "{}", e);
            api::Error::BadOpenAiRequest
        })?;

        match data.choices.first_mut() {
            Some(ChatChoice { delta, .. }) if delta.is_empty() => Ok(None),
            Some(ChatChoice { ref mut delta, .. }) => {
                // The first message contains a redundant `role` field. We remove it.
                delta.remove("role");
                if delta.is_empty() {
                    return Ok(None);
                }

                if delta.len() == 2 {
                    delta.remove("content");
                }

                let delta = serde_json::from_value(delta.clone().into()).map_err(|e| {
                    error!(?delta, "{}", e);
                    api::Error::BadOpenAiRequest
                })?;

                match delta {
                    Delta::Content(Some(content)) if content.is_empty() => Ok(None),
                    delta @ Delta::Content(Some(_)) => Ok(Some(delta)),
                    Delta::FunctionCall(_) => Ok(Some(delta)),
                    Delta::Content(None) => Ok(None),
                }
            }
            _ => Ok(None),
        }
    });

    let stream = try_stream! {
        // We modify the message stream to include a timeout.
        let message_stream = tokio_stream::StreamExt::timeout(message_stream, MAX_TOKEN_DURATION)
            .map(|r| r.map_err(|_| api::Error::TokenDelayTooLarge).and_then(|r2| r2));

        pin_mut!(message_stream);

        for await result in message_stream {
            let delta: Delta = result?;
            yield delta;
        }
    };

    Ok(stream)
}
