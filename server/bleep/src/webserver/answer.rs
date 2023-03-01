#![allow(unused)]
use std::{
    collections::HashMap,
    convert,
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
        pub extra_stop_sequences: Vec<String>,
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

#[derive(Clone, Debug, serde::Deserialize)]
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

fn parse_query(query: &str) -> Result<String, Error> {
    Ok(parser::parse_nl(query)
        .map_err(Error::user)?
        .target()
        .ok_or_else(|| Error::user("empty search"))?
        .to_string())
}

const MAX_HISTORY: usize = 7;

enum AnswerProgress {
    // Need to get info
    GetInfo,
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
            AnswerProgress::GetInfo => Stage::new("get_info", ""),
            AnswerProgress::Rephrase(s) => Stage::new("rephrase", s),
            AnswerProgress::Search(_) => Stage::new("search", snippets),
            AnswerProgress::Explain(expl) => Stage::new("explain", expl),
        }
        .with_time(stop_watch.lap())
    }
}

fn build_rephrase_query_prompt_with_context(
    query: &str,
    user_id: &str,
    app: &Application,
) -> Option<String> {
    app.with_prior_conversation(
        user_id,
        // check how much history we can afford to create up to the token limit
        |history| {
            if history.is_empty() {
                None
            } else {
                let n = history.len().saturating_sub(MAX_HISTORY);
                Some(build_rephrase_query_prompt(query, &history[n..]))
            }
        },
    )
}

async fn search_snippets(semantic: &Semantic, query: &str) -> Result<Vec<Snippet>, Error> {
    let all_snippets: Vec<Snippet> = semantic
        .search(
            &parser::parse_nl(query).map_err(Error::user)?,
            4 * SNIPPET_COUNT as u64,
        ) // heuristic
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
            if token_count > 2000 || grow_size > 100 {
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
    state: &AnswerState,
    params: Arc<Params>,
    app: Arc<Application>,
    event: Arc<RwLock<QueryEvent>>,
    mut stop_watch: StopWatch,
) -> Result<(
    Option<Vec<Snippet>>,
    StopWatch,
    String,
    impl Stream<Item = Result<String, AnswerAPIError>>,
)> {
    let query = parse_query(&params.q)?;
    let user_id = &params.user_id;
    let mut snippets = None;

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

    let semantic = app
        .semantic
        .clone()
        .ok_or_else(|| Error::new(ErrorKind::Configuration, "Qdrant not configured"))?;

    let answer_api_client = semantic.build_answer_api_client(
        state,
        format!("{}/q", app.config.answer_api_url).as_str(),
        &query,
        5,
        answer_bearer.clone(),
    );

    let mut progress = build_rephrase_query_prompt_with_context(&query, user_id, &app)
        .map(AnswerProgress::Rephrase)
        .unwrap_or(AnswerProgress::GetInfo);

    event
        .write()
        .await
        .stages
        .push(Stage::new("start", &query).with_time(stop_watch.lap()));

    loop {
        // Here we ask anthropic for either action selection, rephrasing or explanation
        // (depending on `progress`)
        let stream_params = match &progress {
            AnswerProgress::GetInfo => (
                build_action_selection_prompt(&query),
                100,
                0.0,
                vec!["</response>".into()],
            ),
            AnswerProgress::Rephrase(prompt) => {
                let prompt = build_rephrase_query_prompt_with_context(prompt, user_id, &app)
                    .unwrap_or_else(|| build_rephrase_query_prompt(prompt, &[]));

                (prompt, 100, 0.0, vec!["</question>".into()])
            }
            AnswerProgress::Search(prompt) => {
                let s = search_snippets(&semantic, prompt).await?;

                // though we only need one token for the selection, we may get
                // an apology for not finding a suitable one instead
                let prompt = answer_api_client.build_select_prompt(&s);
                snippets = Some(s);
                (prompt, 100, 0.0, Vec::new())
            }
            AnswerProgress::Explain(query) => {
                let prompt = if let Some(snippet) = snippets.as_ref().unwrap().first() {
                    let grown = grow_snippet(snippet, &semantic, &app).await?;

                    app.with_prior_conversation(user_id, |conversation| {
                        answer_api_client.build_explain_prompt(&grown, conversation, query)
                    })
                } else {
                    "Apologize for not finding a suitable code snippet, \
                        while expressing hope that one of the snippets may still be useful"
                        .to_string()
                };

                (prompt, 400, 0.0, vec!["</response>".to_owned()])
            }
        };

        // This strange extraction of parameters from a tuple is due to lifetime issues. This
        // function should probably be refactored, but at the time of writing this is left as-is
        // due to time constraints.
        let mut stream = Box::pin(
            answer_api_client
                .send(
                    &stream_params.0,
                    stream_params.1,
                    stream_params.2,
                    api::Provider::Anthropic,
                    stream_params.3,
                )
                .await?,
        );

        if let AnswerProgress::Rephrase(_) = &progress {
            let rephrased_prompt = stream.try_collect().await?;
            progress = AnswerProgress::Search(rephrased_prompt);
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

        event
            .write()
            .await
            .stages
            .push(progress.to_stage(&mut stop_watch, snippets.as_deref()));

        match collected {
            FirstToken::Number(n) => {
                progress = match progress {
                    AnswerProgress::GetInfo => {
                        if n == 0 {
                            AnswerProgress::Rephrase(query.clone())
                        } else {
                            return Ok((snippets, stop_watch, n.to_string(), stream));
                        }
                    }
                    AnswerProgress::Search(prompt) => {
                        let Some(index) = n.checked_sub(1) else {
                            todo!("handle wrong index");
                        };
                        snippets.as_mut().unwrap().swap(index, 0);
                        AnswerProgress::Explain(prompt)
                    }
                    e => e,
                }
            }
            FirstToken::Other(token) => {
                return Ok((snippets, stop_watch, token, stream));
            }
            FirstToken::None => {
                // the stream is empty!?
                return Err(Error::internal("empty stream"));
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
        if let Some(semantic) = app.semantic.as_ref() {
            analytics_event.overlap_strategy = semantic.overlap_strategy();
        }
    }

    let mut stop_watch = StopWatch::start();
    let params = Arc::new(params);
    let mut app = Arc::new(app);
    let (snippets, mut stop_watch, first_token, mut text) = handle_inner(
        state,
        Arc::clone(&params),
        Arc::clone(&app),
        Arc::clone(&event),
        stop_watch,
    )
    .await?;
    Arc::make_mut(&mut app).add_conversation_entry(params.user_id.clone(), parse_query(&params.q)?);
    let initial_event = Event::default()
        .json_data(super::Response::<'static>::from(AnswerResponse {
            query_id,
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

    let mut expl = first_token.clone();

    let wrapped_stream = async_stream::stream! {
        yield Ok(initial_event);
        yield Ok(Event::default().json_data(Ok::<_, ()>(first_token)).unwrap());
        while let Some(result) = text.next().await {
            if let Ok(fragment) = &result {
                app.extend_conversation_answer(params.user_id.clone(), fragment)
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
            .push(Stage::new("explanation", &expl).with_time(stop_watch.lap()));
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
        extra_stop_sequences: Vec<String>,
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

    async fn send_until_success(
        &self,
        prompt: &str,
        max_tokens: u32,
        temperature: f32,
        provider: api::Provider,
        extra_stop_sequences: Vec<String>,
    ) -> Result<String, AnswerAPIError> {
        for attempt in 0..self.max_attempts {
            let result = self
                .send(
                    prompt,
                    max_tokens,
                    temperature,
                    provider.clone(),
                    extra_stop_sequences.clone(),
                )
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
If there is any relevant snippet, do NOT return a non-numeric answer.
If none of the snippets are relevant, return an apology for not being able to decide on a good snippet.

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

    fn build_explain_prompt(
        &self,
        snippet: &Snippet,
        conversation: &[(String, String)],
        query: &str,
    ) -> String {
        let mut prompt = format!(
            "Repo:{} Path:{}\n\
            =========\n\
            {}\n\
            =========\n\
            Human: You are bloop, an AI assistant for a codebase. Above, you have an extract from a code file. Below you have the last utterances of a conversation with a user (represented inside <conversation></conversation> XML tags). \
            Use the code file to write a concise, precise answer to the question. Put your response inside XML tags, like this: <response></response>.\n\
            - ONLY copy code into the answer if it helps answer the question.\n\
            - Do format your response in GitHub markdown with code blocks annotated with programming language.\n\
            - Do NOT include code that is not in the file. If the file doesn't contain enough information to answer the question, or you don't know the answer, just say \"Sorry, I'm not sure\".\n\
            - Do NOT try to make up an answer.\n\
            - The conversation history can provide context to the user's current question, but sometimes it contains irrelevant information. IGNORE information in the conversation which is irrelevant to the user's current question.\n\
            <conversation>",
            snippet.repo_name, snippet.relative_path, snippet.text,
        );
        for (question, answer) in conversation {
            prompt.extend(["\nperson: ", question, "\nbloop: ", answer]);
        }
        prompt += "\nperson: ";
        prompt += query;
        prompt + "\n</conversation>\n<response>"
    }

    async fn select_snippet(&self, prompt: &str) -> Result<String> {
        self.send_until_success(prompt, 1, 0.0, api::Provider::Anthropic, Vec::new())
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
        self.send(
            prompt,
            max_tokens as u32,
            0.0,
            api::Provider::Anthropic,
            Vec::new(),
        )
        .await
    }
}

fn build_rephrase_query_prompt(query: &str, conversation: &[(String, String)]) -> String {
    let mut prompt =
        r#"Human: You are bloop, an AI agent designed to help developers navigate codebases and ship to production faster. Given a question and an optional conversational history between a person and yourself, (represented inside <conversation></conversation> XML tags), extract a standalone question, if any, from the last turn in the dialogue. Put the question you extract inside XML tags, like this: <question></question>. If there is no question, write "N/A" instead.

IGNORE any information in the conversational history which is not relevant to the question
Absolutely, positively do NOT answer the question
Rephrase the question into a standalone question
Your rephrased question should be short and should contain relevant keywords

<conversation>
Person: Hey bloop, do we pin js version numbers?
</conversation>
Assistant: <question>Do we pin js version numbers?</question>

<conversation>
Person: Hey bloop, I have a question - Where do we test if GitHub login works?
bloop: To test GitHub login, you would:\n\n- Call `handleClick()` to initiate the login flow\n- Check for the presence of a `loginUrl` to see if the login was successful\n- Check for the `authenticationFailed` state to see if the login failed
Person: which file?
</conversation>
Assistant: <question>In which file do we test if GitHub login works?</question>

<conversation>
Person: What's the best way to update the search icon @bloop?
</conversation>
Assistant: <question>What's the best way to update the search icon?</question>

<conversation>
Person: Where do we test if GitHub login works
bloop: To test GitHub login, you would:\n\n- Call `handleClick()` to initiate the login flow\n- Check for the presence of a `loginUrl` to see if the login was successful\n- Check for the `authenticationFailed` state to see if the login failed
Person: Are there unit tests?
</conversation>
Assistant: <question>Is there a unit test for GitHub login?</question>

<conversation>
Person: Where is the answer api called
bloop: The answer API client is called in `server/bleep/webserver/answer.rs`. After building the prompt the `select_snippet` method belonging to the `answer_api_client` is called.
Person: frontend
</conversation>
Assistant: <question>Where is the answer API called on the frontend?</question>

<conversation>
Person: Where do bug reports get sent?
bloop: Bug reports get sent to the repo maintainers.
Person: Which url
</conversation>
Assistant: <question>Which url do bug reports get sent to?</question>

<conversation>
Person: tailwind config
bloop: The `tailwind.config.cjs` file configures Tailwind CSS for the desktop app by extending a basic configuration and adding additional content paths.
Person: client config
</conversation>
Assistant: <question>Where is the client Tailwind config file?</question>

<conversation>
Person: I love bananas
bloop: I'm sorry, I don't understand what you mean. Please ask a question that's related to the codebase.
Person: Which onnxruntime library do we use?
</conversation>
Assistant: <question>Which onnxruntime library do we use?</question>

<conversation>
Person: Where is the query parsing logic?
bloop: The query parser is defined in the `parse` function in `server/bleep/src/query/parser.rs`.
Person: Which libraries does it use?
bloop: Sorry, the given code snippet does not contain enough context to determine which libraries the query parser uses.
Person: Where's the delete repo endpoint?
</conversation>
Assistant: <question>Where's the delete repo endpoint?</question>

<conversation>"#.to_string();
    for (question, answer) in conversation {
        prompt.extend(["\nPerson: ", question, "\nbloop: ", answer]);
    }
    prompt += "\nPerson: ";
    prompt += query;
    prompt + "\n</conversation>\nAssistant: <question>"
}

fn build_action_selection_prompt(query: &str) -> String {
    format!(
        r#"Human: You are bloop, an AI agent designed to help developers navigate codebases and ship to production faster. You can think of bloop as like having an intern sitting next to you, completing menial tasks on your behalf while you get on with solving complex problems and shipping products.

- bloop works by searching your codebase for relevant files using proprietary trained models, and leverages the power of GPT to provide rich explanations.
- The company behind bloop is a startup founded in 2021, based in Farringdon, London. They are a Y Combinator company.
- bloop cannot answer questions unrelated to your codebase.
- bloop does not have feelings or opinions.
- Further information about bloop can be found on the website https://bloop.ai

Given a user question (represented inside <question></question> XML tags) classify which of the following categories the question corresponds to and make the corresponding response. Put your response inside XML tags, like this: <response></response>.

Categories to choose from:
(1) If the query is about the codebase or product reply with 0. Your answer MUST be the single integer 0.
(2) If the query is about the bloop support agent, answer the query in the first person in a polite and helpful way using only the information above. Your response should be a couple of sentences at the most.
(3) If the query is an introduction or welcome message respond to the user by introducing yourself in the first person, in a polite and helpful way using only the information above. Your response should be a couple of sentences at the most.
(4) If the query is something else explain that you can't answer it in a polite and helpful way. Suggest that the user asks a technical question about the codebase, or tries asking their question again in a different way. Your response should be a couple of sentences at the most. Do NOT answer the question.

<question>Hey bloop, do we pin js version numbers?</question>
<response>0</response>

<question>When's your birthday @bloop?</question>
<response>I do not know my birthday. The company that started bloop is a startup founded in 2021, based in Farringdon, London.</response>

<question>What color are avocados?</question>
<response>I'm sorry, I don't understand what you mean. Please ask a question that's related to the codebase.</response>

<question>Where do we test if GitHub login works?</question>
<response>0</response>

<question>How do we balance eggs on a spoon?</question>
<repsonse>I'm sorry, I don't understand what you mean. Please ask a question that's related to the codebase.</response>

<question>What is bloop?</question>
<response>bloop is a AI agent designed to help developers with many tasks. You can think of bloop as like having an intern sitting next to you, completing menial tasks on your behalf while you get on with solving complex problems and shipping products.</response>

<question>Introduce yourself.</question>
<response>It's great to meet you! I'm an AI agent, here to help you find code from your codebase and ship to production faster.</response>

<question>It's great to meet you.</question>
<response>Nice to meet you too! I'm looking forward to helping you with your everyday tasks and menial work!</response>

<question>How does bloop work?</question>
<response>bloop works by searching your codebase for relevant files using proprietary trained models, and leverages the power of GPT to provide rich explanations.</response>

<question>Where do we check if Kafka is running?</question>
<response>0</response>

<question>Which investors have invested in bloop?</question>
<response>Y Combinator has invested in bloop.</response>

<question>fshkfjjf</question>
<response>I'm sorry, I don't understand what you mean. Please ask a question that's related to the codebase.</response>

<question>What's the best way to update the search icon @bloop?</question>
<response>0</response>

<question>Hey bloop, I have a question - Where do we test if GitHub login works?</question>
<response>0</response>

<question>{}</question>
<response>"#,
        query,
    )
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
