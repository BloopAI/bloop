use std::{
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

use secrecy::ExposeSecret;
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::{
    analytics::{QueryEvent, Stage},
    env::Feature,
    indexes::reader::ContentDocument,
    query::parser::{self, ParsedQuery},
    remotes,
    repo::RepoRef,
    semantic::{deduplicate_snippets, Payload, Semantic},
    Application,
};

use super::{middleware::User, prelude::*};

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

    impl Provider {
        pub fn token_limit(&self) -> usize {
            match self {
                Self::OpenAi => 8192,
                Self::Anthropic => 8000,
            }
        }
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

type Snippet = Payload<'static>;

fn default_limit() -> u64 {
    20
}

#[derive(Clone, Debug, serde::Deserialize)]
pub struct Params {
    pub q: String,
    pub thread_id: String,
    #[serde(default = "default_limit")]
    pub limit: u64,
}

#[derive(serde::Serialize, Debug)]
pub struct AnswerResponse {
    pub session_id: String,
    pub query_id: uuid::Uuid,
    pub snippets: Option<AnswerSnippets>,
}

#[derive(serde::Serialize, Debug)]
pub struct AnswerSnippets {
    pub matches: Vec<Snippet>,
    pub answer_path: String,
}

impl super::ApiResponse for AnswerResponse {}

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
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse> {
    // create a new analytics event for this query
    let event = Arc::new(RwLock::new(QueryEvent::default()));

    // populate analytics event
    let response = _handle(
        &state,
        params,
        app.clone(),
        Arc::clone(&event),
        user.clone(),
    )
    .await;

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
        app.track_query(&user, &ev);
    } else {
        // the analytics event is fired when the stream is consumed
    }
    response
}

fn parse_query(query: &str) -> Result<String, Error> {
    let ParsedQuery::Semantic(q) = parser::parse_nl(query).map_err(Error::user)? else {
	return Err(Error::new(ErrorKind::User, "only semantic queries are allowed"));
    };

    Ok(q.target()
        .ok_or_else(|| Error::user("empty search"))?
        .to_string())
}

const MAX_HISTORY: usize = 3;

#[derive(Debug)]
enum AnswerProgress {
    // Need to rephrase the query. The contained string is the prompt for rephrasing
    Rephrase(String),
    // Got a query to search
    Search(String),
    // Explain the results
    Explain(String),
}

async fn search_snippets(
    semantic: &Semantic,
    raw_query: &str,
    rephrased_query: &str,
) -> Result<Vec<Snippet>, Error> {
    let ParsedQuery::Semantic(ref mut parsed_query): ParsedQuery = parser::parse_nl(raw_query)
        .map_err(Error::user)? else {
	    unreachable!()
	};

    parsed_query.target = Some(parser::Literal::Plain(rephrased_query.into()));

    let all_snippets: Vec<Snippet> = semantic
        .search(parsed_query, 4 * SNIPPET_COUNT as u64, 0) // heuristic
        .await
        .map_err(Error::internal)?
        .into_iter()
        .map(Snippet::from_qdrant)
        .collect();

    Ok(all_snippets)
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
            break relevant_snippet.text.to_string();
        }
    };

    Ok(Payload {
        lang: relevant_snippet.lang.clone(),
        repo_name: relevant_snippet.repo_name.clone(),
        repo_ref: relevant_snippet.repo_ref.clone(),
        relative_path: relevant_snippet.relative_path.clone(),
        text: grown_text.into(),
        start_line: relevant_snippet.start_line,
        end_line: relevant_snippet.end_line,
        start_byte: relevant_snippet.start_byte,
        end_byte: relevant_snippet.end_byte,
        score: relevant_snippet.score,
        embedding: relevant_snippet.embedding.clone(),
        branches: relevant_snippet.branches.clone(),
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
        let stream_params = match &progress {
            AnswerProgress::Rephrase(query) => {
                let prompt = app.with_prior_conversation(thread_id, |history| {
                    let n = history.len().saturating_sub(MAX_HISTORY);
                    build_rephrase_query_prompt(query, history.get(n..).unwrap_or_default())
                });
                (prompt, 20, 0.0, vec![])
            }
            AnswerProgress::Search(rephrased_query) => {
                // TODO: Clean up this query handling logic
                let all_snippets = search_snippets(&semantic, &params.q, rephrased_query).await?;
                info!("Retrieved {} snippets", all_snippets.len());

                event.write().await.stages.push(
                    Stage::new("semantic_results", &all_snippets).with_time(stop_watch.lap()),
                );

                let query_embedding = semantic.embed(rephrased_query).map_err(|e| {
                    error!("failed to embed query: {}", e);
                    Error::internal(e)
                })?;
                let filtered_snippets =
                    deduplicate_snippets(all_snippets, query_embedding, SNIPPET_COUNT);

                event.write().await.stages.push(
                    Stage::new("filtered_semantic_results", &filtered_snippets)
                        .with_time(stop_watch.lap()),
                );

                if filtered_snippets.is_empty() {
                    warn!("Semantic search returned no snippets");
                    let selection_fail_stream = Box::pin(stream::once(async {
                        Ok("Sorry, I could not find any results matching your query. \
                            Please try again with different keywords or refine your search."
                            .to_string())
                    }));
                    return Ok((snippets, stop_watch, selection_fail_stream));
                }

                let prompt =
                    answer_api_client.build_select_prompt(rephrased_query, &filtered_snippets);
                snippets = Some(filtered_snippets);

                event
                    .write()
                    .await
                    .stages
                    .push(Stage::new("select_prompt", &prompt).with_time(stop_watch.lap()));

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

                event
                    .write()
                    .await
                    .stages
                    .push(Stage::new("explain_prompt", &prompt).with_time(stop_watch.lap()));

                (prompt, max_tokens, 0.9, vec![])
            }
        };

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
            event
                .write()
                .await
                .stages
                .push(Stage::new("rephrased_query", &rephrased_query));
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
                    AnswerProgress::Search(_) => {
                        let Some(index) = n.checked_sub(1) else {
                            let selection_fail_stream = Box::pin(stream::once(async {
                                Ok("I'm not sure. One of these snippets might be relevant".to_string())
                            }));
                            return Ok((snippets, stop_watch, selection_fail_stream));
                        };
                        snippets.as_mut().unwrap().swap(index, 0);
                        AnswerProgress::Explain(query.clone())
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
    user: User,
) -> Result<impl IntoResponse> {
    let query_id = uuid::Uuid::new_v4();

    info!("Raw query: {:?}", &params.q);

    {
        let mut analytics_event = event.write().await;
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
            snippets: snippets.as_ref().map(|matches| AnswerSnippets {
                matches: matches.to_vec(),
                answer_path: matches
                    .first()
                    .map(|s| &s.relative_path)
                    .cloned()
                    .unwrap_or_default()
                    .to_string(),
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

        debug!("answer complete, closing SSE");
        let mut event = event.write().await;
        event
            .stages
            .push(Stage::new("answer", &expl).with_time(stop_watch.lap()));
        app.track_query(&user, &event);
    };

    Ok(Sse::new(wrapped_stream.chain(futures::stream::once(
        async { Ok(Event::default().data("[DONE]")) },
    ))))
}

// grow the text of this snippet by `size` and return the new text
fn grow(doc: &ContentDocument, snippet: &Snippet, size: usize) -> Option<String> {
    let content = &doc.content;

    // do not grow if this snippet contains incorrect byte ranges
    if snippet.start_byte as usize >= content.len() || snippet.end_byte as usize >= content.len() {
        error!(
            repo = %snippet.repo_name,
            path = %snippet.relative_path,
            start = snippet.start_byte,
            end = snippet.end_byte,
            "invalid snippet bounds",
        );
        return None;
    }

    // skip upwards `size` number of lines
    let new_start_byte = content
        .get(..snippet.start_byte as usize)?
        .rmatch_indices('\n')
        .map(|(idx, _)| idx)
        .nth(size)
        .unwrap_or(0);

    // skip downwards `size` number of lines
    let new_end_byte = content
        .get(snippet.end_byte as usize..)?
        .match_indices('\n')
        .map(|(idx, _)| idx)
        .nth(size)
        .map(|s| s.saturating_add(snippet.end_byte as usize)) // the index is off by `snippet.end_byte`
        .unwrap_or(content.len());

    content
        .get(new_start_byte..new_end_byte)
        .map(ToOwned::to_owned)
}

struct AnswerAPIClient<'s> {
    host: String,
    semantic: &'s Semantic,
    max_attempts: u64,
    bearer_token: Option<String>,
    client: reqwest::Client,
}

#[derive(Error, Debug)]
enum AnswerAPIError {
    #[error("max retry attempts reached {0}")]
    MaxAttemptsReached(u64),

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
        max_attempts: u64,
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
        const DELAY: [Duration; 5] = [
            Duration::from_secs(0),
            Duration::from_secs(2),
            Duration::from_secs(4),
            Duration::from_secs(8),
            Duration::from_secs(16),
        ];

        for attempt in 0..self.max_attempts {
            warn!(%attempt, "delaying by {:?}", DELAY[attempt as usize % 5]);
            tokio::time::sleep(DELAY[attempt as usize % 5]).await;

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
        let token_count = self
            .semantic
            .gpt2_token_count(include_str!("../prompt/select.txt"));
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
            .fold(
                (token_count, String::default()),
                |(count, mut prompt), entry| {
                    let new_count = count + self.semantic.gpt2_token_count(&entry);
                    if new_count < api::Provider::OpenAi.token_limit() {
                        prompt.push_str(&entry);
                        (new_count, prompt)
                    } else {
                        debug!("evicting a snippet!");
                        (count, prompt)
                    }
                },
            )
            .1;

        // the example question/answer pair helps reinforce that we want exactly a single
        // number in the output, with no spaces or punctuation such as fullstops.
        system += &format!(
            include_str!("../prompt/select.txt"),
            COUNT = snippets.len(),
            QUERY = &query,
            DELIMITER = DELIMITER,
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
            include_str!("../prompt/explain.txt"),
            TEXT = snippet.text,
            PATH = snippet.relative_path,
            REPO = snippet.repo_name,
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
    let mut system = include_str!("../prompt/rephrase.txt").to_string();

    for (question, answer) in conversation {
        system.push_str(&format!("User: {}\n", question.clone()));
        system.push_str(&format!("Assistant: {}\n", answer.clone()));
    }
    system.push_str(&format!("User: {}\n", query));
    system.push_str("Query: ");

    let messages = vec![api::Message {
        role: "system".to_string(),
        content: system,
    }];

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
