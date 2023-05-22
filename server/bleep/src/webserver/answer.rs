use std::{
    borrow::Cow,
    collections::{HashMap, HashSet},
    mem,
    panic::AssertUnwindSafe,
    path::{Component, PathBuf},
    str::FromStr,
    time::Duration,
};

use anyhow::{anyhow, bail, Context, Result};
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
use tracing::{info, trace, warn};

use super::middleware::User;
use crate::{
    analytics::{EventData, QueryEvent},
    db,
    query::parser::{self, SemanticQuery},
    repo::RepoRef,
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
        Query(params),
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
            .0
            .as_ref()
            .ok_or_else(|| super::Error::user("didn't have user ID"))?
            .to_string(),
        thread_id: params.thread_id,
    };

    let mut conversation = Conversation::load(&conversation_id)
        .await?
        .unwrap_or_else(|| Conversation::new(params.repo_ref.clone()));

    let ctx = AppContext::new(app, user, query_id)
        .map_err(|e| super::Error::user(e).with_status(StatusCode::UNAUTHORIZED))?;

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
        conversation.store(conversation_id).await?;
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
    llm_history: Vec<llm_gateway::api::Message>,
    exchanges: Vec<Exchange>,
    paths: Vec<String>,
    code_chunks: Vec<CodeChunk>,
    repo_ref: RepoRef,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
struct CodeChunk {
    path: String,
    #[serde(rename = "§ALIAS")]
    alias: u32,
    #[serde(rename = "snippet")]
    snippet: String,
    #[serde(rename = "start")]
    start_line: u32,
    #[serde(rename = "end")]
    end_line: u32,
}

impl Conversation {
    fn new(repo_ref: RepoRef) -> Self {
        // We start of with a conversation describing the operations that the LLM can perform, and
        // an initial (hidden) prompt that we pose to the user.

        Self {
            llm_history: vec![
                llm_gateway::api::Message::system(&prompts::system()),
                llm_gateway::api::Message::assistant(prompts::INITIAL_PROMPT),
            ],
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

    fn query_history(&self) -> Vec<String> {
        self.exchanges
            .iter()
            .flat_map(|e| match (e.query(), e.conclusion()) {
                (Some(q), Some(c)) => vec![("user", q), ("assistant", c)],
                (Some(q), None) => vec![("user", q)],
                _ => vec![],
            })
            .map(|(author, message)| format!("{author}: {message}"))
            .collect()
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
        let action_result = match action {
            Action::Query(s) => {
                exchange_tx
                    .send(self.update(Update::Step(SearchStep::Query(s.clone()))))
                    .await?;

                ctx.track_query(EventData::input_stage("query").with_payload("q", &s));

                match self.get_summarized_answer() {
                    Some(summary) => {
                        info!("attaching summary of previous exchange: {summary}");
                        self.llm_history
                            .push(llm_gateway::api::Message::assistant(&summary));
                        self.llm_history
                            .push(llm_gateway::api::Message::assistant(prompts::CONTINUE));
                    }
                    None => {
                        info!("no previous exchanges, skipping summary");
                    }
                }

                parser::parse_nl(&s)?
                    .as_semantic()
                    .context("got a 'Grep' query")?
                    .target
                    .as_ref()
                    .context("query was empty")?
                    .as_plain()
                    .context("user query was not plain text")?
                    .clone()
                    .into_owned()
            }

            Action::Prompt(_) => {
                exchange_tx
                    .send(self.update(Update::Step(SearchStep::Prompt("awaiting prompt".into()))))
                    .await?;

                return Ok(None);
            }

            Action::Answer(aliases) => {
                self.answer(ctx, exchange_tx, aliases).await?;
                let action = Action::Prompt(prompts::CONTINUE.to_owned());
                return Ok(Some(action));
            }

            Action::Path(search) => {
                exchange_tx
                    .send(self.update(Update::Step(SearchStep::Path(search.clone()))))
                    .await?;

                // First, perform a lexical search for the path
                // TODO: This should be fuzzy
                let mut paths = ctx
                    .app
                    .indexes
                    .file
                    .fuzzy_path_match(&self.repo_ref, &search, /* limit */ 50)
                    .await
                    .map(|c| c.relative_path)
                    .collect::<Vec<_>>();

                let is_semantic = paths.is_empty();

                // If there are no lexical results, perform a semantic search.
                if paths.is_empty() {
                    // TODO: Semantic search should accept unparsed queries
                    let nl_query = SemanticQuery {
                        target: Some(parser::Literal::Plain(Cow::Owned(search.clone()))),
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
                        .search(&nl_query, 30, 0)
                        .await?
                        .into_iter()
                        .map(|v| {
                            v.payload
                                .into_iter()
                                .map(|(k, v)| (k, super::semantic::kind_to_value(v.kind)))
                                .collect::<HashMap<_, _>>()
                        })
                        .map(|chunk| chunk["relative_path"].as_str().unwrap().to_owned())
                        .collect::<HashSet<_>>()
                        .into_iter()
                        .collect();

                    paths = semantic_paths;
                }

                ctx.track_query(
                    EventData::input_stage("path search")
                        .with_payload("query", &search)
                        .with_payload("is_semantic", is_semantic)
                        .with_payload("results", &paths),
                );

                Some("§alias, path".to_owned())
                    .into_iter()
                    .chain(paths.iter().map(|p| format!("{}, {p}", self.path_alias(p))))
                    .collect::<Vec<_>>()
                    .join("\n")
            }

            Action::Code(query) => {
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
                    .search(&nl_query, 10, 0)
                    .await?
                    .into_iter()
                    .map(|v| {
                        v.payload
                            .into_iter()
                            .map(|(k, v)| (k, super::semantic::kind_to_value(v.kind)))
                            .collect::<HashMap<_, _>>()
                    })
                    .map(|chunk| {
                        let relative_path = chunk["relative_path"].as_str().unwrap();

                        CodeChunk {
                            path: relative_path.to_owned(),
                            alias: self.path_alias(relative_path) as u32,
                            snippet: chunk["snippet"].as_str().unwrap().to_owned(),
                            start_line: chunk["start_line"]
                                .as_str()
                                .unwrap()
                                .parse::<u32>()
                                .unwrap()
                                .saturating_add(1),
                            end_line: chunk["end_line"]
                                .as_str()
                                .unwrap()
                                .parse::<u32>()
                                .unwrap()
                                .saturating_add(1),
                        }
                    })
                    .collect::<Vec<_>>();

                for chunk in &chunks {
                    self.code_chunks.push(chunk.clone());
                }

                ctx.track_query(
                    EventData::input_stage("semantic code search")
                        .with_payload("query", &query)
                        .with_payload("chunks", &chunks),
                );

                serde_json::to_string(&chunks).unwrap()
            }

            Action::Proc(question, path_aliases) => {
                self.proc(ctx, exchange_tx, question, path_aliases).await?
            }
        };

        self.llm_history.push(llm_gateway::api::Message::user(
            &(action_result + "\n\nAnswer only with a JSON action."),
        ));

        let raw_response = ctx
            .llm_gateway
            .chat(&self.trimmed_history()?)
            .await?
            .try_collect::<String>()
            .await?;

        let action = Action::deserialize_gpt(&raw_response)?;
        if !matches!(action, Action::Query(..)) {
            self.llm_history
                .push(llm_gateway::api::Message::assistant(&raw_response));
            trace!("handling raw action: {raw_response}");
        }

        Ok(Some(action))
    }

    async fn proc(
        &mut self,
        ctx: &AppContext,
        exchange_tx: Sender<Exchange>,
        question: String,
        path_aliases: Vec<usize>,
    ) -> Result<String> {
        // filesystem agnostic trivial path normalization
        //
        // - a//b -> a/b
        // - a/./b -> a/b
        // - a/b/../c -> a/c (regardless of whether this exists)
        // - ../b/c -> None
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
            .into_iter()
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
        let ctx = &ctx.clone().model("gpt-3.5-turbo");
        let repo_ref = &self.repo_ref;
        let chunks = stream::iter(paths)
            .map(|path| async move {
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

                Result::<_>::Ok((lines, path))
            })
            // Buffer file loading to load multiple paths at once
            .buffered(10)
            .and_then(|(lines, path): (Vec<String>, String)| async move {
                const MAX_TOKENS: usize = 3400;
                const LINE_OVERLAP: usize = 3;

                let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo")?;
                let iter = split_line_set_by_tokens(lines, bpe, MAX_TOKENS, LINE_OVERLAP)
                    .map(move |lines| Result::<_>::Ok((lines, path.clone())));

                Ok(futures::stream::iter(iter))
            })
            .try_flatten()
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

                let json = ctx
                    .llm_gateway
                    .chat(&[llm_gateway::api::Message::system(&prompt)])
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
                self.code_chunks.push(CodeChunk {
                    path: path.clone(),
                    alias,
                    snippet: c.code.clone(),
                    start_line: c.range.start as u32,
                    end_line: c.range.end as u32,
                });
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
                    "path": path,
                })
            })
            .collect::<Vec<_>>();

        ctx.track_query(
            EventData::input_stage("process file")
                .with_payload("question", question)
                .with_payload("chunks", &out),
        );

        Ok(serde_json::to_string(&out)?)
    }

    async fn answer(
        &mut self,
        ctx: &AppContext,
        exchange_tx: Sender<Exchange>,
        aliases: Vec<usize>,
    ) -> Result<()> {
        fn as_array(v: serde_json::Value) -> Option<Vec<serde_json::Value>> {
            match v {
                serde_json::Value::Array(a) => Some(a),
                _ => None,
            }
        }

        let context = {
            self.dedup_code_chunks();

            let mut s = "".to_owned();

            let mut path_aliases = aliases
                .into_iter()
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

            if !self.code_chunks.is_empty() {
                s += "\n##### CODE CHUNKS #####\n\n";
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

                let trimmed_file_contents = tiktoken_rs::get_bpe_from_model("gpt-4")
                    .context("invalid model requested")?
                    .split_by_token_iter(&file_contents, false)
                    .take(4000)
                    .collect::<Result<String>>()
                    .context("failed to tokenize file contents")?;

                vec![CodeChunk {
                    alias: alias as u32,
                    path,
                    start_line: 1,
                    end_line: trimmed_file_contents.lines().count() as u32 + 1,
                    snippet: trimmed_file_contents,
                }]
            } else {
                self.code_chunks
                    .iter()
                    .filter(|c| path_aliases.contains(&(c.alias as usize)))
                    .cloned()
                    .collect()
            };

            // Order chunks by most recent.
            for chunk in code_chunks.iter().rev() {
                let snippet = chunk
                    .snippet
                    .lines()
                    .enumerate()
                    .map(|(i, line)| format!("{} {line}\n", i + chunk.start_line as usize))
                    .collect::<String>();

                s += &format!("### path alias: {} ###\n{snippet}\n\n", chunk.alias);
            }

            s
        };

        let query_history = self.query_history().join("\n");
        let query = self
            .last_exchange()
            .query()
            .context("exchange did not have a user query")?;

        let prompt = prompts::final_explanation_prompt(&context, query, &query_history);

        let messages = [llm_gateway::api::Message::system(&prompt)];

        let mut stream = ctx.llm_gateway.chat(&messages).await?.boxed();
        let mut buffer = String::new();
        while let Some(token) = stream.next().await {
            buffer += &token?;
            let (s, _) = partial_parse::rectify_json(&buffer);

            // this /should/ be infallible if rectify_json works
            let rectified_json: serde_json::Value =
                serde_json::from_str(&s).expect("failed to rectify_json");

            let json_array = as_array(rectified_json)
                .ok_or(anyhow!("failed to parse `answer` response, expected array"))?;

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
                .with_payload("context", &context)
                .with_payload("response", &buffer),
        );

        Ok(())
    }

    async fn store(self, id: ConversationId) -> Result<()> {
        info!("writing conversation {}-{}", id.user_id, id.thread_id);
        let db = db::get().await?;
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

    async fn load(id: &ConversationId) -> Result<Option<Self>> {
        let db = db::get().await?;

        let (user_id, thread_id) = (id.user_id.clone(), id.thread_id.to_string());

        let row = sqlx::query! {
            "SELECT repo_ref, llm_history, exchanges, path_aliases, code_chunks FROM conversations \
             WHERE user_id = ? AND thread_id = ?",
            user_id,
            thread_id,
        }
        .fetch_optional(db)
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
        const HEADROOM: usize = 4096;

        let mut tiktoken_msgs = self
            .llm_history
            .iter()
            .map(|m| tiktoken_rs::ChatCompletionRequestMessage {
                role: m.role.clone(),
                content: m.content.clone(),
                name: None,
            })
            .collect::<Vec<_>>();

        while tiktoken_rs::get_chat_completion_max_tokens("gpt-4", &tiktoken_msgs)? < HEADROOM {
            tiktoken_msgs
                .iter_mut()
                .find(|m| m.role == "user" && m.content != "[HIDDEN]")
                .context("could not find message to trim")?
                .content = "[HIDDEN]".into();
        }

        Ok(tiktoken_msgs
            .into_iter()
            .map(|m| llm_gateway::api::Message {
                role: m.role,
                content: m.content,
            })
            .collect())
    }

    fn last_exchange(&mut self) -> &mut Exchange {
        self.exchanges.last_mut().expect("exchange list was empty")
    }

    fn update(&mut self, update: Update) -> Exchange {
        let exc = self.last_exchange();
        exc.apply_update(update);
        exc.clone()
    }

    fn dedup_code_chunks(&mut self) {
        let mut chunks_by_alias = HashMap::<_, Vec<_>>::new();

        for c in mem::take(&mut self.code_chunks) {
            chunks_by_alias.entry(c.alias).or_default().push(c);
        }

        self.code_chunks = chunks_by_alias
            .into_values()
            .flat_map(|mut chunks| {
                chunks.sort_by_key(|c| c.start_line);

                chunks
                    .into_iter()
                    .fold(Vec::<CodeChunk>::new(), |mut a, e| {
                        if let Some(prev) = a.last_mut() {
                            if prev.end_line >= e.start_line {
                                prev.end_line = e.start_line;
                                prev.snippet += "\n";
                                prev.snippet += &e
                                    .snippet
                                    .lines()
                                    .skip((e.start_line - prev.end_line) as usize + 1)
                                    .collect::<Vec<_>>()
                                    .join("\n");
                                return a;
                            }
                        }

                        a.push(e);
                        a
                    })
            })
            .collect();
    }
}

fn split_line_set_by_tokens(
    lines: Vec<String>,
    bpe: CoreBPE,
    max_tokens: usize,
    line_overlap: usize,
) -> impl Iterator<Item = Vec<String>> {
    let mut start = 0usize;

    std::iter::from_fn(move || {
        if start >= lines.len() {
            return None;
        }

        start = start.saturating_sub(line_overlap);

        let mut subset = Vec::new();

        while start < lines.len()
            && bpe.split_by_token_ordinary_iter(&subset.join("\n")).count() < max_tokens
        {
            subset.push(lines[start].clone());
            start += 1;
        }

        Some(subset)
    })
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
enum Action {
    /// A user-provided query.
    Query(String),

    #[serde(rename = "ask")]
    Prompt(String),
    Path(String),
    #[serde(rename = "none")]
    Answer(Vec<usize>),
    Code(String),
    Proc(String, Vec<usize>),
}

impl Action {
    /// Deserialize this action from the GPT-tagged enum variant format.
    ///
    /// We convert:
    ///
    /// ```text
    /// ["type", "value"]
    /// ["type", "arg1", "arg2"]
    /// ```
    ///
    /// To:
    ///
    /// ```text
    /// {"type":"value"}
    /// {"type":["arg1", "arg2"]}
    /// ```
    ///
    /// So that we can deserialize using the serde-provided "tagged" enum representation.
    fn deserialize_gpt(s: &str) -> Result<Self> {
        let mut array = serde_json::from_str::<Vec<serde_json::Value>>(s)
            .with_context(|| format!("model response was not a JSON array: {s}"))?;

        if array.is_empty() {
            bail!("model returned an empty array");
        }

        let action = array.remove(0);
        let action = action.as_str().context("model action was not a string")?;

        let value = if array.len() < 2 {
            array.pop().unwrap_or_default()
        } else {
            array.into()
        };

        let mut obj = serde_json::Map::new();
        obj.insert(action.into(), value);
        Ok(serde::Deserialize::deserialize(serde_json::Value::Object(
            obj,
        ))?)
    }
}

#[derive(Clone)]
struct AppContext {
    app: Application,
    llm_gateway: llm_gateway::Client,
    query_id: uuid::Uuid,
    user: User,
}

impl AppContext {
    fn new(app: Application, user: User, query_id: uuid::Uuid) -> Result<Self> {
        let llm_gateway = llm_gateway::Client::new(&app.config.answer_api_url)
            .temperature(0.0)
            .bearer(app.github_token()?.map(|s| s.expose_secret().clone()));

        Ok(Self {
            app,
            llm_gateway,
            query_id,
            user,
        })
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
            data,
        };
        self.app.track_query(&self.user, &event);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trimming() {
        let long_string = std::iter::repeat("long string ")
            .take(2000)
            .collect::<String>();

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
            ],
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
        let out = split_line_set_by_tokens(lines, bpe, 15, 3).collect::<Vec<_>>();

        pretty_assertions::assert_eq!(
            out,
            vec![
                vec![
                    "fn main() {".to_string(),
                    "    one();".to_string(),
                    "    two();".to_string(),
                    "    three();".to_string(),
                    "    four();".to_string(),
                ],
                vec![
                    "    two();".to_string(),
                    "    three();".to_string(),
                    "    four();".to_string(),
                    "    five();".to_string(),
                    "    six();".to_string(),
                ],
                vec![
                    "    four();".to_string(),
                    "    five();".to_string(),
                    "    six();".to_string(),
                    "}".to_string(),
                ],
            ],
        );

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
        let out = split_line_set_by_tokens(lines, bpe, 20, 2).collect::<Vec<_>>();

        pretty_assertions::assert_eq!(
            out,
            vec![
                vec![
                    "fn main() {".to_string(),
                    "    one();".to_string(),
                    "    two();".to_string(),
                    "    three();".to_string(),
                    "    four();".to_string(),
                    "    five();".to_string(),
                    "    six();".to_string(),
                ],
                vec![
                    "    five();".to_string(),
                    "    six();".to_string(),
                    "}".to_string(),
                ],
            ],
        );
    }
}
