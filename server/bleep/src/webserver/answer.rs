use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{sse::Event, IntoResponse, Sse},
    Extension,
};
use futures::{Stream, StreamExt, TryStreamExt};
use secrecy::ExposeSecret;
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use utoipa::ToSchema;

use crate::{
    analytics::{QueryEvent, Stage},
    env::Feature,
    indexes::reader::ContentDocument,
    query::parser,
    remotes::{self, BackendCredential},
    repo::{Backend, RepoRef},
    semantic::Semantic,
    Application,
};

use super::prelude::*;

/// Mirrored from `answer_api/lib.rs` to avoid private dependency.
pub mod api {
    use serde::Deserialize;

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "lowercase")]
    pub enum Provider {
        OpenAi,
        Anthropic,
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize)]
    pub struct Request {
        pub prompt: String,
        pub max_tokens: Option<u32>,
        pub temperature: Option<f32>,
        pub provider: Provider,
    }

    #[derive(thiserror::Error, Debug, Deserialize)]
    pub enum Error {
        #[error("bad OpenAI request")]
        BadOpenAiRequest,
    }

    pub type Result = std::result::Result<String, Error>;
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Request {
    pub query: String,
    pub snippets: Vec<Snippet>,
    pub user_id: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Snippet {
    pub lang: String,
    pub repo_name: String,
    pub repo_ref: String,
    pub relative_path: String,
    pub text: String,
    pub start_line: usize,
    pub end_line: usize,
    pub start_byte: usize,
    pub end_byte: usize,
    pub score: f32,
}

fn default_limit() -> u64 {
    10
}

fn default_user_id() -> String {
    String::from("test_user")
}

#[derive(Debug, serde::Deserialize)]
pub struct Params {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: u64,
    #[serde(default = "default_user_id")]
    pub user_id: String,
}

#[derive(serde::Serialize, ToSchema, Debug)]
pub struct AnswerResponse {
    pub user_id: String,
    pub query_id: uuid::Uuid,
    pub snippets: Vec<Snippet>,
    pub answer_path: Option<String>,
}

impl From<AnswerResponse> for super::Response<'static> {
    fn from(res: AnswerResponse) -> super::Response<'static> {
        super::Response::Answer(res)
    }
}

const SNIPPET_COUNT: usize = 13;

pub(super) struct AnswerState {
    client: reqwest::Client,
}

impl Default for AnswerState {
    fn default() -> Self {
        Self {
            client: reqwest::Client::builder()
                .cookie_store(true)
                .build()
                // This should never fail, the only default properties we change are enabling
                // cookies.
                .unwrap(),
        }
    }
}

pub(super) async fn handle(
    Query(params): Query<Params>,
    State(state): State<Arc<AnswerState>>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse> {
    // create a new analytics event for this query
    let event = Arc::new(RwLock::new(QueryEvent::default()));

    // populate analytics event
    let response = _handle(&state, params, app.clone(), Arc::clone(&event)).await;

    if response.is_err() {
        // Result<impl IntoResponse> does not implement `Debug`, `unwrap_err` is unavailable
        let Err(e) = response.as_ref() else {
            unreachable!();
        };

        // add error stage to pipeline
        let mut ev = event.write().await;
        ev.stages
            .push(Stage::new("error", (e.status.as_u16(), e.message())));

        // send to rudderstack
        app.track_query(&ev);
    } else {
        // the analytics event is fired when the stream is consumed
    }
    response
}

async fn _handle(
    state: &AnswerState,
    params: Params,
    app: Application,
    event: Arc<RwLock<QueryEvent>>,
) -> Result<impl IntoResponse> {
    let query_id = uuid::Uuid::new_v4();
    let mut stop_watch = StopWatch::start();

    info!("Raw query: {:?}", &params.q);

    let semantic = app
        .semantic
        .clone()
        .ok_or_else(|| Error::new(ErrorKind::Configuration, "Qdrant not configured"))?;

    let mut analytics_event = event.write().await;

    analytics_event.user_id = params.user_id.clone();
    analytics_event.query_id = query_id;
    analytics_event.overlap_strategy = semantic.overlap_strategy();

    analytics_event
        .stages
        .push(Stage::new("user query", &params.q).with_time(stop_watch.lap()));

    // Parse the query for search filters
    let parsed_query = parser::parse_nl(&params.q).map_err(Error::user)?;
    let query = parsed_query
        .target()
        .ok_or_else(|| Error::user("missing search target"))?;

    let all_snippets: Vec<Snippet> = semantic
        .search(&parsed_query, 4 * SNIPPET_COUNT as u64) // heuristic
        .await
        .map_err(Error::internal)?
        .into_iter()
        .map(|r| {
            use qdrant_client::qdrant::{value::Kind, Value};

            // TODO: Can we merge with webserver/semantic.rs:L63?
            fn value_to_string(value: Value) -> String {
                match value.kind.unwrap() {
                    Kind::StringValue(s) => s,
                    _ => panic!("got non-string value"),
                }
            }

            let mut s = r.payload;

            Snippet {
                lang: value_to_string(s.remove("lang").unwrap()),
                repo_name: value_to_string(s.remove("repo_name").unwrap()),
                repo_ref: value_to_string(s.remove("repo_ref").unwrap()),
                relative_path: value_to_string(s.remove("relative_path").unwrap()),
                text: value_to_string(s.remove("snippet").unwrap()),

                start_line: value_to_string(s.remove("start_line").unwrap())
                    .parse::<usize>()
                    .unwrap(),
                end_line: value_to_string(s.remove("end_line").unwrap())
                    .parse::<usize>()
                    .unwrap(),
                start_byte: value_to_string(s.remove("start_byte").unwrap())
                    .parse::<usize>()
                    .unwrap(),
                end_byte: value_to_string(s.remove("end_byte").unwrap())
                    .parse::<usize>()
                    .unwrap(),
                score: r.score,
            }
        })
        .collect();

    analytics_event
        .stages
        .push(Stage::new("semantic results", &all_snippets).with_time(stop_watch.lap()));

    let mut snippets = vec![];
    let mut chunk_ranges_by_file: HashMap<String, Vec<std::ops::Range<usize>>> = HashMap::new();

    for snippet in all_snippets.clone().into_iter() {
        if snippets.len() > SNIPPET_COUNT {
            break;
        }

        let path = &snippet.relative_path;
        if !chunk_ranges_by_file.contains_key(path) {
            chunk_ranges_by_file
                .entry(path.to_string())
                .or_insert_with(Vec::new);
        }

        if chunk_ranges_by_file.get(path).unwrap().len() <= 4 {
            // check if line ranges of any added chunk overlap with current chunk
            let any_overlap = chunk_ranges_by_file
                .get(path)
                .unwrap()
                .iter()
                .any(|r| (snippet.start_line <= r.end) && (r.start <= snippet.end_line));

            // no overlap, add snippet
            if !any_overlap {
                chunk_ranges_by_file
                    .entry(path.to_string())
                    .or_insert_with(Vec::new)
                    .push(std::ops::Range {
                        start: snippet.start_line,
                        end: snippet.end_line,
                    });
                snippets.push(snippet);
            }
        }
    }

    analytics_event
        .stages
        .push(Stage::new("filtered semantic results", &snippets).with_time(stop_watch.lap()));

    if snippets.is_empty() {
        warn!("Semantic search returned no snippets");
        return Err(Error::internal("semantic search returned no snippets"));
    } else {
        info!("Semantic search returned {} snippets", snippets.len());
    }

    let answer_bearer = if app.env.allow(Feature::GithubDeviceFlow) {
        let Some(cred) = app.credentials.get(&Backend::Github) else {
            return Err(Error::user(
                "missing Github token",
            ).with_status(StatusCode::UNAUTHORIZED));
        };

        match &*cred {
            BackendCredential::Github(remotes::github::Auth::OAuth {
                access_token: token,
                ..
            }) => Some(token.expose_secret().clone()),

            BackendCredential::Github(remotes::github::Auth::App { .. }) => {
                return Err(
                    Error::user("cannot connect to answer API using installation token")
                        .with_status(StatusCode::UNAUTHORIZED),
                )
            }
        }
    } else {
        None
    };

    let answer_api_client = semantic.build_answer_api_client(
        state,
        format!("{}/q", app.config.answer_api_url).as_str(),
        query,
        5,
        answer_bearer.clone(),
    );

    let select_prompt = answer_api_client.build_select_prompt(&snippets);

    analytics_event
        .stages
        .push(Stage::new("select prompt", &select_prompt).with_time(stop_watch.lap()));

    let relevant_snippet_index = answer_api_client
        .select_snippet(&select_prompt)
        .await?
        .trim()
        .to_string()
        .clone();

    info!("Relevant snippet index: {}", &relevant_snippet_index);

    let mut relevant_snippet_index = relevant_snippet_index
        .parse::<usize>()
        .map_err(Error::internal)?;

    analytics_event.stages.push(
        Stage::new("relevant snippet index", relevant_snippet_index).with_time(stop_watch.lap()),
    );

    let (answer_path, stream) = if relevant_snippet_index > 0 {
        relevant_snippet_index -= 1; // return to 0-indexing
        let relevant_snippet = snippets
            .get(relevant_snippet_index)
            .ok_or_else(|| Error::internal("answer-api returned out-of-bounds index"))?;

        // grow the snippet by 60 lines above and below, we have sufficient space
        // to grow this snippet by 10 times its original size (15 to 150)

        let repo_ref = &relevant_snippet
            .repo_ref
            .parse::<RepoRef>()
            .map_err(Error::internal)?;
        let doc = app
            .indexes
            .file
            .by_path(repo_ref, &relevant_snippet.relative_path)
            .await
            .map_err(Error::internal)?;

        let mut grow_size = 40;
        let grown_text = loop {
            let grown_text = grow(&doc, relevant_snippet, grow_size);
            let token_count = semantic.gpt2_token_count(&grown_text);
            info!(%grow_size, %token_count, "growing ...");
            if token_count > 2000 || grow_size > 100 {
                break grown_text;
            } else {
                grow_size += 10;
            }
        };

        let processed_snippet = Snippet {
            lang: relevant_snippet.lang.clone(),
            repo_name: relevant_snippet.repo_name.clone(),
            repo_ref: relevant_snippet.repo_ref.clone(),
            relative_path: relevant_snippet.relative_path.clone(),
            text: grown_text,
            start_line: relevant_snippet.start_line,
            end_line: relevant_snippet.end_line,
            start_byte: relevant_snippet.start_byte,
            end_byte: relevant_snippet.end_byte,
            score: relevant_snippet.score,
        };

        // reorder snippets
        snippets.swap(relevant_snippet_index, 0);

        let explain_prompt = answer_api_client.build_explain_prompt(&processed_snippet);

        analytics_event
            .stages
            .push(Stage::new("explain prompt", &explain_prompt).with_time(stop_watch.lap()));

        let mut snippet_explanation = answer_api_client
            .explain_snippet(&explain_prompt)
            .await
            .map_err(Error::internal)
            .map(Box::pin)?;

        drop(analytics_event);

        let analytics_event = Arc::clone(&event);

        let stream = async_stream::stream! {
            let mut explanation = String::new();
            while let Some(result) = snippet_explanation.next().await {
                yield Ok(Event::default()
                    .json_data(result.as_ref().map_err(|e| e.to_string()))
                    .unwrap());

                match result {
                    Ok(s) => explanation += &s,
                    Err(e) => yield Err(e),
                }
            }

            let mut event = analytics_event.write().await;

            event
                .stages
                .push(Stage::new("explanation", &explanation).with_time(stop_watch.lap()));

            app.track_query(&event);
        };

        // answering snippet is always at index 0
        let answer_path = snippets.get(0).unwrap().relative_path.to_string();

        (Some(answer_path), stream.left_stream())
    } else {
        warn!("None of the snippets help answer the question");
        (None, futures::stream::empty().right_stream())
    };

    let initial_event = Event::default()
        .json_data(super::Response::<'static>::from(AnswerResponse {
            snippets: snippets.clone(),
            query_id,
            user_id: params.user_id.clone(),
            answer_path,
        }))
        .map_err(Error::internal)?;

    Ok(Sse::new({
        futures::stream::once(async move { Ok(initial_event) })
            .chain(stream)
            .chain(futures::stream::once(async {
                Ok(Event::default().data("[DONE]"))
            }))
    }))
}

// grow the text of this snippet by `size` and return the new text
fn grow(doc: &ContentDocument, snippet: &Snippet, size: usize) -> String {
    let content = &doc.content;

    // skip upwards `size` number of lines
    let new_start_byte = content[..snippet.start_byte]
        .rmatch_indices('\n')
        .map(|(idx, _)| idx)
        .nth(size)
        .unwrap_or(0);

    // skip downwards `size` number of lines
    let new_end_byte = content[snippet.end_byte..]
        .match_indices('\n')
        .map(|(idx, _)| idx)
        .nth(size)
        .map(|s| s.saturating_add(snippet.end_byte)) // the index is off by `snippet.end_byte`
        .unwrap_or(content.len());

    content[new_start_byte..new_end_byte].to_owned()
}

struct AnswerAPIClient<'s> {
    host: String,
    query: String,
    semantic: &'s Semantic,
    max_attempts: usize,
    bearer_token: Option<String>,
    client: reqwest::Client,
}

#[derive(Error, Debug)]
enum AnswerAPIError {
    #[error("max retry attempts reached {0}")]
    MaxAttemptsReached(usize),

    #[error("event source error {0}")]
    EventSource(#[from] reqwest_eventsource::Error),

    #[error("failed to open stream")]
    StreamFail,

    #[error("message deserialization error {0}")]
    MessageFormat(#[from] serde_json::Error),

    #[error("answer API error {0}")]
    BadRequest(#[from] api::Error),
}

impl From<AnswerAPIError> for Error {
    fn from(e: AnswerAPIError) -> Error {
        sentry::capture_message(
            format!("answer-api failed to respond: {e}").as_str(),
            sentry::Level::Error,
        );
        Error::new(ErrorKind::UpstreamService, e.to_string())
    }
}

impl Semantic {
    fn build_answer_api_client<'s>(
        &'s self,
        state: &AnswerState,
        host: &str,
        query: &str,
        max_attempts: usize,
        bearer_token: Option<String>,
    ) -> AnswerAPIClient<'s> {
        AnswerAPIClient {
            host: host.to_owned(),
            query: query.to_owned(),
            semantic: self,
            max_attempts,
            // Internally, cookies are shared between `reqwest` client instances via a shared lock.
            // Cloning the client here just creates a new handle to the same lock.
            client: state.client.clone(),
            bearer_token,
        }
    }
}

impl<'s> AnswerAPIClient<'s> {
    async fn send(
        &self,
        prompt: &str,
        max_tokens: u32,
        temperature: f32,
        provider: api::Provider,
    ) -> Result<impl Stream<Item = Result<String, AnswerAPIError>>, AnswerAPIError> {
        let mut stream = Box::pin(
            reqwest_eventsource::EventSource::new({
                let mut builder = self.client.post(self.host.as_str());

                if let Some(bearer) = &self.bearer_token {
                    builder = builder.bearer_auth(bearer);
                }

                builder.json(&api::Request {
                    prompt: prompt.to_string(),
                    max_tokens: Some(max_tokens),
                    temperature: Some(temperature),
                    provider,
                })
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

        match stream.next().await {
            Some(Ok(reqwest_eventsource::Event::Open)) => {}
            Some(Err(e)) => return Err(AnswerAPIError::EventSource(e)),
            _ => return Err(AnswerAPIError::StreamFail),
        }

        Ok(stream
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
                Err(e) => Err(AnswerAPIError::EventSource(e)),
            }))
    }

    async fn send_until_success(
        &self,
        prompt: &str,
        max_tokens: u32,
        temperature: f32,
        provider: api::Provider,
    ) -> Result<String, AnswerAPIError> {
        for attempt in 0..self.max_attempts {
            let result = self
                .send(prompt, max_tokens, temperature, provider.clone())
                .await?
                .try_collect::<String>()
                .await;

            match result {
                Ok(r) => return Ok(r),
                Err(e) => warn!(%attempt, "answer-api returned {e:?} ... retrying"),
            }
        }
        Err(AnswerAPIError::MaxAttemptsReached(self.max_attempts))
    }
}

const DELIMITER: &str = "=========";
impl<'a> AnswerAPIClient<'a> {
    fn build_select_prompt(&self, snippets: &[Snippet]) -> String {
        // snippets are 1-indexed so we can use index 0 where no snippets are relevant
        let mut prompt = snippets
            .iter()
            .enumerate()
            .map(|(i, snippet)| {
                format!(
                    "Repository: {}\nPath: {}\nLanguage: {}\nIndex: {}\n\n{}\n{DELIMITER}\n",
                    snippet.repo_name,
                    snippet.relative_path,
                    snippet.lang,
                    i + 1,
                    snippet.text
                )
            })
            .collect::<String>();

        // the example question/answer pair helps reinforce that we want exactly a single
        // number in the output, with no spaces or punctuation such as fullstops.
        prompt += &format!(
            "Above are {} code snippets separated by \"{DELIMITER}\". \
Your job is to select the snippet that best answers the question. Reply \
with a single number indicating the index of the snippet in the list. \
If none of the snippets are relevant, reply with \"0\". Do NOT return a non-numeric answer.

Q:What icon do we use to clear search history?
Index:3

Q:{}
Index:",
            snippets.len(),
            self.query,
        );

        let tokens_used = self.semantic.gpt2_token_count(&prompt);
        debug!(%tokens_used, "select prompt token count");
        prompt
    }

    fn build_explain_prompt(&self, snippet: &Snippet) -> String {
        let prompt = format!(
            "You are an AI assistant for a repo. Answer the question using above in a sentence. Do NOT try to make up an answer.
Question: {}
=========
Path: {}
File: {}
=========
Answer:",
            self.query, snippet.relative_path, snippet.text,
        );
        prompt
    }

    async fn select_snippet(&self, prompt: &str) -> Result<String> {
        self.send_until_success(prompt, 1, 0.0, api::Provider::Anthropic)
            .await
            .map_err(|e| {
                sentry::capture_message(
                    format!("answer-api failed to respond: {e}").as_str(),
                    sentry::Level::Error,
                );
                Error::new(ErrorKind::UpstreamService, e.to_string())
            })
    }

    async fn explain_snippet(
        &self,
        prompt: &str,
    ) -> Result<impl Stream<Item = Result<String, AnswerAPIError>>, AnswerAPIError> {
        let tokens_used = self.semantic.gpt2_token_count(prompt);
        info!(%tokens_used, "input prompt token count");
        let max_tokens = 4096usize.saturating_sub(tokens_used);
        if max_tokens == 0 {
            // our prompt has overshot the token count, log an error for now
            // TODO: this should propagte to sentry
            error!(%tokens_used, "prompt overshot token limit");
        }

        // do not let the completion cross 200 tokens
        let max_tokens = max_tokens.clamp(1, 200);
        info!(%max_tokens, "clamping max tokens");
        self.send(prompt, max_tokens as u32, 0.0, api::Provider::Anthropic)
            .await
    }
}

// Measure time between instants statefully
struct StopWatch {
    start: Instant,
}

impl StopWatch {
    // Start the watch
    fn start() -> Self {
        Self {
            start: Instant::now(),
        }
    }

    // Measure the time since start
    fn measure(&self) -> Duration {
        self.start.elapsed()
    }

    // Read the value since the last start, and zero the clock
    fn lap(&mut self) -> Duration {
        let duration = self.measure();
        self.start = Instant::now();
        duration
    }
}
