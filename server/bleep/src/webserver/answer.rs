use rand::{rngs::OsRng, seq::SliceRandom};
use secrecy::ExposeSecret;
use std::{
    collections::{HashMap, HashSet},
    fmt, mem,
    panic::AssertUnwindSafe,
    pin::pin,
    time::Duration,
};

use anyhow::{anyhow, bail, Context, Result};
use axum::{
    extract::Query,
    response::{
        sse::{self, Sse},
        IntoResponse,
    },
    Extension, Json,
};
use futures::{future::Either, stream, StreamExt, TryStreamExt};
use reqwest::StatusCode;
use serde_json::json;
use tiktoken_rs::CoreBPE;
use tokio::sync::mpsc::Sender;
use tracing::{debug, info, warn};

use super::middleware::User;
use crate::{
    analytics::{EventData, QueryEvent},
    db::QueryLog,
    indexes::reader::{ContentDocument, FileDocument},
    query::parser::{self, Literal, SemanticQuery},
    repo::RepoRef,
    semantic, Application,
};

pub mod conversations;
mod exchange;
mod llm_gateway;
mod partial_parse;
mod prompts;

use exchange::{Exchange, SearchStep, Update};
use llm_gateway::api::FunctionCall;

const TIMEOUT_SECS: u64 = 60;

#[derive(Clone, Debug, serde::Deserialize)]
pub struct Vote {
    pub feedback: VoteFeedback,
    pub thread_id: uuid::Uuid,
    pub query_id: uuid::Uuid,
    pub repo_ref: Option<RepoRef>,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase", tag = "type")]
pub enum VoteFeedback {
    Positive,
    Negative { feedback: String },
}

pub(super) async fn vote(
    Extension(app): Extension<Application>,
    Extension(user): Extension<User>,
    Json(params): Json<Vote>,
) {
    app.track_query(
        &user,
        &QueryEvent {
            query_id: params.query_id,
            thread_id: params.thread_id,
            repo_ref: params.repo_ref,
            data: EventData::output_stage("vote").with_payload("feedback", params.feedback),
        },
    );
}

#[derive(Clone, Debug, serde::Deserialize)]
pub struct Params {
    pub q: String,
    pub repo_ref: RepoRef,
    #[serde(default = "default_thread_id")]
    pub thread_id: uuid::Uuid,
    /// Optional id of exchange to overwrite
    pub rephrase_exchange_id: Option<uuid::Uuid>,
}

fn default_thread_id() -> uuid::Uuid {
    uuid::Uuid::new_v4()
}

pub(super) async fn handle(
    Query(params): Query<Params>,
    Extension(app): Extension<Application>,
    Extension(user): Extension<User>,
) -> super::Result<impl IntoResponse> {
    let query_id = uuid::Uuid::new_v4();
    let response = _handle(
        Query(params.clone()),
        Extension(app.clone()),
        Extension(user.clone()),
        query_id,
    )
    .await;

    if let Err(err) = response.as_ref() {
        app.track_query(
            &user,
            &QueryEvent {
                query_id,
                thread_id: params.thread_id,
                repo_ref: Some(params.repo_ref.clone()),
                data: EventData::output_stage("error")
                    .with_payload("status", err.status.as_u16())
                    .with_payload("message", err.message()),
            },
        );
    }

    response
}

pub(super) async fn _handle(
    Query(params): Query<Params>,
    Extension(app): Extension<Application>,
    Extension(user): Extension<User>,
    query_id: uuid::Uuid,
) -> super::Result<
    Sse<std::pin::Pin<Box<dyn tokio_stream::Stream<Item = Result<sse::Event>> + Send>>>,
> {
    QueryLog::new(&app.sql).insert(&params.q).await?;

    let conversation_id = ConversationId {
        user_id: user
            .login()
            .ok_or_else(|| super::Error::user("didn't have user ID"))?
            .to_string(),
        thread_id: params.thread_id,
    };

    let (repo_ref, mut exchanges) = conversations::load(&app.sql, &conversation_id)
        .await?
        .unwrap_or_else(|| (params.repo_ref.clone(), Vec::new()));

    let gh_token = app
        .github_token()
        .map_err(|e| super::Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .map(|s| s.expose_secret().clone());

    let llm_gateway = llm_gateway::Client::new(&app.config.answer_api_url)
        .temperature(0.0)
        .bearer(gh_token)
        .session_reference_id(conversation_id.to_string());

    // confirm client compatibility with answer-api
    match llm_gateway
        .is_compatible(env!("CARGO_PKG_VERSION").parse().unwrap())
        .await
    {
        Ok(res) if res.status() == StatusCode::OK => (),
        Ok(res) if res.status() == StatusCode::NOT_ACCEPTABLE => {
            let out_of_date = futures::stream::once(async {
                Ok(sse::Event::default()
                    .json_data(serde_json::json!({"Err": "incompatible client"}))
                    .unwrap())
            });
            return Ok(Sse::new(Box::pin(out_of_date)));
        }
        // the Ok(_) case should be unreachable
        Ok(_) | Err(_) => {
            warn!("failed to check compatibility ... defaulting to `incompatible`");
            let failed_to_check = futures::stream::once(async {
                Ok(sse::Event::default()
                    .json_data(serde_json::json!({"Err": "failed to check compatibility"}))
                    .unwrap())
            });
            return Ok(Sse::new(Box::pin(failed_to_check)));
        }
    };

    let Params {
        thread_id,
        rephrase_exchange_id,
        q,
        ..
    } = params;

    if let Some(rephrase_exchange_id) = rephrase_exchange_id {
        let rephrase_exchange_id = exchanges
            .iter()
            .position(|e| e.id == rephrase_exchange_id)
            .ok_or_else(|| super::Error::user("parent query id not found in exchanges"))?;

        exchanges.truncate(rephrase_exchange_id);
    }

    let query = parser::parse_nl(&q)
        .context("parse error")?
        .into_semantic()
        .context("got a 'Grep' query")?
        .into_owned();
    let query_target = query
        .target
        .as_ref()
        .context("query was empty")?
        .as_plain()
        .context("user query was not plain text")?
        .clone()
        .into_owned();

    exchanges.push(Exchange::new(query_id, query));

    let stream = async_stream::try_stream! {
        let mut action = Action::Query(query_target);
        let (exchange_tx, exchange_rx) = tokio::sync::mpsc::channel(10);

        let mut agent = Agent {
            app,
            repo_ref: repo_ref.clone(),
            exchanges: exchanges.clone(),
            exchange_tx,
            llm_gateway,
            user,
            thread_id,
            query_id,
            complete: false,
        };

        let mut exchange_rx = tokio_stream::wrappers::ReceiverStream::new(exchange_rx);

        let result = 'outer: loop {
            // The main loop. Here, we create two streams that operate simultaneously; the update
            // stream, which sends updates back to the HTTP event stream response, and the action
            // stream, which returns a single item when there is a new action available to execute.
            // Both of these operate together, and we repeat the process for every new action.

            use futures::future::FutureExt;

            let left_stream = (&mut exchange_rx).map(Either::Left);
            let right_stream = agent
                .step(action)
                .into_stream()
                .map(Either::Right);

            let timeout = Duration::from_secs(TIMEOUT_SECS);

            let mut next = None;
            for await item in tokio_stream::StreamExt::timeout(
                stream::select(left_stream, right_stream),
                timeout,
            ) {
                match item {
                    Ok(Either::Left(exchange)) => yield exchange,
                    Ok(Either::Right(next_action)) => match next_action {
                        Ok(n) => break next = n,
                        Err(e) => break 'outer Err(AgentError::Processing(e)),
                    },
                    Err(_) => break 'outer Err(AgentError::Timeout(timeout)),
                }
            }

            // NB: Sending updates after all other `await` points in the final `step` call will
            // likely not return a pending future due to the internal receiver queue. So, the call
            // stack usually continues onwards, ultimately resulting in a `Poll::Ready`, backing out
            // of the above loop without ever processing the final message. Here, we empty the
            // queue.
            while let Some(Some(exchange)) = exchange_rx.next().now_or_never() {
                yield exchange;
            }

            match next {
                Some(a) => action = a,
                None => break Ok(()),
            }
        };

        match result {
            Ok(_) => {}
            Err(AgentError::Timeout(duration)) => {
                warn!("Timeout reached.");
                agent.track_query(
                    EventData::output_stage("error")
                        .with_payload("timeout", duration.as_secs()),
                );
                Err(anyhow!("reached timeout of {duration:?}"))?;
            }
            Err(AgentError::Processing(e)) => {
                agent.track_query(
                    EventData::output_stage("error")
                        .with_payload("message", e.to_string()),
                );
                Err(e)?;
            }
        }

        // Storing the conversation here allows us to make subsequent requests.
        conversations::store(&agent.app.sql, conversation_id, (repo_ref, agent.exchanges.clone())).await?;
        agent.complete();
    };

    let init_stream = futures::stream::once(async move {
        Ok(sse::Event::default()
            .json_data(json!({
                "thread_id": params.thread_id.to_string(),
                "query_id": query_id
            }))
            // This should never happen, so we force an unwrap.
            .expect("failed to serialize initialization object"))
    });

    // We know the stream is unwind safe as it doesn't use synchronization primitives like locks.
    let answer_stream = AssertUnwindSafe(stream)
        .catch_unwind()
        .map(|res| res.unwrap_or_else(|_| Err(anyhow!("stream panicked"))))
        .map(|ex: Result<Exchange>| {
            sse::Event::default()
                .json_data(ex.map(Exchange::encode).map_err(|e| e.to_string()))
                .map_err(anyhow::Error::new)
        });

    let done_stream = futures::stream::once(async { Ok(sse::Event::default().data("[DONE]")) });

    let stream = init_stream.chain(answer_stream).chain(done_stream);

    Ok(Sse::new(Box::pin(stream)))
}

#[derive(Hash, PartialEq, Eq, Clone)]
pub struct ConversationId {
    thread_id: uuid::Uuid,
    user_id: String,
}

impl fmt::Display for ConversationId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}::{}", self.user_id, self.thread_id)
    }
}

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct CodeChunk {
    path: String,
    #[serde(rename = "alias")]
    alias: u32,
    #[serde(rename = "snippet")]
    snippet: String,
    #[serde(rename = "start")]
    start_line: u32,
    #[serde(rename = "end")]
    end_line: u32,
}

impl CodeChunk {
    /// Returns true if a code-chunk contains an empty snippet or a snippet with only whitespace
    fn is_empty(&self) -> bool {
        self.snippet.trim().is_empty()
    }
}

enum AgentError {
    Timeout(Duration),
    Processing(anyhow::Error),
}

struct Agent {
    app: Application,
    repo_ref: RepoRef,
    exchanges: Vec<Exchange>,
    exchange_tx: Sender<Exchange>,

    llm_gateway: llm_gateway::Client,
    user: User,
    thread_id: uuid::Uuid,
    query_id: uuid::Uuid,

    /// Indicate whether the request was answered.
    ///
    /// This is used in the `Drop` handler, in order to track cancelled answer queries.
    complete: bool,
}

/// We use a `Drop` implementation to track agent query cancellation.
///
/// Query control flow can be complex, as there are several points where an error may be returned
/// via `?`. Rather than dealing with this in a complex way, we can simply use `Drop` destructors
/// to send cancellation messages to our analytics provider.
///
/// By default, dropping an agent struct will send a cancellation message. However, calling
/// `.complete()` will "diffuse" tracking, and disable the cancellation message from sending on drop.
impl Drop for Agent {
    fn drop(&mut self) {
        if !self.complete {
            self.track_query(
                EventData::output_stage("cancelled")
                    .with_payload("message", "request was cancelled"),
            );
        }
    }
}

impl Agent {
    /// Mark this agent as "completed", preventing an analytics message from sending on drop.
    fn complete(&mut self) {
        self.complete = true;
    }

    /// Update the last exchange
    async fn update(&mut self, update: Update) -> Result<()> {
        self.last_exchange_mut().apply_update(update);

        // Immutable reborrow of `self`
        let self_ = &*self;
        self_
            .exchange_tx
            .send(self.last_exchange().clone())
            .await
            .map_err(|_| anyhow!("exchange_tx was closed"))
    }

    fn track_query(&self, data: EventData) {
        let event = QueryEvent {
            query_id: self.query_id,
            thread_id: self.thread_id,
            repo_ref: Some(self.repo_ref.clone()),
            data,
        };
        self.app.track_query(&self.user, &event);
    }

    fn last_exchange(&self) -> &Exchange {
        self.exchanges.last().expect("exchange list was empty")
    }

    fn last_exchange_mut(&mut self) -> &mut Exchange {
        self.exchanges.last_mut().expect("exchange list was empty")
    }

    fn code_chunks(&self) -> Vec<CodeChunk> {
        self.exchanges
            .iter()
            .flat_map(|e| e.code_chunks.iter().cloned())
            .collect::<Vec<_>>()
    }

    fn paths(&self) -> Vec<String> {
        self.exchanges
            .iter()
            .flat_map(|e| e.paths.iter().cloned())
            .collect::<Vec<_>>()
    }

    fn get_path_alias(&mut self, path: &str) -> usize {
        if let Some(i) = self.paths().iter().position(|p| *p == path) {
            i
        } else {
            let i = self.paths().len();
            self.last_exchange_mut().paths.push(path.to_owned());
            i
        }
    }

    async fn step(&mut self, action: Action) -> Result<Option<Action>> {
        debug!(?action, %self.thread_id, "executing next action");

        match &action {
            Action::Query(s) => {
                self.track_query(EventData::input_stage("query").with_payload("q", s));
                s.clone()
            }

            Action::Answer { paths, mode } => {
                match mode {
                    AnswerMode::Filesystem => self.answer_filesystem(paths).await?,
                    AnswerMode::Article => self.answer_article(paths).await?,
                }
                return Ok(None);
            }

            Action::Path { query } => self.path_search(query).await?,
            Action::Code { query } => self.code_search(query).await?,
            Action::Proc { query, paths } => self.process_files(query, paths).await?,
        };

        let functions = serde_json::from_value::<Vec<llm_gateway::api::Function>>(
            prompts::functions(!self.paths().is_empty()), // Only add proc if there are paths in context
        )
        .unwrap();

        let mut history = vec![llm_gateway::api::Message::system(&prompts::system(
            &self.paths(),
        ))];
        history.extend(self.history()?);

        let trimmed_history = trim_history(history.clone())?;

        let raw_response = self
            .llm_gateway
            .chat(&trim_history(history.clone())?, Some(&functions))
            .await?
            .try_fold(
                llm_gateway::api::FunctionCall::default(),
                |acc, e| async move {
                    let e: FunctionCall = serde_json::from_str(&e)?;
                    Ok(FunctionCall {
                        name: acc.name.or(e.name),
                        arguments: acc.arguments + &e.arguments,
                    })
                },
            )
            .await?;

        self.track_query(
            EventData::output_stage("llm_reply")
                .with_payload("full_history", &history)
                .with_payload("trimmed_history", &trimmed_history)
                .with_payload("last_message", history.last())
                .with_payload("functions", &functions)
                .with_payload("raw_response", &raw_response),
        );

        let action = Action::deserialize_gpt(&raw_response)?;
        Ok(Some(action))
    }

    async fn code_search(&mut self, query: &String) -> Result<String> {
        const CODE_SEARCH_LIMIT: u64 = 10;
        self.update(Update::StartStep(SearchStep::Code {
            call: query.clone(),
            response: String::new(),
        }))
        .await?;

        let mut results = self
            .semantic_search(query.into(), CODE_SEARCH_LIMIT, 0, true)
            .await?;

        let hyde_docs = self.hyde(query).await?;
        if !hyde_docs.is_empty() {
            let hyde_doc = hyde_docs.first().unwrap().into();
            let hyde_results = self
                .semantic_search(hyde_doc, CODE_SEARCH_LIMIT, 0, true)
                .await?;
            results.extend(hyde_results);
        }

        let chunks = results
            .into_iter()
            .map(|chunk| {
                let relative_path = chunk.relative_path;

                CodeChunk {
                    path: relative_path.clone(),
                    alias: self.get_path_alias(&relative_path) as u32,
                    snippet: chunk.text,
                    start_line: (chunk.start_line as u32).saturating_add(1),
                    end_line: (chunk.end_line as u32).saturating_add(1),
                }
            })
            .collect::<Vec<_>>();

        for chunk in chunks.iter().filter(|c| !c.is_empty()) {
            self.exchanges
                .last_mut()
                .unwrap()
                .code_chunks
                .push(chunk.clone())
        }

        let response = serde_json::to_string(&chunks).unwrap();

        self.update(Update::ReplaceStep(SearchStep::Code {
            call: query.clone(),
            response: response.clone(),
        }))
        .await?;

        self.track_query(
            EventData::input_stage("semantic code search")
                .with_payload("query", query)
                .with_payload("hyde_queries", &hyde_docs)
                .with_payload("chunks", &chunks)
                .with_payload("raw_prompt", &response),
        );

        Ok(response)
    }

    async fn path_search(&mut self, query: &String) -> Result<String> {
        self.update(Update::StartStep(SearchStep::Path {
            call: query.clone(),
            response: String::new(),
        }))
        .await?;

        // First, perform a lexical search for the path
        let mut paths = self
            .fuzzy_path_search(query)
            .await
            .map(|c| c.relative_path)
            .collect::<HashSet<_>>() // TODO: This shouldn't be necessary. Path search should return unique results.
            .into_iter()
            .collect::<Vec<_>>();

        let is_semantic = paths.is_empty();

        // If there are no lexical results, perform a semantic search.
        if paths.is_empty() {
            let semantic_paths = self
                .semantic_search(query.into(), 30, 0, true)
                .await?
                .into_iter()
                .map(|chunk| chunk.relative_path)
                .collect::<HashSet<_>>()
                .into_iter()
                .collect();

            paths = semantic_paths;
        }

        let formatted_paths = paths
            .iter()
            .map(|p| (p.to_string(), self.get_path_alias(p)))
            .collect::<Vec<_>>();

        let response = serde_json::to_string(&formatted_paths).unwrap();

        self.update(Update::ReplaceStep(SearchStep::Path {
            call: query.clone(),
            response: response.clone(),
        }))
        .await?;

        self.track_query(
            EventData::input_stage("path search")
                .with_payload("query", query)
                .with_payload("is_semantic", is_semantic)
                .with_payload("results", &paths)
                .with_payload("raw_prompt", &response),
        );

        Ok(response)
    }

    async fn process_files(&mut self, question: &str, path_aliases: &[usize]) -> Result<String> {
        const MAX_CHUNK_LINE_LENGTH: usize = 20;
        const CHUNK_MERGE_DISTANCE: usize = 10;
        const MAX_TOKENS: usize = 15400;

        let paths = path_aliases
            .iter()
            .copied()
            .map(|i| self.paths().get(i).ok_or(i).cloned())
            .collect::<Result<Vec<_>, _>>()
            .map_err(|i| anyhow!("invalid path alias {i}"))?;

        self.update(Update::StartStep(SearchStep::Proc {
            call: question.to_string(),
            steps: paths.clone(),
            response: String::new(),
        }))
        .await?;

        // Immutable reborrow of `self`, to copy freely to async closures.
        let self_ = &*self;
        let chunks = stream::iter(paths.clone())
            .map(|path| async move {
                tracing::debug!(?path, "reading file");

                let lines = self_
                    .get_file_content(&path)
                    .await?
                    .with_context(|| format!("path does not exist in the index: {path}"))?
                    .content
                    .lines()
                    .enumerate()
                    .map(|(i, line)| format!("{} {line}", i + 1))
                    .collect::<Vec<_>>();

                let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo")?;

                let iter =
                    tokio::task::spawn_blocking(|| trim_lines_by_tokens(lines, bpe, MAX_TOKENS))
                        .await
                        .context("failed to split by token")?;

                Result::<_>::Ok((iter, path.clone()))
            })
            // Buffer file loading to load multiple paths at once
            .buffered(10)
            .map(|result| async {
                let (lines, path) = result?;

                // The unwraps here should never fail, we generated this string above to always
                // have the same format.
                let start_line = lines[0]
                    .split_once(' ')
                    .unwrap()
                    .0
                    .parse::<usize>()
                    .unwrap();

                // We store the lines separately, so that we can reference them later to trim
                // this snippet by line number.
                let contents = lines.join("\n");
                let prompt = prompts::file_explanation(question, &path, &contents);

                debug!(?path, "calling chat API on file");

                let json = self_
                    .llm_gateway
                    .clone()
                    .model("gpt-3.5-turbo-16k-0613")
                    // Set low frequency penalty to discourage long outputs.
                    .frequency_penalty(0.1)
                    .chat(&[llm_gateway::api::Message::system(&prompt)], None)
                    .await?
                    .try_collect::<String>()
                    .await?;

                #[derive(
                    serde::Deserialize,
                    serde::Serialize,
                    PartialEq,
                    Eq,
                    PartialOrd,
                    Ord,
                    Copy,
                    Clone,
                    Debug,
                )]
                struct Range {
                    start: usize,
                    end: usize,
                }

                #[derive(serde::Serialize)]
                struct RelevantChunk {
                    #[serde(flatten)]
                    range: Range,
                    code: String,
                }

                impl RelevantChunk {
                    fn enumerate_lines(&self) -> Self {
                        Self {
                            range: self.range,
                            code: self
                                .code
                                .lines()
                                .enumerate()
                                .map(|(i, line)| format!("{} {line}", i + self.range.start))
                                .collect::<Vec<_>>()
                                .join("\n"),
                        }
                    }
                }

                let mut line_ranges: Vec<Range> = serde_json::from_str::<Vec<Range>>(&json)?
                    .into_iter()
                    .filter(|r| r.start > 0 && r.end > 0)
                    .map(|mut r| {
                        r.end = r.end.min(r.start + MAX_CHUNK_LINE_LENGTH); // Cap relevant chunk size by line number
                        r
                    })
                    .collect();

                line_ranges.sort();
                line_ranges.dedup();

                let relevant_chunks = line_ranges
                    .into_iter()
                    .fold(Vec::<Range>::new(), |mut exps, next| {
                        if let Some(prev) = exps.last_mut() {
                            if prev.end + CHUNK_MERGE_DISTANCE >= next.start {
                                prev.end = next.end;
                                return exps;
                            }
                        }

                        exps.push(next);
                        exps
                    })
                    .into_iter()
                    .filter_map(|range| {
                        Some(RelevantChunk {
                            range,
                            code: lines
                                .get(
                                    range.start.saturating_sub(start_line)
                                        ..range.end.saturating_sub(start_line),
                                )?
                                .iter()
                                .map(|line| line.split_once(' ').unwrap().1)
                                .collect::<Vec<_>>()
                                .join("\n"),
                        })
                    })
                    .collect::<Vec<_>>();

                Ok::<_, anyhow::Error>((relevant_chunks, path))
            });

        let processed = chunks
            // This box seems unnecessary, but it avoids a compiler bug:
            // https://github.com/rust-lang/rust/issues/64552
            .boxed()
            .buffered(5)
            .filter_map(|res| async { res.ok() })
            .collect::<Vec<_>>()
            .await;

        for (relevant_chunks, path) in &processed {
            let alias = self.get_path_alias(path) as u32;

            for c in relevant_chunks {
                let chunk = CodeChunk {
                    path: path.to_owned(),
                    alias,
                    snippet: c.code.clone(),
                    start_line: c.range.start as u32,
                    end_line: c.range.end as u32,
                };
                if !chunk.is_empty() {
                    self.last_exchange_mut().code_chunks.push(chunk);
                }
            }
        }

        let out = processed
            .into_iter()
            .map(|(relevant_chunks, path)| {
                serde_json::json!({
                    "relevant_chunks": relevant_chunks
                        .iter()
                        .map(|c| c.enumerate_lines())
                        .collect::<Vec<_>>(),
                    "path_alias": self.get_path_alias(&path),
                })
            })
            .collect::<Vec<_>>();

        let response = serde_json::to_string(&out)?;

        self.update(Update::ReplaceStep(SearchStep::Proc {
            call: question.to_string(),
            steps: paths,
            response: response.clone(),
        }))
        .await?;

        self.track_query(
            EventData::input_stage("process file")
                .with_payload("question", question)
                .with_payload("chunks", &out)
                .with_payload("raw_prompt", &response),
        );

        Ok(response)
    }

    async fn answer_context(&mut self, aliases: &[usize]) -> Result<String> {
        let paths = self.paths();
        let code_chunks = self.canonicalize_code_chunks().await;

        let mut s = "".to_owned();

        let mut path_aliases = aliases
            .iter()
            .copied()
            .filter(|alias| *alias < paths.len())
            .collect::<Vec<_>>();

        path_aliases.sort();
        path_aliases.dedup();

        if !paths.is_empty() {
            s += "##### PATHS #####\npath alias, path\n";

            if path_aliases.len() == 1 {
                // Only show matching path
                let alias = path_aliases[0];
                let path = paths[alias].clone();
                s += &format!("{alias}, {}\n", &path);
            } else {
                // Show all paths that have been seen
                for (alias, path) in paths.iter().enumerate() {
                    s += &format!("{alias}, {}\n", &path);
                }
            }
        }

        let code_chunks = if path_aliases.len() == 1 {
            let alias = path_aliases[0];
            let path = paths[alias].clone();
            let doc = self.get_file_content(&path).await?;

            match doc {
                Some(doc) => {
                    let bpe = tiktoken_rs::get_bpe_from_model("gpt-4")
                        .context("invalid model requested")?;

                    let trimmed_file_contents = limit_tokens(&doc.content, bpe, 4000);

                    vec![CodeChunk {
                        alias: alias as u32,
                        path,
                        start_line: 1,
                        end_line: trimmed_file_contents.lines().count() as u32 + 1,
                        snippet: trimmed_file_contents.to_owned(),
                    }]
                }
                None => {
                    warn!("only path alias did not return any results");
                    vec![]
                }
            }
        } else {
            code_chunks
                .iter()
                .filter(|c| path_aliases.contains(&(c.alias as usize)))
                .cloned()
                .collect()
        };

        const PROMPT_HEADROOM: usize = 1500;
        let bpe = tiktoken_rs::get_bpe_from_model("gpt-4")?;
        let mut remaining_prompt_tokens = tiktoken_rs::get_completion_max_tokens("gpt-4", &s)?;

        // Select as many recent chunks as possible
        let mut recent_chunks = Vec::new();
        for chunk in code_chunks.iter().rev() {
            let snippet = chunk
                .snippet
                .lines()
                .enumerate()
                .map(|(i, line)| format!("{} {line}\n", i + chunk.start_line as usize))
                .collect::<String>();

            let formatted_snippet = format!("### path alias: {} ###\n{snippet}\n\n", chunk.alias);

            let snippet_tokens = bpe.encode_ordinary(&formatted_snippet).len();

            if snippet_tokens >= remaining_prompt_tokens - PROMPT_HEADROOM {
                debug!("Breaking at {} tokens...", remaining_prompt_tokens);
                break;
            }

            recent_chunks.push((chunk.clone(), formatted_snippet));

            remaining_prompt_tokens -= snippet_tokens;
            debug!("{}", remaining_prompt_tokens);
        }

        // group recent chunks by path alias
        let mut recent_chunks_by_alias: HashMap<_, _> =
            recent_chunks
                .into_iter()
                .fold(HashMap::new(), |mut map, item| {
                    map.entry(item.0.alias).or_insert_with(Vec::new).push(item);
                    map
                });

        // write the header if we have atleast one chunk
        if !recent_chunks_by_alias.values().all(Vec::is_empty) {
            s += "\n##### CODE CHUNKS #####\n\n";
        }

        // sort by alias, then sort by lines
        let mut aliases = recent_chunks_by_alias.keys().copied().collect::<Vec<_>>();
        aliases.sort();

        for alias in aliases {
            let chunks = recent_chunks_by_alias.get_mut(&alias).unwrap();
            chunks.sort_by(|a, b| a.0.start_line.cmp(&b.0.start_line));
            for (_, formatted_snippet) in chunks {
                s += formatted_snippet;
            }
        }

        Ok(s)
    }

    async fn answer_article(&mut self, aliases: &[usize]) -> Result<()> {
        let context = self.answer_context(aliases).await?;
        let history = self.utter_history().collect::<Vec<_>>();

        let system_message = prompts::answer_article_prompt(&context);
        let messages = Some(llm_gateway::api::Message::system(&system_message))
            .into_iter()
            .chain(history.iter().cloned())
            .collect::<Vec<_>>();

        let mut stream = pin!(self.llm_gateway.chat(&messages, None).await?);
        let mut response = String::new();
        while let Some(fragment) = stream.next().await {
            let fragment = fragment?;
            response += &fragment;

            if let Some((article, summary)) = split_article_summary(&response) {
                self.update(Update::Article(article)).await?;
                self.update(Update::Conclude(summary)).await?;
            } else {
                self.update(Update::Article(response.clone())).await?;
            }
        }

        let summary = split_article_summary(&response)
            .map(|(_article, summary)| summary)
            .unwrap_or_else(|| {
                [
                    "I hope that was useful, can I help with anything else?",
                    "Is there anything else I can help you with?",
                    "Can I help you with anything else?",
                ]
                .choose(&mut OsRng)
                .copied()
                .unwrap()
                .to_owned()
            });

        self.update(Update::Conclude(summary)).await?;

        self.track_query(
            EventData::output_stage("answer_article")
                .with_payload("query", self.last_exchange().query())
                .with_payload("query_history", &history)
                .with_payload("response", &response)
                .with_payload("raw_prompt", &system_message),
        );

        Ok(())
    }

    async fn answer_filesystem(&mut self, aliases: &[usize]) -> Result<()> {
        let context = self.answer_context(aliases).await?;
        let mut query_history = self.utter_history().collect::<Vec<_>>();

        {
            let (role, content) = query_history
                .last_mut()
                .context("query history was empty")?
                .as_plaintext_mut()
                .context("last message was not plaintext")?;

            if role != "user" {
                bail!("last message was not a user message");
            }

            *content += "\n\nOutput only JSON.";
        }

        let system_message = prompts::answer_filesystem_prompt(&context);
        let messages = Some(llm_gateway::api::Message::system(&system_message))
            .into_iter()
            .chain(query_history.iter().cloned())
            .collect::<Vec<_>>();

        let mut stream = self.llm_gateway.chat(&messages, None).await?.boxed();
        let mut buffer = String::new();

        while let Some(token) = stream.next().await {
            buffer += &token?;

            if buffer.is_empty() {
                continue;
            }

            fn as_array(v: serde_json::Value) -> Option<Vec<serde_json::Value>> {
                match v {
                    serde_json::Value::Array(a) => Some(a),
                    _ => None,
                }
            }

            let (s, _) = partial_parse::rectify_json(&buffer);

            // this /should/ be infallible if rectify_json works
            let rectified_json: serde_json::Value =
                serde_json::from_str(&s).expect("failed to rectify_json");

            let json_array = as_array(rectified_json.clone()).ok_or_else(|| {
                anyhow!(
                    "failed to parse `answer` response, expected array but buffer was `{buffer}`"
                )
            })?;

            let array_of_arrays = json_array
                .clone()
                .into_iter()
                .map(as_array)
                .collect::<Option<Vec<Vec<_>>>>()
                .unwrap_or_else(|| vec![json_array]);

            let search_results = array_of_arrays
                .iter()
                .map(Vec::as_slice)
                .filter_map(|v| {
                    let item = exchange::FileResult::from_json_array(v);
                    if item.is_none() {
                        warn!("failed to build search result from: {v:?}");
                    }
                    item
                })
                .map(|s| s.substitute_path_alias(&self.paths()))
                .collect::<Vec<_>>();

            self.update(Update::Filesystem(search_results)).await?;
        }

        self.track_query(
            EventData::output_stage("answer_filesystem")
                .with_payload("query", self.last_exchange().query())
                .with_payload("query_history", &query_history)
                .with_payload("response", &buffer)
                .with_payload("system_message", &system_message),
        );

        Ok(())
    }

    /// The full history of messages, including intermediate function calls
    fn history(&self) -> Result<Vec<llm_gateway::api::Message>> {
        let history = self
            .exchanges
            .iter()
            .try_fold(Vec::new(), |mut acc, e| -> Result<_> {
                let query = e
                    .query()
                    .map(|q| {
                        llm_gateway::api::Message::user(&format!(
                            "{q}\nCall a function. Do not answer."
                        ))
                    })
                    .ok_or_else(|| anyhow!("query does not have target"))?;

                let steps = e.search_steps.iter().flat_map(|s| {
                    let (name, call, response) = match s {
                        SearchStep::Path { call, response } => ("path", call, response),
                        SearchStep::Code { call, response } => ("code", call, response),
                        SearchStep::Proc { call, response, .. } => ("proc", call, response),
                    };
                    vec![
                        llm_gateway::api::Message::function_call(&FunctionCall {
                            name: Some(name.into()),
                            arguments: call.into(),
                        }),
                        llm_gateway::api::Message::function_return(
                            name,
                            &format!("{response}\nCall a function. Do not answer."),
                        ),
                    ]
                });

                let answer = e
                    .answer_summarized()?
                    .map(|a| llm_gateway::api::Message::assistant(&a));

                acc.extend(
                    std::iter::once(query)
                        .chain(steps)
                        .chain(answer.into_iter()),
                );
                Ok(acc)
            })?;
        Ok(history)
    }

    /// History of `user`, `assistant` messages. These are the messages that are shown to the user.
    fn utter_history(&self) -> impl Iterator<Item = llm_gateway::api::Message> + '_ {
        const ANSWER_MAX_HISTORY_SIZE: usize = 5;

        self.exchanges
            .iter()
            .rev()
            .take(ANSWER_MAX_HISTORY_SIZE)
            .rev()
            .flat_map(|e| {
                let query = e.query().map(|q| llm_gateway::api::Message::PlainText {
                    role: "user".to_owned(),
                    content: q,
                });

                let conclusion = e.answer().map(|c| llm_gateway::api::Message::PlainText {
                    role: "assistant".to_owned(),
                    content: c.to_owned(),
                });

                query
                    .into_iter()
                    .chain(conclusion.into_iter())
                    .collect::<Vec<_>>()
            })
    }

    /// Merge overlapping and nearby code chunks
    async fn canonicalize_code_chunks(&self) -> Vec<CodeChunk> {
        let mut chunks_by_path = HashMap::<_, Vec<_>>::new();
        for c in mem::take(&mut self.code_chunks()) {
            chunks_by_path.entry(c.path.clone()).or_default().push(c);
        }

        futures::stream::iter(chunks_by_path)
            .then(|(path, mut chunks)| async move {
                chunks.sort_by_key(|c| c.start_line);
                let contents = self
                    .get_file_content(&path)
                    .await
                    .unwrap()
                    .unwrap_or_else(|| panic!("path did not exist in the index: {path}"))
                    .content;

                chunks
                    .into_iter()
                    .fold(Vec::<CodeChunk>::new(), |mut a, next| {
                        // There is some rightward drift here, which could be fixed once if-let
                        // chains are stabilized.
                        if let Some(prev) = a.last_mut() {
                            if let Some(next) = merge_overlapping(prev, next) {
                                if let Some(next) = merge_nearby(prev, next, &contents) {
                                    a.push(next);
                                }
                            }
                        } else {
                            a.push(next);
                        }

                        a
                    })
            })
            .flat_map(futures::stream::iter)
            .collect()
            .await
    }

    /// Hypothetical Document Embedding (HyDE): https://arxiv.org/abs/2212.10496
    ///
    /// This method generates synthetic documents based on the query. These are then
    /// parsed and code is extracted. This has been shown to improve semantic search recall.
    async fn hyde(&self, query: &str) -> Result<Vec<String>> {
        let prompt = vec![llm_gateway::api::Message::system(
            &prompts::hypothetical_document_prompt(query),
        )];

        tracing::trace!(?query, "generating hyde docs");

        let response = self
            .llm_gateway
            .clone()
            .model("gpt-3.5-turbo-0613")
            .chat(&prompt, None)
            .await?
            .try_collect::<String>()
            .await?;

        tracing::trace!("parsing hyde response");

        let documents = prompts::try_parse_hypothetical_documents(&response);

        for doc in documents.iter() {
            info!(?doc, "got hyde doc");
        }

        Ok(documents)
    }

    async fn semantic_search(
        &self,
        query: Literal<'_>,
        limit: u64,
        offset: u64,
        retrieve_more: bool,
    ) -> Result<Vec<semantic::Payload>> {
        let query = SemanticQuery {
            target: Some(query),
            repos: [Literal::Plain(self.repo_ref.display_name().into())].into(),
            ..self.last_exchange().query.clone()
        };

        debug!(?query, %self.thread_id, "executing semantic query");
        self.app
            .semantic
            .as_ref()
            .unwrap()
            .search(&query, limit, offset, retrieve_more)
            .await
    }

    #[allow(dead_code)]
    async fn batch_semantic_search(
        &self,
        queries: Vec<Literal<'_>>,
        limit: u64,
        offset: u64,
        retrieve_more: bool,
    ) -> Result<Vec<semantic::Payload>> {
        let queries = queries
            .iter()
            .map(|q| SemanticQuery {
                target: Some(q.clone()),
                repos: [Literal::Plain(self.repo_ref.display_name().into())].into(),
                ..self.last_exchange().query.clone()
            })
            .collect::<Vec<_>>();

        let queries = queries.iter().collect::<Vec<_>>();

        debug!(?queries, %self.thread_id, "executing semantic query");
        self.app
            .semantic
            .as_ref()
            .unwrap()
            .batch_search(queries.as_slice(), limit, offset, retrieve_more)
            .await
    }

    async fn get_file_content(&self, path: &str) -> Result<Option<ContentDocument>> {
        let branch = self.last_exchange().query.first_branch();

        debug!(%self.repo_ref, path, ?branch, %self.thread_id, "executing file search");
        self.app
            .indexes
            .file
            .by_path(&self.repo_ref, path, branch.as_deref())
            .await
            .with_context(|| format!("failed to read path: {}", path))
    }

    async fn fuzzy_path_search<'a>(
        &'a self,
        query: &str,
    ) -> impl Iterator<Item = FileDocument> + 'a {
        let branch = self.last_exchange().query.first_branch();

        debug!(%self.repo_ref, query, ?branch, %self.thread_id, "executing fuzzy search");
        self.app
            .indexes
            .file
            .fuzzy_path_match(&self.repo_ref, query, branch.as_deref(), 50)
            .await
    }
}

fn trim_history(
    mut history: Vec<llm_gateway::api::Message>,
) -> Result<Vec<llm_gateway::api::Message>> {
    const HEADROOM: usize = 2048;

    let mut tiktoken_msgs = history
        .iter()
        .map(|m| match m {
            llm_gateway::api::Message::PlainText { role, content } => {
                tiktoken_rs::ChatCompletionRequestMessage {
                    role: role.clone(),
                    content: content.clone(),
                    name: None,
                }
            }
            llm_gateway::api::Message::FunctionReturn {
                role,
                name,
                content,
            } => tiktoken_rs::ChatCompletionRequestMessage {
                role: role.clone(),
                content: content.clone(),
                name: Some(name.clone()),
            },
            llm_gateway::api::Message::FunctionCall {
                role,
                function_call,
                content: _,
            } => tiktoken_rs::ChatCompletionRequestMessage {
                role: role.clone(),
                content: serde_json::to_string(&function_call).unwrap(),
                name: None,
            },
        })
        .collect::<Vec<_>>();

    while tiktoken_rs::get_chat_completion_max_tokens("gpt-4", &tiktoken_msgs)? < HEADROOM {
        let idx = history
            .iter_mut()
            .position(|m| match m {
                llm_gateway::api::Message::PlainText {
                    role,
                    ref mut content,
                } if (role == "user" || role == "assistant") && content != "[HIDDEN]" => {
                    *content = "[HIDDEN]".into();
                    true
                }
                llm_gateway::api::Message::FunctionReturn {
                    role: _,
                    name: _,
                    ref mut content,
                } if content != "[HIDDEN]" => {
                    *content = "[HIDDEN]".into();
                    true
                }
                _ => false,
            })
            .ok_or_else(|| anyhow!("could not find message to trim"))?;

        tiktoken_msgs[idx].content = "[HIDDEN]".into();
    }

    Ok(history)
}

fn trim_lines_by_tokens(lines: Vec<String>, bpe: CoreBPE, max_tokens: usize) -> Vec<String> {
    let line_tokens = lines
        .iter()
        .map(|line| bpe.encode_ordinary(line).len())
        .collect::<Vec<_>>();

    let mut trimmed_lines = Vec::new();

    // Push lines to `trimmed_lines` until we reach the maximum number of tokens.
    let mut i = 0usize;
    let mut tokens = 0usize;
    while i < lines.len() && tokens < max_tokens {
        tokens += line_tokens[i];
        trimmed_lines.push(lines[i].clone());
        i += 1;
    }

    trimmed_lines
}

fn limit_tokens(text: &str, bpe: CoreBPE, max_tokens: usize) -> &str {
    let mut tokens = bpe.encode_ordinary(text);
    tokens.truncate(max_tokens);

    while !tokens.is_empty() {
        if let Ok(s) = bpe.decode(tokens.clone()) {
            return &text[..s.len()];
        }

        let _ = tokens.pop();
    }

    ""
}

/// Merge code chunks if they overlap.
///
/// This function assumes that the first paramter is a chunk which starts *before* the second
/// parameter starts.
fn merge_overlapping(a: &mut CodeChunk, b: CodeChunk) -> Option<CodeChunk> {
    if a.end_line >= b.start_line {
        // `b` might be contained in `a`, which allows us to discard it.
        if a.end_line < b.end_line {
            a.snippet += "\n";
            a.snippet += &b
                .snippet
                .lines()
                .skip((a.end_line - b.start_line) as usize)
                .collect::<Vec<_>>()
                .join("\n");

            a.end_line = b.end_line;
        }

        None
    } else {
        Some(b)
    }
}

/// Merge nearby code chunks if possible, returning the second code chunk if it is too far away.
///
/// This function assumes that the input chunks do not overlap, and that the first paramter is a
/// chunk which ends *before* the second parameter starts.
fn merge_nearby(a: &mut CodeChunk, b: CodeChunk, contents: &str) -> Option<CodeChunk> {
    const NEAR_THRESHOLD: u32 = 20;

    // This should never underflow, as we already merge overlapping chunks before getting
    // here.
    let missing = b.start_line - a.end_line;

    if missing > NEAR_THRESHOLD {
        return Some(b);
    }

    a.snippet += "\n";
    a.snippet += &contents
        .lines()
        .skip(a.end_line as usize - 1)
        .take(missing as usize)
        .collect::<Vec<_>>()
        .join("\n");
    a.snippet += "\n";
    a.snippet += &b.snippet;
    a.end_line = b.end_line;

    None
}

fn split_article_summary(response: &str) -> Option<(String, String)> {
    // The `comrak` crate has a very unusual API which makes this logic difficult to follow. It
    // favours arena allocation instead of a tree-based AST, and requires `Write`rs to regenerate
    // markdown output.
    //
    // There are quirks to the parsing logic, comments have been added for clarity.

    let arena = comrak::Arena::new();
    let mut options = comrak::ComrakOptions::default();
    options.extension.footnotes = true;

    // We don't have an easy built-in way to generate a string with `comrak`, so we encapsulate
    // that logic here.
    let comrak_to_string = |node| {
        let mut out = Vec::<u8>::new();
        comrak::format_commonmark(node, &options, &mut out).unwrap();
        String::from_utf8_lossy(&out).trim().to_owned()
    };

    // `comrak` will not recognize footnote definitions unless they have been referenced at least
    // once. To ensure our potential summary appears in the parse tree, we prepend the entire
    // response with a sentinel reference to the footnote. After parsing, we look for that
    // footnote and immediately remove (detach) it from the root node. This ensures that our
    // artifical reference does not appear in the output.

    let document = format!("[^summary]\n\n{response}");
    let root = comrak::parse_document(&arena, &document, &options);
    let mut children = root.children();
    // Detach the sentinel footnote reference.
    children.next().unwrap().detach();

    for child in children {
        match &child.data.borrow().value {
            comrak::nodes::NodeValue::FootnoteDefinition(def) if def.name == "summary" => (),
            _ => continue,
        };

        let first_child = child.children().next()?;
        if let comrak::nodes::NodeValue::Paragraph = &first_child.data.borrow().value {
            // We detach the summary from the main text, so that it does not end up in the final
            // article output.
            child.detach();
            return Some((comrak_to_string(root), comrak_to_string(first_child)));
        }
    }

    None
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
enum Action {
    /// A user-provided query.
    Query(String),

    Path {
        query: String,
    },
    #[serde(rename = "none")]
    Answer {
        mode: AnswerMode,
        paths: Vec<usize>,
    },
    Code {
        query: String,
    },
    Proc {
        query: String,
        paths: Vec<usize>,
    },
}

impl Action {
    /// Deserialize this action from the GPT-tagged enum variant format.
    ///
    /// We convert (2 examples):
    ///
    /// ```text
    /// {"name": "Variant1", "args": {}}
    /// {"name": "Variant2", "args": {"a":123}}
    /// ```
    ///
    /// To:
    ///
    /// ```text
    /// {"Variant1": {}}
    /// {"Variant2": {"a":123}}
    /// ```
    ///
    /// So that we can deserialize using the serde-provided "tagged" enum representation.
    fn deserialize_gpt(call: &FunctionCall) -> Result<Self> {
        let mut map = serde_json::Map::new();
        map.insert(
            call.name.clone().unwrap(),
            serde_json::from_str(&call.arguments)?,
        );

        Ok(serde_json::from_value(serde_json::Value::Object(map))?)
    }
}

#[derive(Debug, Default, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AnswerMode {
    Article,
    #[default]
    Filesystem,
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;

    #[test]
    fn test_trimming() {
        let long_string = "long string ".repeat(2000);
        let history = vec![
            llm_gateway::api::Message::system("foo"),
            llm_gateway::api::Message::user("bar"),
            llm_gateway::api::Message::assistant("baz"),
            llm_gateway::api::Message::user(&long_string),
            llm_gateway::api::Message::assistant("quux"),
            llm_gateway::api::Message::user("fred"),
            llm_gateway::api::Message::assistant("thud"),
            llm_gateway::api::Message::user(&long_string),
            llm_gateway::api::Message::user("corge"),
        ];

        assert_eq!(
            trim_history(history).unwrap(),
            vec![
                llm_gateway::api::Message::system("foo"),
                llm_gateway::api::Message::user("[HIDDEN]"),
                llm_gateway::api::Message::assistant("[HIDDEN]"),
                llm_gateway::api::Message::user("[HIDDEN]"),
                llm_gateway::api::Message::assistant("quux"),
                llm_gateway::api::Message::user("fred"),
                llm_gateway::api::Message::assistant("thud"),
                llm_gateway::api::Message::user(&long_string),
                llm_gateway::api::Message::user("corge"),
            ]
        );
    }

    #[test]
    fn test_trim_lines_by_tokens() {
        let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo").unwrap();

        let lines = vec![
            "fn main() {".to_string(),
            "    one();".to_string(),
            "    two();".to_string(),
            "    three();".to_string(),
            "    four();".to_string(),
            "    five();".to_string(),
            "    six();".to_string(),
            "}".to_string(),
        ];
        assert_eq!(
            trim_lines_by_tokens(lines, bpe.clone(), 15),
            vec![
                "fn main() {".to_string(),
                "    one();".to_string(),
                "    two();".to_string(),
                "    three();".to_string(),
                "    four();".to_string()
            ]
        );

        let lines = vec!["fn main() {".to_string(), "    one();".to_string()];
        assert_eq!(
            trim_lines_by_tokens(lines, bpe.clone(), 15),
            vec!["fn main() {".to_string(), "    one();".to_string()]
        );

        let expected: Vec<String> = vec![];
        assert_eq!(trim_lines_by_tokens(vec![], bpe, 15), expected);
    }

    #[test]
    fn test_limit_tokens() {
        let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo").unwrap();
        assert_eq!(limit_tokens("fn 🚨() {}", bpe.clone(), 1), "fn");

        // Note: the following calls return a string that does not split the emoji, despite the
        // tokenizer interpreting the tokens like that.
        assert_eq!(limit_tokens("fn 🚨() {}", bpe.clone(), 2), "fn");
        assert_eq!(limit_tokens("fn 🚨() {}", bpe.clone(), 3), "fn");

        // Now we have a sufficient number of input tokens to overcome the emoji.
        assert_eq!(limit_tokens("fn 🚨() {}", bpe.clone(), 4), "fn 🚨");
        assert_eq!(limit_tokens("fn 🚨() {}", bpe.clone(), 5), "fn 🚨()");
        assert_eq!(limit_tokens("fn 🚨() {}", bpe, 6), "fn 🚨() {}");
    }

    #[test]
    fn test_merge_overlapping_no_overlap() {
        let _code = vec![
            "/// Non recursive function.",
            "///",
            "/// `n` the rank used to compute the member of the sequence.",
            "pub fn fibonacci(n: i32) -> u64 {",
            "    if n < 0 {",
            "        panic!(\"{} is negative!\", n);",
            "    } else if n == 0 {",
            "        panic!(\"zero is not a right argument to fibonacci()!\");",
            "    } else if n == 1 {",
            "        return 1;",
            "    }",
            "",
            "    let mut sum = 0;",
            "    let mut last = 0;",
            "    let mut curr = 1;",
            "    for _i in 1..n {",
            "        sum = last + curr;",
            "        last = curr;",
            "        curr = sum;",
            "    }",
            "    sum",
            "}",
        ]
        .join("\n");

        let a = CodeChunk {
            path: "fib.rs".into(),
            alias: 0,
            snippet: vec![
                "pub fn fibonacci(n: i32) -> u64 {",
                "    if n < 0 {",
                "        panic!(\"{} is negative!\", n);",
                "    } else if n == 0 {",
                "        panic!(\"zero is not a right argument to fibonacci()!\");",
                "    } else if n == 1 {",
                "        return 1;",
                "    }",
            ]
            .join("\n"),
            start_line: 4,
            end_line: 12,
        };

        let b = CodeChunk {
            path: "foo.rs".into(),
            alias: 0,
            snippet: vec![
                "    let mut sum = 0;",
                "    let mut last = 0;",
                "    let mut curr = 1;",
                "    for _i in 1..n {",
                "        sum = last + curr;",
                "        last = curr;",
                "        curr = sum;",
                "    }",
            ]
            .join("\n"),

            start_line: 13,
            end_line: 21,
        };

        let mut a2 = a.clone();
        assert_eq!(Some(b.clone()), merge_overlapping(&mut a2, b));
        assert_eq!(a2, a);
    }

    #[test]
    fn test_merge_overlapping_consecutive() {
        let _code = vec![
            "/// Non recursive function.",
            "///",
            "/// `n` the rank used to compute the member of the sequence.",
            "pub fn fibonacci(n: i32) -> u64 {",
            "    if n < 0 {",
            "        panic!(\"{} is negative!\", n);",
            "    } else if n == 0 {",
            "        panic!(\"zero is not a right argument to fibonacci()!\");",
            "    } else if n == 1 {",
            "        return 1;",
            "    }",
            "",
            "    let mut sum = 0;",
            "    let mut last = 0;",
            "    let mut curr = 1;",
            "    for _i in 1..n {",
            "        sum = last + curr;",
            "        last = curr;",
            "        curr = sum;",
            "    }",
            "    sum",
            "}",
        ]
        .join("\n");

        let mut a = CodeChunk {
            path: "fib.rs".into(),
            alias: 0,
            snippet: vec![
                "pub fn fibonacci(n: i32) -> u64 {",
                "    if n < 0 {",
                "        panic!(\"{} is negative!\", n);",
                "    } else if n == 0 {",
                "        panic!(\"zero is not a right argument to fibonacci()!\");",
                "    } else if n == 1 {",
                "        return 1;",
                "    }",
            ]
            .join("\n"),
            start_line: 4,
            end_line: 12,
        };

        let b = CodeChunk {
            path: "foo.rs".into(),
            alias: 0,
            snippet: vec![
                "",
                "    let mut sum = 0;",
                "    let mut last = 0;",
                "    let mut curr = 1;",
                "    for _i in 1..n {",
                "        sum = last + curr;",
                "        last = curr;",
                "        curr = sum;",
                "    }",
            ]
            .join("\n"),

            start_line: 12,
            end_line: 21,
        };

        assert_eq!(None, merge_overlapping(&mut a, b.clone()));
        assert_eq!(a.end_line, b.end_line);

        assert_eq!(
            a.snippet,
            vec![
                "pub fn fibonacci(n: i32) -> u64 {",
                "    if n < 0 {",
                "        panic!(\"{} is negative!\", n);",
                "    } else if n == 0 {",
                "        panic!(\"zero is not a right argument to fibonacci()!\");",
                "    } else if n == 1 {",
                "        return 1;",
                "    }",
                "",
                "    let mut sum = 0;",
                "    let mut last = 0;",
                "    let mut curr = 1;",
                "    for _i in 1..n {",
                "        sum = last + curr;",
                "        last = curr;",
                "        curr = sum;",
                "    }",
            ]
            .join("\n")
        );
    }

    #[test]
    fn test_merge_overlapping_overlap() {
        let _code = vec![
            "/// Non recursive function.",
            "///",
            "/// `n` the rank used to compute the member of the sequence.",
            "pub fn fibonacci(n: i32) -> u64 {",
            "    if n < 0 {",
            "        panic!(\"{} is negative!\", n);",
            "    } else if n == 0 {",
            "        panic!(\"zero is not a right argument to fibonacci()!\");",
            "    } else if n == 1 {",
            "        return 1;",
            "    }",
            "",
            "    let mut sum = 0;",
            "    let mut last = 0;",
            "    let mut curr = 1;",
            "    for _i in 1..n {",
            "        sum = last + curr;",
            "        last = curr;",
            "        curr = sum;",
            "    }",
            "    sum",
            "}",
        ]
        .join("\n");

        let mut a = CodeChunk {
            path: "fib.rs".into(),
            alias: 0,
            snippet: vec![
                "pub fn fibonacci(n: i32) -> u64 {",
                "    if n < 0 {",
                "        panic!(\"{} is negative!\", n);",
                "    } else if n == 0 {",
                "        panic!(\"zero is not a right argument to fibonacci()!\");",
                "    } else if n == 1 {",
                "        return 1;",
                "    }",
            ]
            .join("\n"),
            start_line: 4,
            end_line: 12,
        };

        let b = CodeChunk {
            path: "foo.rs".into(),
            alias: 0,
            snippet: vec![
                "    } else if n == 1 {",
                "        return 1;",
                "    }",
                "",
                "    let mut sum = 0;",
                "    let mut last = 0;",
                "    let mut curr = 1;",
                "    for _i in 1..n {",
                "        sum = last + curr;",
                "        last = curr;",
                "        curr = sum;",
                "    }",
            ]
            .join("\n"),

            start_line: 9,
            end_line: 21,
        };

        assert_eq!(None, merge_overlapping(&mut a, b.clone()));
        assert_eq!(a.end_line, b.end_line);

        assert_eq!(
            a.snippet,
            vec![
                "pub fn fibonacci(n: i32) -> u64 {",
                "    if n < 0 {",
                "        panic!(\"{} is negative!\", n);",
                "    } else if n == 0 {",
                "        panic!(\"zero is not a right argument to fibonacci()!\");",
                "    } else if n == 1 {",
                "        return 1;",
                "    }",
                "",
                "    let mut sum = 0;",
                "    let mut last = 0;",
                "    let mut curr = 1;",
                "    for _i in 1..n {",
                "        sum = last + curr;",
                "        last = curr;",
                "        curr = sum;",
                "    }",
            ]
            .join("\n")
        );
    }

    #[test]
    fn test_merge_overlapping_subset() {
        let _code = vec![
            "/// Non recursive function.",
            "///",
            "/// `n` the rank used to compute the member of the sequence.",
            "pub fn fibonacci(n: i32) -> u64 {",
            "    if n < 0 {",
            "        panic!(\"{} is negative!\", n);",
            "    } else if n == 0 {",
            "        panic!(\"zero is not a right argument to fibonacci()!\");",
            "    } else if n == 1 {",
            "        return 1;",
            "    }",
            "",
            "    let mut sum = 0;",
            "    let mut last = 0;",
            "    let mut curr = 1;",
            "    for _i in 1..n {",
            "        sum = last + curr;",
            "        last = curr;",
            "        curr = sum;",
            "    }",
            "    sum",
            "}",
        ]
        .join("\n");

        let mut a = CodeChunk {
            path: "fib.rs".into(),
            alias: 0,
            snippet: vec![
                "pub fn fibonacci(n: i32) -> u64 {",
                "    if n < 0 {",
                "        panic!(\"{} is negative!\", n);",
                "    } else if n == 0 {",
                "        panic!(\"zero is not a right argument to fibonacci()!\");",
                "    } else if n == 1 {",
                "        return 1;",
                "    }",
            ]
            .join("\n"),
            start_line: 4,
            end_line: 12,
        };

        let b = CodeChunk {
            path: "foo.rs".into(),
            alias: 0,
            snippet: vec![
                "        panic!(\"{} is negative!\", n);",
                "    } else if n == 0 {",
                "        panic!(\"zero is not a right argument to fibonacci()!\");",
            ]
            .join("\n"),
            start_line: 6,
            end_line: 9,
        };

        assert_eq!(None, merge_overlapping(&mut a, b));
        assert_eq!(a.start_line, 4);
        assert_eq!(a.end_line, 12);

        assert_eq!(
            a.snippet,
            vec![
                "pub fn fibonacci(n: i32) -> u64 {",
                "    if n < 0 {",
                "        panic!(\"{} is negative!\", n);",
                "    } else if n == 0 {",
                "        panic!(\"zero is not a right argument to fibonacci()!\");",
                "    } else if n == 1 {",
                "        return 1;",
                "    }",
            ]
            .join("\n")
        );
    }

    #[test]
    fn test_merge_nearby() {
        {
            let mut a = CodeChunk {
                path: "foo.txt".into(),
                alias: 0,
                snippet: "fn main() {".into(),
                start_line: 1,
                end_line: 2,
            };

            let b = CodeChunk {
                path: "foo.txt".into(),
                alias: 0,
                snippet: "}".into(),
                start_line: 3,
                end_line: 4,
            };

            let contents = "fn main() {\nprintln!(\"hello world\");\n}\n";

            assert_eq!(None, merge_nearby(&mut a, b.clone(), contents));
            assert_eq!(a.end_line, b.end_line);
            assert_eq!(a.snippet, contents.trim());
        }

        {
            let code = vec![
                "/// Non recursive function.",
                "///",
                "/// `n` the rank used to compute the member of the sequence.",
                "pub fn fibonacci(n: i32) -> u64 {",
                "    if n < 0 {",
                "        panic!(\"{} is negative!\", n);",
                "    } else if n == 0 {",
                "        panic!(\"zero is not a right argument to fibonacci()!\");",
                "    } else if n == 1 {",
                "        return 1;",
                "    }",
                "",
                "    let mut sum = 0;",
                "    let mut last = 0;",
                "    let mut curr = 1;",
                "    for _i in 1..n {",
                "        sum = last + curr;",
                "        last = curr;",
                "        curr = sum;",
                "    }",
                "    sum",
                "}",
            ]
            .join("\n");

            let mut a = CodeChunk {
                path: "fib.rs".into(),
                alias: 0,
                snippet: vec![
                    "pub fn fibonacci(n: i32) -> u64 {",
                    "    if n < 0 {",
                    "        panic!(\"{} is negative!\", n);",
                    "    } else if n == 0 {",
                    "        panic!(\"zero is not a right argument to fibonacci()!\");",
                    "    } else if n == 1 {",
                    "        return 1;",
                    "    }",
                ]
                .join("\n"),
                start_line: 4,
                end_line: 12,
            };

            let b = CodeChunk {
                path: "foo.rs".into(),
                alias: 0,
                snippet: vec![
                    "    for _i in 1..n {",
                    "        sum = last + curr;",
                    "        last = curr;",
                    "        curr = sum;",
                    "    }",
                ]
                .join("\n"),

                start_line: 16,
                end_line: 21,
            };

            assert_eq!(None, merge_nearby(&mut a, b.clone(), &code));
            assert_eq!(a.end_line, b.end_line);

            assert_eq!(
                a.snippet,
                vec![
                    "pub fn fibonacci(n: i32) -> u64 {",
                    "    if n < 0 {",
                    "        panic!(\"{} is negative!\", n);",
                    "    } else if n == 0 {",
                    "        panic!(\"zero is not a right argument to fibonacci()!\");",
                    "    } else if n == 1 {",
                    "        return 1;",
                    "    }",
                    "",
                    "    let mut sum = 0;",
                    "    let mut last = 0;",
                    "    let mut curr = 1;",
                    "    for _i in 1..n {",
                    "        sum = last + curr;",
                    "        last = curr;",
                    "        curr = sum;",
                    "    }",
                ]
                .join("\n")
            );
        }
    }

    #[test]
    fn test_split_article_summary() {
        let (body, summary) = split_article_summary(
            r#"Hello world

[^summary]: This is an example summary, with **bold text**."#,
        )
        .unwrap();

        assert_eq!(body, "Hello world");
        assert_eq!(summary, "This is an example summary, with **bold text**.");

        let (body, summary) = split_article_summary(
            r#"Hello world.

Goodbye world.

Hello again, world.

[^summary]: This is an example summary, with **bold text**."#,
        )
        .unwrap();

        assert_eq!(
            body,
            "Hello world.\n\nGoodbye world.\n\nHello again, world."
        );
        assert_eq!(summary, "This is an example summary, with **bold text**.");
    }
}
