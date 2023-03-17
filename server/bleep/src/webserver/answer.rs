use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
    time::{Duration, Instant},
};

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{sse::Event, IntoResponse, Sse},
    Extension,
};
use futures::{stream, Stream, StreamExt, TryStreamExt};
use rake::*;
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
    remotes,
    repo::RepoRef,
    semantic::Semantic,
    Application,
};

use super::prelude::*;

/// Mirrored from `answer_api/lib.rs` to avoid private dependency.
pub mod api {
    use serde::Deserialize;

    #[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
    pub struct Message {
        pub role: String,
        pub content: String,
    }

    #[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
    pub struct Messages {
        pub messages: Vec<Message>,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "lowercase")]
    pub enum Provider {
        OpenAi,
        Anthropic,
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize)]
    pub struct Request {
        pub messages: Messages,
        pub max_tokens: Option<u32>,
        pub temperature: Option<f32>,
        pub provider: Provider,
        pub extra_stop_sequences: Vec<String>,
    }

    #[derive(thiserror::Error, Debug, Deserialize)]
    pub enum Error {
        #[error("bad OpenAI request")]
        BadOpenAiRequest,
    }

    pub type Result = std::result::Result<String, Error>;
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
    20
}

fn default_user_id() -> String {
    String::from("test_user")
}

#[derive(Clone, Debug, serde::Deserialize)]
pub struct Params {
    pub q: String,
    pub thread_id: String,
    #[serde(default = "default_limit")]
    pub limit: u64,
    #[serde(default = "default_user_id")]
    pub user_id: String,
}

#[derive(serde::Serialize, ToSchema, Debug)]
pub struct AnswerResponse {
    pub user_id: String,
    pub session_id: String,
    pub query_id: uuid::Uuid,
    pub snippets: Option<AnswerSnippets>,
}

#[derive(serde::Serialize, ToSchema, Debug)]
pub struct AnswerSnippets {
    pub matches: Vec<Snippet>,
    pub answer_path: String,
}

impl From<AnswerResponse> for super::Response<'static> {
    fn from(res: AnswerResponse) -> super::Response<'static> {
        super::Response::Answer(res)
    }
}

const SNIPPET_COUNT: usize = 20;

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

fn parse_query(query: &str) -> Result<String, Error> {
    Ok(parser::parse_nl(query)
        .map_err(Error::user)?
        .target()
        .ok_or_else(|| Error::user("empty search"))?
        .to_string())
}

const MAX_HISTORY: usize = 7;

#[derive(Debug)]
enum AnswerProgress {
    // Need to rephrase the query. The contained string is the prompt for rephrasing
    Rephrase(String),
    // Got a query to search
    Search(String),
    // Explain the results
    Explain(String),
}

impl AnswerProgress {
    fn to_stage(&self, stop_watch: &mut StopWatch, snippets: Option<&[Snippet]>) -> Stage {
        match self {
            AnswerProgress::Rephrase(s) => Stage::new("rephrase", s),
            AnswerProgress::Search(_) => Stage::new("search", snippets),
            AnswerProgress::Explain(expl) => Stage::new("explain", expl),
        }
        .with_time(stop_watch.lap())
    }
}

async fn search_snippets(
    semantic: &Semantic,
    raw_query: &str,
    rephrased_query: &str,
) -> Result<Vec<Snippet>, Error> {
    let mut parsed_query = &mut parser::parse_nl(raw_query).map_err(Error::user)?;

    // Extract keywords from the rephrased query
    let keywords = get_keywords(rephrased_query);
    info!("Extracted keywords: {}", keywords);

    parsed_query.target = Some(parser::Literal::Plain(keywords.into()));

    let all_snippets: Vec<Snippet> = semantic
        .search(parsed_query, 4 * SNIPPET_COUNT as u64) // heuristic
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
    let mut snippets = Vec::new();
    let mut chunk_ranges_by_file: HashMap<String, Vec<std::ops::Range<usize>>> = HashMap::new();

    for snippet in all_snippets.into_iter() {
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
    Ok(snippets)
}

// we use this internally to check whether the first token (skipping whitespace) is a
// number or something else
enum FirstToken {
    Number(usize),
    Other(String),
    None,
}

async fn grow_snippet(
    relevant_snippet: &Snippet,
    semantic: &Semantic,
    app: &Application,
) -> Result<Snippet, Error> {
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
        if let Some(grown_text) = grow(&doc, relevant_snippet, grow_size) {
            let token_count = semantic.gpt2_token_count(&grown_text);
            info!(%grow_size, %token_count, "growing ...");
            if token_count > 6000 || grow_size > 100 {
                break grown_text;
            } else {
                grow_size += 10;
            }
        } else {
            break relevant_snippet.text.clone();
        }
    };

    Ok(Snippet {
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
    })
}

async fn handle_inner(
    query: &str,
    thread_id: &str,
    state: &AnswerState,
    params: Arc<Params>,
    app: Arc<Application>,
    event: Arc<RwLock<QueryEvent>>,
    mut stop_watch: StopWatch,
) -> Result<(
    Option<Vec<Snippet>>,
    StopWatch,
    std::pin::Pin<Box<dyn Stream<Item = Result<String, AnswerAPIError>> + Send>>,
)> {
    let query = query.to_string(); // TODO: Sort out query handling

    event
        .write()
        .await
        .stages
        .push(Stage::new("parsed_query", &query).with_time(stop_watch.lap()));

    let mut snippets = None;

    let answer_bearer = if app.env.allow(Feature::GithubDeviceFlow) {
        let Some(cred) = app.credentials.github() else {
            return Err(Error::user(
                "missing Github token",
            ).with_status(StatusCode::UNAUTHORIZED));
        };

        use remotes::github::{Auth, State};
        match cred {
            State {
                auth:
                    Auth::OAuth {
                        access_token: token,
                        ..
                    },
                ..
            } => Some(token.expose_secret().clone()),

            State {
                auth: Auth::App { .. },
                ..
            } => {
                return Err(
                    Error::user("cannot connect to answer API using installation token")
                        .with_status(StatusCode::UNAUTHORIZED),
                )
            }
        }
    } else {
        None
    };

    let semantic = app
        .semantic
        .clone()
        .ok_or_else(|| Error::new(ErrorKind::Configuration, "Qdrant not configured"))?;

    let answer_api_client = semantic.build_answer_api_client(
        state,
        format!("{}/v1/q", app.config.answer_api_url).as_str(),
        5,
        answer_bearer.clone(),
    );

    let mut progress = app
        .with_prior_conversation(thread_id, |history| {
            if history.is_empty() {
                None
            } else {
                Some(query.clone())
            }
        })
        .map(AnswerProgress::Rephrase)
        .unwrap_or(AnswerProgress::Rephrase(query.clone()));

    loop {
        // Here we ask anthropic for either action selection, rephrasing or explanation
        // (depending on `progress`)
        let stream_params = match &progress {
            AnswerProgress::Rephrase(query) => {
                let prompt = app.with_prior_conversation(thread_id, |history| {
                    let n = history.len().saturating_sub(MAX_HISTORY);
                    build_rephrase_query_prompt(query, &history[n..])
                });

                (prompt, 20, 0.0, vec![])
            }
            AnswerProgress::Search(rephrased_query) => {
                // TODO: Clean up this query handling logic
                let s = search_snippets(&semantic, &params.q, rephrased_query).await?;
                info!("Retrieved {} snippets", s.len());

                let prompt = answer_api_client.build_select_prompt(rephrased_query, &s);
                snippets = Some(s);
                (prompt, 10, 0.0, vec!["</index>".into()])
            }
            AnswerProgress::Explain(query) => {
                let prompt = if let Some(snippet) = snippets.as_ref().unwrap().first() {
                    let grown = grow_snippet(snippet, &semantic, &app).await?;
                    app.with_prior_conversation(thread_id, |conversation| {
                        answer_api_client.build_explain_prompt(&grown, conversation, query)
                    })
                } else {
                    api::Messages {
                        messages: vec![api::Message {
                            role: "user".into(),
                            content: "Apologize for not finding a suitable code snippet, \
                        while expressing hope that one of the snippets may still be useful"
                                .to_string(),
                        }],
                    }
                };
                let tokens_used =
                    semantic.gpt2_token_count(&prompt.messages.first().unwrap().content);
                info!(%tokens_used, "input prompt token count");
                let max_tokens = 8000u32.saturating_sub(tokens_used as u32);
                if max_tokens == 0 {
                    // our prompt has overshot the token count, log an error for now
                    // TODO: this should propagte to sentry
                    error!(%tokens_used, "prompt overshot token limit");
                }
                // do not let the completion cross 250 tokens
                let max_tokens = max_tokens.clamp(1, 250);
                info!(%max_tokens, "clamping max tokens");

                (prompt, max_tokens, 0.9, vec![])
            }
        };

        event
            .write()
            .await
            .stages
            .push(progress.to_stage(&mut stop_watch, snippets.as_deref()));

        // This strange extraction of parameters from a tuple is due to lifetime issues. This
        // function should probably be refactored, but at the time of writing this is left as-is
        // due to time constraints.
        let mut stream = Box::pin(
            answer_api_client
                .send_until_success(
                    stream_params.0,
                    stream_params.1,
                    stream_params.2,
                    api::Provider::OpenAi,
                    stream_params.3,
                )
                .await?,
        );

        if let AnswerProgress::Rephrase(_) = &progress {
            let rephrased_query: String = stream.try_collect().await?;
            info!("Rephrased query: {:?}", &rephrased_query);
            if rephrased_query.trim() == "N/A" {
                let rephrase_fail_stream = Box::pin(stream::once(async {
                    Ok(
                        "I'm not sure what you mean. Try asking a technical question about the codebase."
                            .to_string(),
                    )
                }));
                return Ok((None, stop_watch, rephrase_fail_stream));
            }
            progress = AnswerProgress::Search(rephrased_query);
            continue;
        }

        let mut collected = FirstToken::None;
        while let Some(token) = stream.try_next().await? {
            if let Ok(i) = token.trim().parse::<usize>() {
                collected = FirstToken::Number(i);
                break;
            } else if !token.bytes().all(|b| b.is_ascii_whitespace()) {
                collected = FirstToken::Other(token);
                break;
            }
        }

        match collected {
            FirstToken::Number(n) => {
                progress = match progress {
                    AnswerProgress::Search(prompt) => {
                        let Some(index) = n.checked_sub(1) else {
                            let selection_fail_stream = Box::pin(stream::once(async {
                                Ok("I'm not sure. One of these snippets might be relevant".to_string())
                            }));
                            return Ok((snippets, stop_watch, selection_fail_stream));
                        };
                        snippets.as_mut().unwrap().swap(index, 0);
                        AnswerProgress::Explain(prompt)
                    }
                    e => e,
                }
            }
            FirstToken::Other(token) => {
                return Ok((
                    snippets,
                    stop_watch,
                    Box::pin(stream::once(async move { Ok(token) }).chain(stream)),
                ));
            }
            FirstToken::None => {
                return Ok((
                    snippets,
                    stop_watch,
                    Box::pin(stream::once(async move { Ok("".to_string()) }).chain(stream)),
                ));
            }
        }
    }
}

async fn _handle(
    state: &AnswerState,
    params: Params,
    app: Application,
    event: Arc<RwLock<QueryEvent>>,
) -> Result<impl IntoResponse> {
    let query_id = uuid::Uuid::new_v4();

    info!("Raw query: {:?}", &params.q);

    {
        let mut analytics_event = event.write().await;
        analytics_event.user_id = params.user_id.clone();
        analytics_event.query_id = query_id;
        analytics_event.session_id = params.thread_id.clone();
        if let Some(semantic) = app.semantic.as_ref() {
            analytics_event.overlap_strategy = semantic.overlap_strategy();
        }
        analytics_event
            .stages
            .push(Stage::new("raw_query", &params.q));
    }

    let query = parse_query(&params.q)?;
    info!("Parsed query target: {:?}", &query);

    let stop_watch = StopWatch::start();
    let params = Arc::new(params);
    let mut app = Arc::new(app);
    let (snippets, mut stop_watch, mut text) = handle_inner(
        &query,
        &params.thread_id,
        state,
        Arc::clone(&params),
        Arc::clone(&app),
        Arc::clone(&event),
        stop_watch,
    )
    .await?;
    Arc::make_mut(&mut app).add_conversation_entry(params.thread_id.clone(), query);
    let initial_event = Event::default()
        .json_data(super::Response::<'static>::from(AnswerResponse {
            query_id,
            session_id: params.thread_id.clone(),
            user_id: params.user_id.clone(),
            snippets: snippets.as_ref().map(|matches| AnswerSnippets {
                matches: matches.clone(),
                answer_path: matches
                    .first()
                    .map(|s| &s.relative_path)
                    .cloned()
                    .unwrap_or_default(),
            }),
        }))
        .map_err(Error::internal)?;

    let mut expl = String::new();

    let wrapped_stream = async_stream::stream! {
        yield Ok(initial_event);
        while let Some(result) = text.next().await {
            if let Ok(fragment) = &result {
                app.extend_conversation_answer(params.thread_id.clone(), fragment.trim_end())
            }
            yield Ok(Event::default()
                .json_data(result.as_ref().map_err(|e| e.to_string()))
                .unwrap());

            match result {
                Ok(s) => expl += &s,
                Err(e) => yield Err(e),
            }
        }
        let mut event = event.write().await;
        event
            .stages
            .push(Stage::new("answer", &expl).with_time(stop_watch.lap()));
        app.track_query(&event);
    };

    Ok(Sse::new(wrapped_stream.chain(futures::stream::once(
        async { Ok(Event::default().data("[DONE]")) },
    ))))
}

// grow the text of this snippet by `size` and return the new text
fn grow(doc: &ContentDocument, snippet: &Snippet, size: usize) -> Option<String> {
    let content = &doc.content;

    // do not grow if this snippet contains incorrect byte ranges
    if snippet.start_byte >= content.len() || snippet.end_byte >= content.len() {
        error!(
            repo = snippet.repo_name,
            path = snippet.relative_path,
            start = snippet.start_byte,
            end = snippet.end_byte,
            "invalid snippet bounds",
        );
        return None;
    }

    // do not grow if this snippet contains incorrect byte ranges
    if snippet.start_byte >= content.len() || snippet.end_byte >= content.len() {
        error!(
            repo = snippet.repo_name,
            path = snippet.relative_path,
            start = snippet.start_byte,
            end = snippet.end_byte,
            "invalid snippet bounds",
        );
        return None;
    }

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

    Some(content[new_start_byte..new_end_byte].to_owned())
}

static RAKE: once_cell::sync::Lazy<Rake> = once_cell::sync::Lazy::new(|| {
    let stop_words = include_str!("../../../stopwords.txt");
    let sw = stop_words
        .lines()
        .map(ToOwned::to_owned)
        .collect::<HashSet<String>>()
        .into();
    Rake::new(sw)
});

fn get_keywords(query: &str) -> String {
    RAKE.run(query)
        .into_iter()
        .map(|score| score.keyword)
        .collect::<Vec<String>>()
        .join(" ")
}

struct AnswerAPIClient<'s> {
    host: String,
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
        max_attempts: usize,
        bearer_token: Option<String>,
    ) -> AnswerAPIClient<'s> {
        AnswerAPIClient {
            host: host.to_owned(),
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
        messages: api::Messages,
        max_tokens: u32,
        temperature: f32,
        provider: api::Provider,
        extra_stop_sequences: Vec<String>,
    ) -> Result<impl Stream<Item = Result<String, AnswerAPIError>>, AnswerAPIError> {
        let mut stream = Box::pin(
            reqwest_eventsource::EventSource::new({
                let mut builder = self.client.post(self.host.as_str());

                if let Some(bearer) = &self.bearer_token {
                    builder = builder.bearer_auth(bearer);
                }

                builder.json(&api::Request {
                    messages,
                    max_tokens: Some(max_tokens),
                    temperature: Some(temperature),
                    provider,
                    extra_stop_sequences,
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

    #[allow(dead_code)]
    async fn send_until_success(
        &self,
        messages: api::Messages,
        max_tokens: u32,
        temperature: f32,
        provider: api::Provider,
        extra_stop_sequences: Vec<String>,
    ) -> Result<impl Stream<Item = Result<String, AnswerAPIError>>, AnswerAPIError> {
        for attempt in 0..self.max_attempts {
            let result = self
                .send(
                    messages.clone(),
                    max_tokens,
                    temperature,
                    provider.clone(),
                    extra_stop_sequences.clone(),
                )
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
    fn build_select_prompt(&self, query: &str, snippets: &[Snippet]) -> api::Messages {
        // snippets are 1-indexed so we can use index 0 where no snippets are relevant
        let mut system = snippets
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
        system += &format!(
            "Above are {} code snippets separated by \"{DELIMITER}\". Your job is to select the snippet that best answers the question. Reply with a single integer indicating the index of the snippet in the list.
If none of the snippets are relevant reply with the number 0. Wrap your response in <index></index> XML tags.

User:What icon do we use to clear search history?
Assistant:<index>3</index>

User:{}
Assistant:<index>",
            snippets.len(),
            &query
        );

        let messages = vec![api::Message {
            role: "user".into(),
            content: system.clone(),
        }];

        let tokens_used = self.semantic.gpt2_token_count(&system);
        debug!(%tokens_used, "select prompt token count");

        api::Messages { messages }
    }

    fn build_explain_prompt(
        &self,
        snippet: &Snippet,
        conversation: &[(String, String)],
        query: &str,
    ) -> api::Messages {
        let system = format!(
            r#"{}/{}
=========
{}
=========
Above, you have an extract from a code file. This message will be followed by the last few utterances of a conversation with a user. Use the code file to write a concise, precise answer to the question.

- Format your response in GitHub Markdown. Paths, function names and code extracts should be enclosed in backticks.
- Keep your response short. It should only be a few sentences long at the most.
- Do NOT copy long chunks of code into the response.
- If the file doesn't contain enough information to answer the question, or you don't know the answer, just say "Sorry, I'm not sure.".
- Do NOT try to make up an answer or answer with regard to information that is not in the file.
- The conversation history can provide context to the user's current question, but sometimes it contains irrelevant information. IGNORE information in the conversation which is irrelevant to the user's current question.

Let's think step by step. First carefully refer to the code above, then answer the question with reference to it."#,
            snippet.repo_name, snippet.relative_path, snippet.text,
        );

        let mut messages = vec![api::Message {
            role: "system".to_string(),
            content: system,
        }];

        for (question, answer) in conversation {
            messages.push(api::Message {
                role: "user".to_string(),
                content: question.clone(),
            });
            messages.push(api::Message {
                role: "assistant".to_string(),
                content: answer.clone(),
            });
        }

        messages.push(api::Message {
            role: "user".to_string(),
            content: query.to_string(),
        });

        api::Messages { messages }
    }
}

fn build_rephrase_query_prompt(query: &str, conversation: &[(String, String)]) -> api::Messages {
    let system =
        r#"Given a question and an optional conversational history between a user and yourself, generate a standalone question. If there is no question, write "N/A" instead."

- IGNORE any information in the conversational history which is not relevant to the question
- Absolutely, positively do NOT answer the question
- Rephrase the question into a standalone question
- The standalone question should be concise
- Only add terms to the standalone question where absolutely necessary

User: Hey bloop, do we pin js version numbers?
Assistant: Do we pin js version numbers?

User: Hey bloop, I have a question - Where do we test if GitHub login works?
Assistant: To test GitHub login, you would:\n\n- Call `handleClick()` to initiate the login flow\n- Check for the presence of a `loginUrl` to see if the login was successful\n- Check for the `authenticationFailed` state to see if the login failed
User: which file?
Assistant: In which file do we test if GitHub login works?

User: What's the best way to update the search icon @bloop?
Assistant: What's the best way to update the search icon?

User: Where do we test if GitHub login works
Assistant: To test GitHub login, you would:\n\n- Call `handleClick()` to initiate the login flow\n- Check for the presence of a `loginUrl` to see if the login was successful\n- Check for the `authenticationFailed` state to see if the login failed
User: Are there unit tests?
Assistant: Is there a unit test for GitHub login?

User: sdfkhsdkfh
Assistant: N/A

User: Where is the answer api called
Assistant: The answer API client is called in `server/bleep/webserver/answer.rs`. After building the prompt the `select_snippet` method belonging to the `answer_api_client` is called.
User: frontend
Assistant: Where is the answer API called on the frontend?

User: Where do bug reports get sent?
Assistant: Bug reports get sent to the repo maintainers.
User: Which url
Assistant: Which url do bug reports get sent to?

User: tailwind config
Assistant: The `tailwind.config.cjs` file configures Tailwind CSS for the desktop app by extending a basic configuration and adding additional content paths.
User: client config
Assistant: Where is the client Tailwind config file?

User: I love bananas
Assistant: I'm sorry, I don't understand what you mean. Please ask a question that's related to the codebase.
User: Which onnxruntime library do we use?
Assistant: Which onnxruntime library do we use?

User: Where is the query parsing logic?
Assistant: The query parser is defined in the `parse` function in `server/bleep/src/query/parser.rs`.
User: Which libraries does it use?
Assistant: Sorry, the given code snippet does not contain enough context to determine which libraries the query parser uses.
User: Where's the delete repo endpoint?
Assistant: Where's the delete repo endpoint?"#.to_string();

    let mut messages = vec![api::Message {
        role: "system".to_string(),
        content: system,
    }];

    for (question, answer) in conversation {
        messages.push(api::Message {
            role: "user".to_string(),
            content: question.clone(),
        });
        messages.push(api::Message {
            role: "assistant".to_string(),
            content: answer.clone(),
        });
    }

    messages.push(api::Message {
        role: "user".to_string(),
        content: query.to_string(),
    });

    api::Messages { messages }
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
