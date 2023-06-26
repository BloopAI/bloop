use std::{
    borrow::Cow,
    collections::{HashMap, HashSet, VecDeque},
    mem,
    panic::AssertUnwindSafe,
    path::{Component, PathBuf},
    str::FromStr,
    time::Duration,
};

use anyhow::{anyhow, Context, Result};
use axum::{
    extract::Query,
    response::{
        sse::{self, Sse},
        IntoResponse,
    },
    Extension,
};
use futures::{future::Either, stream, StreamExt, TryStreamExt};
use reqwest::StatusCode;
use secrecy::ExposeSecret;
use tiktoken_rs::CoreBPE;
use tokio::sync::mpsc::Sender;
use tracing::{debug, info, trace, warn};

use super::middleware::User;
use crate::{
    analytics::{EventData, QueryEvent},
    db::SqlDb,
    query::parser::{self, SemanticQuery},
    repo::RepoRef,
    webserver::answer::llm_gateway::api::FunctionCall,
    Application,
};

pub mod conversations;
mod llm_gateway;
mod partial_parse;
mod prompts;
mod response;

use response::{Exchange, SearchResult, SearchStep, Update};

const TIMEOUT_SECS: u64 = 60;

#[derive(Clone, Debug, serde::Deserialize)]
pub struct Params {
    pub q: String,
    pub repo_ref: RepoRef,
    #[serde(default = "default_thread_id")]
    pub thread_id: uuid::Uuid,
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
    let conversation_id = ConversationId {
        user_id: user
            .login()
            .ok_or_else(|| super::Error::user("didn't have user ID"))?
            .to_string(),
        thread_id: params.thread_id,
    };

    let mut conversation = Conversation::load(&app.sql, &conversation_id)
        .await?
        .unwrap_or_else(|| Conversation::new(params.repo_ref.clone()));

    let mut ctx = AppContext::new(app, user)
        .map_err(|e| super::Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .with_query_id(query_id)
        .with_thread_id(params.thread_id)
        .with_repo_ref(params.repo_ref.clone());

    // confirm client compatibility with answer-api
    match ctx
        .llm_gateway
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

    let q = params.q;

    let stream = async_stream::try_stream! {
        let mut action = Action::Query(q);

        conversation.exchanges.push(Exchange::default());

        loop {
            // The main loop. Here, we create two streams that operate simultaneously; the update
            // stream, which sends updates back to the HTTP event stream response, and the action
            // stream, which returns a single item when there is a new action available to execute.
            // Both of these operate together, and we repeat the process for every new action.

            use futures::future::FutureExt;

            let (update_tx, update_rx) = tokio::sync::mpsc::channel(10);

            let left_stream = tokio_stream::wrappers::ReceiverStream::new(update_rx)
                .map(Either::Left);

            let right_stream = conversation
                .step(&ctx, action, update_tx)
                .into_stream()
                .map(Either::Right);

            let mut next = None;
            for await item in tokio_stream::StreamExt::timeout(
                stream::select(left_stream, right_stream),
                Duration::from_secs(TIMEOUT_SECS),
            ) {
                match item {
                    Ok(Either::Left(exchange)) => yield exchange,
                    Ok(Either::Right(next_action)) => match next_action {
                        Ok(n) => next = n,
                        err => {
                            ctx.track_query(
                                EventData::output_stage("error")
                                    .with_payload("message", err.as_ref().unwrap_err().to_string()),
                            );
                            err?;
                        }
                    },
                    Err(_) => {
                        warn!("Timeout reached.");
                        ctx.track_query(
                            EventData::output_stage("error")
                                .with_payload("timeout", TIMEOUT_SECS),
                        );
                        Err(anyhow!("reached timeout of {TIMEOUT_SECS}s"))?
                    }
                }
            }

            match next {
                Some(a) => action = a,
                None => break,
            }
        }

        // Storing the conversation here allows us to make subsequent requests.
        conversation.store(&ctx.app.sql, conversation_id).await?;

        ctx.req_complete = true;
    };

    let thread_stream = futures::stream::once(async move {
        Ok(sse::Event::default().data(params.thread_id.to_string()))
    });

    // We know the stream is unwind safe as it doesn't use synchronization primitives like locks.
    let answer_stream = AssertUnwindSafe(stream)
        .catch_unwind()
        .map(|res| res.unwrap_or_else(|_| Err(anyhow!("stream panicked"))))
        .map(|upd: Result<Exchange>| {
            sse::Event::default()
                .json_data(upd.map_err(|e| e.to_string()))
                .map_err(anyhow::Error::new)
        });

    let done_stream = futures::stream::once(async { Ok(sse::Event::default().data("[DONE]")) });

    let stream = thread_stream.chain(answer_stream).chain(done_stream);

    Ok(Sse::new(Box::pin(stream)))
}

#[derive(Hash, PartialEq, Eq, Clone)]
pub(super) struct ConversationId {
    thread_id: uuid::Uuid,
    user_id: String,
}

#[derive(Clone, Debug)]
pub(super) struct Conversation {
    llm_history: VecDeque<llm_gateway::api::Message>,
    exchanges: Vec<Exchange>,
    paths: Vec<String>,
    code_chunks: Vec<CodeChunk>,
    repo_ref: RepoRef,
}

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
struct CodeChunk {
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

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
struct SeenPath {
    path: String,
    alias: u32,
}

impl Conversation {
    fn new(repo_ref: RepoRef) -> Self {
        // We start of with a conversation describing the operations that the LLM can perform, and
        // an initial (hidden) prompt that we pose to the user.

        Self {
            llm_history: vec![llm_gateway::api::Message::system(&prompts::system(
                &Vec::new(),
            ))]
            .into(),
            exchanges: Vec::new(),
            paths: Vec::new(),
            code_chunks: Vec::new(),
            repo_ref,
        }
    }

    fn path_alias(&mut self, path: &str) -> usize {
        if let Some(i) = self.paths.iter().position(|p| *p == path) {
            i
        } else {
            let i = self.paths.len();
            self.paths.push(path.to_owned());
            i
        }
    }

    fn query_history(&self) -> impl Iterator<Item = llm_gateway::api::Message> {
        self.exchanges
            .iter()
            .flat_map(|e| match (e.query(), e.conclusion()) {
                (Some(q), Some(c)) => vec![("user", q), ("assistant", c)],
                (Some(q), None) => vec![("user", q)],
                _ => vec![],
            })
            .map(|(author, message)| format!("{author}: {message}"))
    }

    // Generate a summary of the last exchange
    fn get_summarized_answer(&self) -> Option<String> {
        self.exchanges
            .len()
            .checked_sub(2)
            .and_then(|second_last| self.exchanges.get(second_last))
            .and_then(|exchange| exchange.summarize())
    }

    async fn step(
        &mut self,
        ctx: &AppContext,
        action: Action,
        exchange_tx: Sender<Exchange>,
    ) -> Result<Option<Action>> {
        let action_result = match &action {
            Action::Query(s) => {
                exchange_tx
                    .send(self.update(Update::Step(SearchStep::Query(s.clone()))))
                    .await?;

                let summarized_answer = self.get_summarized_answer();
                match summarized_answer.as_ref() {
                    Some(summary) => {
                        info!("attaching summary of previous exchange: {summary}");
                        self.llm_history
                            .push_back(llm_gateway::api::Message::assistant(summary));
                    }
                    None => {
                        info!("no previous exchanges, skipping summary");
                    }
                }

                ctx.track_query(
                    EventData::input_stage("query")
                        .with_payload("q", s)
                        .with_payload("previous_answer_summary", &summarized_answer),
                );

                s.clone()
            }

            Action::Answer { paths } => {
                self.answer(ctx, exchange_tx, paths).await?;
                return Ok(None);
            }

            Action::Path { query } => {
                exchange_tx
                    .send(self.update(Update::Step(SearchStep::Path(query.clone()))))
                    .await?;

                // First, perform a lexical search for the path
                let mut paths = ctx
                    .app
                    .indexes
                    .file
                    .fuzzy_path_match(&self.repo_ref, query, /* limit */ 50)
                    .await
                    .map(|c| c.relative_path)
                    .collect::<HashSet<_>>() // TODO: This shouldn't be necessary. Path search should return unique results.
                    .into_iter()
                    .collect::<Vec<_>>();

                let is_semantic = paths.is_empty();

                // If there are no lexical results, perform a semantic search.
                if paths.is_empty() {
                    // TODO: Semantic search should accept unparsed queries
                    let nl_query = SemanticQuery {
                        target: Some(parser::Literal::Plain(Cow::Owned(query.clone()))),
                        repos: [parser::Literal::Plain(Cow::Owned(
                            self.repo_ref.display_name(),
                        ))]
                        .into(),
                        ..Default::default()
                    };

                    let semantic_paths = ctx
                        .app
                        .semantic
                        .as_ref()
                        .context("semantic search is not enabled")?
                        .search(&nl_query, 30, 0, true)
                        .await?
                        .into_iter()
                        .map(|chunk| chunk.relative_path.into_owned())
                        .collect::<HashSet<_>>()
                        .into_iter()
                        .collect();

                    paths = semantic_paths;
                }

                let prompt = Some("§alias, path".to_owned())
                    .into_iter()
                    .chain(paths.iter().map(|p| format!("{}, {p}", self.path_alias(p))))
                    .collect::<Vec<_>>()
                    .join("\n");

                ctx.track_query(
                    EventData::input_stage("path search")
                        .with_payload("query", query)
                        .with_payload("is_semantic", is_semantic)
                        .with_payload("results", &paths)
                        .with_payload("raw_prompt", prompt),
                );

                let formatted_paths = paths
                    .iter()
                    .map(|p| SeenPath {
                        path: p.to_string(),
                        alias: self.path_alias(p) as u32,
                    })
                    .collect::<Vec<_>>();

                serde_json::to_string(&formatted_paths).unwrap()
            }

            Action::Code { query } => {
                // Semantic search.

                exchange_tx
                    .send(self.update(Update::Step(SearchStep::Code(query.clone()))))
                    .await?;

                let nl_query = SemanticQuery {
                    target: Some(parser::Literal::Plain(Cow::Owned(query.clone()))),
                    repos: [parser::Literal::Plain(Cow::Owned(
                        self.repo_ref.display_name(),
                    ))]
                    .into(),
                    ..Default::default()
                };

                let chunks = ctx
                    .app
                    .semantic
                    .as_ref()
                    .context("semantic search is not enabled")?
                    .search(&nl_query, 10, 0, true)
                    .await?
                    .into_iter()
                    .map(|chunk| {
                        let relative_path = chunk.relative_path;

                        CodeChunk {
                            path: relative_path.clone().into_owned(),
                            alias: self.path_alias(&relative_path) as u32,
                            snippet: chunk.text.into_owned(),
                            start_line: (chunk.start_line as u32).saturating_add(1),
                            end_line: (chunk.end_line as u32).saturating_add(1),
                        }
                    })
                    .collect::<Vec<_>>();

                for chunk in chunks.iter().filter(|c| !c.is_empty()) {
                    self.code_chunks.push(chunk.clone());
                }

                let prompt = serde_json::to_string(&chunks).unwrap();

                ctx.track_query(
                    EventData::input_stage("semantic code search")
                        .with_payload("query", query)
                        .with_payload("chunks", &chunks)
                        .with_payload("raw_prompt", &prompt),
                );

                prompt
            }

            Action::Proc { query, paths } => self.proc(ctx, exchange_tx, query, paths).await?,
        };

        match &action {
            Action::Query(query) => {
                self.llm_history
                    .push_back(llm_gateway::api::Message::user(&format!(
                        "{query}\nCall a function. Do not answer."
                    )))
            }
            _ => {
                let function_name = match &action {
                    Action::Answer { .. } => "none",
                    Action::Path { .. } => "path",
                    Action::Code { .. } => "code",
                    Action::Proc { .. } => "proc",
                    Action::Query(_) => unreachable!(),
                };
                self.llm_history
                    .push_back(llm_gateway::api::Message::function_return(
                        function_name,
                        &format!("{action_result}\nCall a function. Do not answer."),
                    ));
            }
        };

        let updated_system_prompt =
            llm_gateway::api::Message::system(&prompts::system(&self.paths));
        _ = self.llm_history.pop_front();
        self.llm_history.push_front(updated_system_prompt);

        let functions =
            serde_json::from_value::<Vec<llm_gateway::api::Function>>(prompts::functions())
                .unwrap();

        let raw_response = ctx
            .llm_gateway
            .chat(&self.trimmed_history()?, Some(&functions))
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

        ctx.track_query(
            EventData::output_stage("llm_reply").with_payload("raw_response", &raw_response),
        );

        let action = Action::deserialize_gpt(&raw_response)?;
        if !matches!(action, Action::Query(..)) {
            self.llm_history
                .push_back(llm_gateway::api::Message::function_call(&raw_response));
            trace!("handling raw action: {raw_response:?}");
        }

        Ok(Some(action))
    }

    async fn proc(
        &mut self,
        ctx: &AppContext,
        exchange_tx: Sender<Exchange>,
        question: &str,
        path_aliases: &[usize],
    ) -> Result<String> {
        // filesystem agnostic trivial path normalization
        //
        // - a//b -> a/b
        // - a/./b -> a/b
        // - a/b/../c -> a/c (regardless of whether this exists)
        // - ../b/c -> None
        #[allow(dead_code)]
        fn normalize(path: PathBuf) -> Option<PathBuf> {
            let mut stack = vec![];
            for c in path.components() {
                match c {
                    Component::Normal(s) => stack.push(s),
                    Component::ParentDir if stack.is_empty() => return None,
                    Component::ParentDir => {
                        _ = stack.pop();
                    }
                    _ => (),
                }
            }
            Some(stack.iter().collect::<PathBuf>())
        }

        let paths = path_aliases
            .iter()
            .copied()
            .map(|i| self.paths.get(i).ok_or(i).cloned())
            .collect::<Result<Vec<_>, _>>()
            .map_err(|i| anyhow!("invalid path alias {i}"))?;

        for u in paths
            .iter()
            .map(|p| Update::Step(SearchStep::Proc(p.clone())))
            .collect::<Vec<_>>()
        {
            exchange_tx.send(self.update(u)).await?;
        }

        let question = &question;
        let ctx = &ctx.clone().model("gpt-3.5-turbo-16k");
        let repo_ref = &self.repo_ref;
        let chunks = stream::iter(paths)
            .map(|path| async move {
                tracing::debug!(?path, "reading file");

                let lines = ctx
                    .app
                    .indexes
                    .file
                    .by_path(repo_ref, &path)
                    .await
                    .with_context(|| format!("failed to read path: {path}"))?
                    .content
                    .lines()
                    .enumerate()
                    .map(|(i, line)| format!("{} {line}", i + 1))
                    .collect::<Vec<_>>();

                const MAX_TOKENS: usize = 15400;

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

                tracing::debug!(?path, "calling chat API on file");

                let json = ctx
                    .llm_gateway
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
                        r.end = r.end.min(r.start + 20); // Cap relevant chunk size by line number
                        r
                    })
                    .collect();

                line_ranges.sort();
                line_ranges.dedup();

                let relevant_chunks = line_ranges
                    .into_iter()
                    .fold(Vec::<Range>::new(), |mut exps, next| {
                        if let Some(prev) = exps.last_mut() {
                            if prev.end + 10 >= next.start {
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
            let alias = self.path_alias(path) as u32;

            for c in relevant_chunks {
                let chunk = CodeChunk {
                    path: path.clone(),
                    alias,
                    snippet: c.code.clone(),
                    start_line: c.range.start as u32,
                    end_line: c.range.end as u32,
                };
                if !chunk.is_empty() {
                    self.code_chunks.push(chunk);
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
                    "path_alias": self.path_alias(&path),
                })
            })
            .collect::<Vec<_>>();

        let prompt = serde_json::to_string(&out)?;

        ctx.track_query(
            EventData::input_stage("process file")
                .with_payload("question", question)
                .with_payload("chunks", &out)
                .with_payload("raw_prompt", &prompt),
        );

        Ok(prompt)
    }

    async fn answer(
        &mut self,
        ctx: &AppContext,
        exchange_tx: Sender<Exchange>,
        aliases: &[usize],
    ) -> Result<()> {
        fn as_array(v: serde_json::Value) -> Option<Vec<serde_json::Value>> {
            match v {
                serde_json::Value::Array(a) => Some(a),
                _ => None,
            }
        }

        let context = {
            self.canonicalize_code_chunks(ctx).await;

            let mut s = "".to_owned();

            let mut path_aliases = aliases
                .iter()
                .copied()
                .filter(|alias| *alias < self.paths.len())
                .collect::<Vec<_>>();

            path_aliases.sort();
            path_aliases.dedup();

            if !self.paths.is_empty() {
                s += "##### PATHS #####\npath alias, path\n";

                if path_aliases.len() == 1 {
                    // Only show matching path
                    let alias = path_aliases[0];
                    let path = self.paths[alias].clone();
                    s += &format!("{alias}, {}\n", &path);
                } else {
                    // Show all paths that have been seen
                    for (alias, path) in self.paths.iter().enumerate() {
                        s += &format!("{alias}, {}\n", &path);
                    }
                }
            }

            let code_chunks = if path_aliases.len() == 1 {
                let alias = path_aliases[0];
                let path = self.paths[alias].clone();

                let file_contents = ctx
                    .app
                    .indexes
                    .file
                    .by_path(&self.repo_ref, &path)
                    .await
                    .with_context(|| format!("failed to read path: {}", path))?
                    .content;

                let bpe =
                    tiktoken_rs::get_bpe_from_model("gpt-4").context("invalid model requested")?;

                let trimmed_file_contents = limit_tokens(&file_contents, bpe, 4000);

                vec![CodeChunk {
                    alias: alias as u32,
                    path,
                    start_line: 1,
                    end_line: trimmed_file_contents.lines().count() as u32 + 1,
                    snippet: trimmed_file_contents.to_owned(),
                }]
            } else {
                self.code_chunks
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

                let formatted_snippet =
                    format!("### path alias: {} ###\n{snippet}\n\n", chunk.alias);

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

            s
        };

        let query_history = self.query_history().collect::<Vec<_>>();
        let query = self
            .last_exchange()
            .query()
            .context("exchange did not have a user query")?;

        let system_message = prompts::final_explanation_prompt(&context, query);
        let messages = Some(llm_gateway::api::Message::system(&system_message))
            .into_iter()
            .chain(query_history.iter().cloned())
            .collect::<Vec<_>>();

        let mut stream = ctx.llm_gateway.chat(&messages, None).await?.boxed();
        let mut buffer = String::new();

        while let Some(token) = stream.next().await {
            buffer += &token?;

            if buffer.is_empty() {
                continue;
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
                    let item = SearchResult::from_json_array(v);
                    if item.is_none() {
                        warn!("failed to build search result from: {v:?}");
                    }
                    item
                })
                .map(|s| s.substitute_path_alias(&self.paths))
                .collect::<Vec<_>>();

            exchange_tx
                .send(self.update(Update::Result(search_results)))
                .await?;
        }

        ctx.track_query(
            EventData::output_stage("answer")
                .with_payload("query", self.last_exchange().query())
                .with_payload("query_history", &query_history)
                .with_payload("response", &buffer)
                .with_payload("system_message", &system_message),
        );

        Ok(())
    }

    async fn store(self, db: &SqlDb, id: ConversationId) -> Result<()> {
        info!("writing conversation {}-{}", id.user_id, id.thread_id);
        let mut transaction = db.begin().await?;

        // Delete the old conversation for simplicity. This also deletes all its messages.
        let (user_id, thread_id) = (id.user_id.clone(), id.thread_id.to_string());
        sqlx::query! {
            "DELETE FROM conversations \
             WHERE user_id = ? AND thread_id = ?",
            user_id,
            thread_id,
        }
        .execute(&mut transaction)
        .await?;

        let repo_ref = self.repo_ref.to_string();
        let title = self
            .exchanges
            .first()
            .and_then(|list| list.query())
            .and_then(|q| q.split('\n').next())
            .context("couldn't find conversation title")?;

        let exchanges = serde_json::to_string(&self.exchanges)?;
        let llm_history = serde_json::to_string(&self.llm_history)?;
        let path_aliases = serde_json::to_string(&self.paths)?;
        let code_chunks = serde_json::to_string(&self.code_chunks)?;
        sqlx::query! {
            "INSERT INTO conversations (\
               user_id, thread_id, repo_ref, title, exchanges, llm_history, \
               path_aliases, code_chunks, created_at\
             ) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))",
            user_id,
            thread_id,
            repo_ref,
            title,
            exchanges,
            llm_history,
            path_aliases,
            code_chunks,
        }
        .execute(&mut transaction)
        .await?;

        transaction.commit().await?;

        Ok(())
    }

    async fn load(db: &SqlDb, id: &ConversationId) -> Result<Option<Self>> {
        let (user_id, thread_id) = (id.user_id.clone(), id.thread_id.to_string());

        let row = sqlx::query! {
            "SELECT repo_ref, llm_history, exchanges, path_aliases, code_chunks FROM conversations \
             WHERE user_id = ? AND thread_id = ?",
            user_id,
            thread_id,
        }
        .fetch_optional(db.as_ref())
        .await?;

        let row = match row {
            Some(r) => r,
            None => return Ok(None),
        };

        let repo_ref = RepoRef::from_str(&row.repo_ref).context("failed to parse repo ref")?;
        let path_aliases = serde_json::from_str(&row.path_aliases)?;
        let llm_history = serde_json::from_str(&row.llm_history)?;
        let exchanges = serde_json::from_str(&row.exchanges)?;
        let code_chunks = serde_json::from_str(&row.code_chunks)?;

        Ok(Some(Self {
            repo_ref,
            llm_history,
            exchanges,
            paths: path_aliases,
            code_chunks,
        }))
    }

    fn trimmed_history(&self) -> Result<Vec<llm_gateway::api::Message>> {
        const HEADROOM: usize = 2048;

        // Switch from a `VecDeque` to a `Vec` here.
        let mut llm_history = self.llm_history.iter().cloned().collect::<Vec<_>>();

        let mut tiktoken_msgs = self
            .llm_history
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
            let idx = llm_history
                .iter_mut()
                .position(|m| match m {
                    llm_gateway::api::Message::PlainText {
                        role,
                        ref mut content,
                    } if role == "user" && content != "[HIDDEN]" => {
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

        Ok(llm_history)
    }

    fn last_exchange(&mut self) -> &mut Exchange {
        self.exchanges.last_mut().expect("exchange list was empty")
    }

    fn update(&mut self, update: Update) -> Exchange {
        let exc = self.last_exchange();
        exc.apply_update(update);
        exc.clone()
    }

    async fn canonicalize_code_chunks(&mut self, ctx: &AppContext) {
        let mut chunks_by_path = HashMap::<_, Vec<_>>::new();

        for c in mem::take(&mut self.code_chunks) {
            chunks_by_path.entry(c.path.clone()).or_default().push(c);
        }

        let repo_ref = &self.repo_ref;
        self.code_chunks = futures::stream::iter(chunks_by_path)
            .then(|(path, mut chunks)| async move {
                chunks.sort_by_key(|c| c.start_line);

                let contents = ctx
                    .app
                    .indexes
                    .file
                    .by_path(repo_ref, &path)
                    .await
                    .unwrap()
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
            .await;
    }
}

fn split_line_set_by_tokens(
    lines: Vec<String>,
    bpe: CoreBPE,
    max_tokens: usize,
    line_overlap: usize,
) -> impl Iterator<Item = Vec<String>> {
    let line_tokens = lines
        .iter()
        .map(|line| bpe.encode_ordinary(line).len())
        .collect::<Vec<_>>();

    let mut start = 0usize;

    std::iter::from_fn(move || {
        if start >= lines.len() {
            return None;
        }

        start = start.saturating_sub(line_overlap);

        let mut subset = Vec::new();

        while start < lines.len() {
            if line_tokens[start - subset.len()..start]
                .iter()
                .sum::<usize>()
                > max_tokens
            {
                subset.pop();
                start -= 1;
                break;
            }

            subset.push(lines[start].clone());
            start += 1;
        }

        Some(subset)
    })
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

#[derive(Clone)]
struct AppContext {
    app: Application,
    llm_gateway: llm_gateway::Client,
    user: User,
    query_id: uuid::Uuid,
    thread_id: uuid::Uuid,
    repo_ref: Option<RepoRef>,

    /// Indicate whether the request was answered.
    ///
    /// This is used in the `Drop` handler, in order to track cancelled answer queries.
    req_complete: bool,
}

impl AppContext {
    fn new(app: Application, user: User) -> Result<Self> {
        let llm_gateway = llm_gateway::Client::new(&app.config.answer_api_url)
            .temperature(0.0)
            .bearer(app.github_token()?.map(|s| s.expose_secret().clone()));

        Ok(Self {
            app,
            llm_gateway,
            user,
            query_id: uuid::Uuid::nil(),
            thread_id: uuid::Uuid::nil(),
            repo_ref: None,
            req_complete: false,
        })
    }

    fn with_query_id(mut self, query_id: uuid::Uuid) -> Self {
        self.query_id = query_id;
        self
    }

    fn with_thread_id(mut self, thread_id: uuid::Uuid) -> Self {
        self.thread_id = thread_id;
        self
    }

    fn with_repo_ref(mut self, repo_ref: RepoRef) -> Self {
        self.repo_ref = Some(repo_ref);
        self
    }

    fn model(mut self, model: &str) -> Self {
        if model.is_empty() {
            self.llm_gateway.model = None;
        } else {
            self.llm_gateway.model = Some(model.to_owned());
        }

        self
    }

    fn track_query(&self, data: EventData) {
        let event = QueryEvent {
            query_id: self.query_id,
            thread_id: self.thread_id,
            repo_ref: self.repo_ref.clone(),
            data,
        };
        self.app.track_query(&self.user, &event);
    }
}

impl Drop for AppContext {
    fn drop(&mut self) {
        if !self.req_complete {
            self.track_query(
                EventData::output_stage("cancelled")
                    .with_payload("message", "request was cancelled"),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;

    #[test]
    fn test_trimming() {
        let long_string = "long string ".repeat(2000);

        let conversation = Conversation {
            llm_history: vec![
                llm_gateway::api::Message::system("foo"),
                llm_gateway::api::Message::user("bar"),
                llm_gateway::api::Message::assistant("baz"),
                llm_gateway::api::Message::user(&long_string),
                llm_gateway::api::Message::assistant("quux"),
                llm_gateway::api::Message::user("fred"),
                llm_gateway::api::Message::assistant("thud"),
                llm_gateway::api::Message::user(&long_string),
                llm_gateway::api::Message::user("corge"),
            ]
            .into(),
            exchanges: Vec::new(),
            paths: Vec::new(),
            repo_ref: "github.com/foo/bar".parse().unwrap(),
            code_chunks: vec![],
        };

        assert_eq!(
            conversation.trimmed_history().unwrap(),
            vec![
                llm_gateway::api::Message::system("foo"),
                llm_gateway::api::Message::user("[HIDDEN]"),
                llm_gateway::api::Message::assistant("baz"),
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
    fn test_split_line_set_by_tokens() {
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

        let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo").unwrap();
        let out = split_line_set_by_tokens(lines, bpe.clone(), 15, 3).collect::<Vec<_>>();
        let expected = vec![
            vec![
                "fn main() {".to_string(),
                "    one();".to_string(),
                "    two();".to_string(),
                "    three();".to_string(),
            ],
            vec![
                "    one();".to_string(),
                "    two();".to_string(),
                "    three();".to_string(),
                "    four();".to_string(),
                "    five();".to_string(),
            ],
            vec![
                "    three();".to_string(),
                "    four();".to_string(),
                "    five();".to_string(),
                "    six();".to_string(),
                "}".to_string(),
            ],
        ];
        pretty_assertions::assert_eq!(out, expected);
        for segment in &expected {
            assert!(dbg!(bpe.encode_ordinary(&dbg!(segment).join("\n")).len()) <= 15);
        }

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

        let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo").unwrap();
        let out = split_line_set_by_tokens(lines, bpe.clone(), 20, 2).collect::<Vec<_>>();
        let expected = vec![
            vec![
                "fn main() {".to_string(),
                "    one();".to_string(),
                "    two();".to_string(),
                "    three();".to_string(),
                "    four();".to_string(),
                "    five();".to_string(),
            ],
            vec![
                "    four();".to_string(),
                "    five();".to_string(),
                "    six();".to_string(),
                "}".to_string(),
            ],
        ];
        pretty_assertions::assert_eq!(out, expected);
        for segment in &expected {
            assert!(dbg!(bpe.encode_ordinary(&dbg!(segment).join("\n")).len()) <= 20);
        }
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
}
