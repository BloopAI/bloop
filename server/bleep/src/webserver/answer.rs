use std::{
    borrow::Cow,
    collections::{HashMap, HashSet},
    mem,
    path::{Component, PathBuf},
    str::FromStr,
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
use futures::{
    future::Either,
    stream::{self, BoxStream},
    StreamExt, TryStreamExt,
};
use reqwest::StatusCode;
use secrecy::ExposeSecret;
use tokio::sync::mpsc::Sender;
use tracing::trace;

use super::middleware::User;
use crate::{
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
    let conversation_id = ConversationId {
        user_id: user
            .0
            .ok_or_else(|| super::Error::user("didn't have user ID"))?,
        thread_id: params.thread_id,
    };

    let mut conversation = Conversation::load(&conversation_id)
        .await?
        .unwrap_or_else(|| Conversation::new(params.repo_ref.clone()));

    let ctx = AppContext::new(app)
        .map_err(|e| super::Error::user(e).with_status(StatusCode::UNAUTHORIZED))?;
    let q = params.q;
    let stream = async_stream::try_stream! {
        let mut action_stream = Action::Query(q).into()?;
        let mut exchange = Exchange::default();

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
                .step(&ctx, action_stream, update_tx)
                .into_stream()
                .map(Either::Right);

            let mut next = None;
            for await item in stream::select(left_stream, right_stream) {
                match item {
                    Either::Left(upd) => {
                        exchange.apply_update(upd);
                        yield exchange.clone()
                    },
                    Either::Right(n) => next = n?,
                }
            }

            match next {
                Some(a) => action_stream = a,
                None => break,
            }
        }

        // TODO: add `conclusion` of last assistant response to history here
        // Storing the conversation here allows us to make subsequent requests.

        // conversation
        //     .history
        //     .push(llm_gateway::api::Message::assistant(
        //         full_update.conclusion().unwrap_or_default(),
        //     ));

        conversation.exchanges.push(exchange);
        conversation.store(conversation_id).await?;
    };

    let thread_stream = futures::stream::once(async move {
        Ok(sse::Event::default().data(params.thread_id.to_string()))
    });

    let answer_stream = stream.map(|upd: Result<Exchange>| {
        sse::Event::default().json_data(upd.map_err(|e| e.to_string()))
    });

    let done_stream = futures::stream::once(async { Ok(sse::Event::default().data("[DONE]")) });

    let stream = thread_stream.chain(answer_stream).chain(done_stream);

    Ok(Sse::new(stream))
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
    path_aliases: Vec<String>,
    repo_ref: RepoRef,
}

impl Conversation {
    fn new(repo_ref: RepoRef) -> Self {
        // We start of with a conversation describing the operations that the LLM can perform, and
        // an initial (hidden) prompt that we pose to the user.

        Self {
            llm_history: vec![
                llm_gateway::api::Message::system(prompts::SYSTEM),
                llm_gateway::api::Message::assistant(prompts::INITIAL_PROMPT),
            ],
            exchanges: Vec::new(),
            path_aliases: Vec::new(),
            repo_ref,
        }
    }

    fn path_alias(&mut self, path: &str) -> usize {
        if let Some(i) = self.path_aliases.iter().position(|p| *p == path) {
            i
        } else {
            let i = self.path_aliases.len();
            self.path_aliases.push(path.to_owned());
            i
        }
    }

    async fn step(
        &mut self,
        ctx: &AppContext,
        action_stream: ActionStream,
        update: Sender<Update>,
    ) -> Result<Option<ActionStream>> {
        let (action, raw_response) = action_stream.load().await?;

        if !matches!(action, Action::Query(..)) {
            self.llm_history
                .push(llm_gateway::api::Message::assistant(&raw_response));
            trace!("handling raw action: {raw_response}");
        }

        let question = match action {
            Action::Query(s) => {
                update
                    .send(Update::Step(SearchStep::Query(s.clone())))
                    .await?;

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
                update
                    .send(Update::Step(SearchStep::Prompt("awaiting prompt".into())))
                    .await?;

                return Ok(None);
            }

            Action::Answer(rephrased_question) => {
                self.answer(
                    ctx,
                    update,
                    &rephrased_question,
                    self.path_aliases.as_slice(),
                )
                .await?;
                let r: Result<ActionStream> = Action::Prompt(prompts::CONTINUE.to_owned()).into();
                return Ok(Some(r?));
            }

            Action::Path(search) => {
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

                // If there are no lexical results, perform a semantic search.
                if paths.is_empty() {
                    // TODO: Semantic search should accept unparsed queries
                    let nl_query = SemanticQuery {
                        target: Some(parser::Literal::Plain(Cow::Owned(search))),
                        ..Default::default()
                    };

                    let semantic_paths = ctx
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
                        .map(|chunk| chunk["relative_path"].as_str().unwrap().to_owned())
                        .collect::<HashSet<_>>()
                        .into_iter()
                        .collect();

                    paths = semantic_paths;
                }

                for u in paths
                    .iter()
                    .map(|p| Update::Step(SearchStep::Path(p.clone())))
                {
                    update.send(u).await?;
                }

                Some("§alias, path".to_owned())
                    .into_iter()
                    .chain(paths.iter().map(|p| format!("{}, {p}", self.path_alias(p))))
                    .collect::<Vec<_>>()
                    .join("\n")
            }

            Action::Code(query) => {
                // Semantic search.

                update
                    .send(Update::Step(SearchStep::Code(query.clone())))
                    .await?;

                let nl_query = SemanticQuery {
                    target: Some(parser::Literal::Plain(Cow::Owned(query))),
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
                        serde_json::json!({
                            "path": relative_path,
                            "§ALIAS": self.path_alias(relative_path),
                            "snippet": chunk["snippet"],
                            "start": chunk["start_line"].as_str().unwrap().parse::<u32>().unwrap(),
                            "end": chunk["end_line"].as_str().unwrap().parse::<u32>().unwrap(),
                        })
                    })
                    .collect::<Vec<_>>();

                serde_json::to_string(&chunks).unwrap()
            }

            Action::Proc(question, path_aliases) => {
                self.proc(ctx, update, question, path_aliases).await?
            }
        };

        self.llm_history.push(llm_gateway::api::Message::user(
            &(question + "\n\nAnswer only with a JSON action."),
        ));

        let stream = ctx.llm_gateway.chat(&self.llm_history).await?.boxed();
        let action_stream = ActionStream {
            tokens: String::new(),
            action: Either::Left(stream),
        };

        Ok(Some(action_stream))
    }

    async fn proc(
        &mut self,
        ctx: &AppContext,
        update: Sender<Update>,
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
            .map(|i| self.path_aliases.get(i).ok_or(i))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|i| anyhow!("invalid path alias {i}"))?;

        for u in paths
            .iter()
            .map(|&p| Update::Step(SearchStep::Proc(p.clone())))
        {
            update.send(u).await?;
        }

        let question = &question;
        let ctx = &ctx.clone().model("gpt-3.5-turbo");
        let repo_ref = &self.repo_ref;
        let chunks = stream::iter(paths).map(|path| async move {
            let lines = ctx
                .app
                .indexes
                .file
                .by_path(repo_ref, path)
                .await
                .with_context(|| format!("failed to read path: {path}"))?
                .content
                .split('\n')
                .enumerate()
                .map(|(i, line)| format!("{}: {line}", i + 1))
                .collect::<Vec<_>>();

            // We store the lines separately, so that we can reference them later to trim
            // this snippet by line number.
            let contents = lines.join("\n");

            let prompt = prompts::file_explanation(question, path, &contents);

            let json = ctx
                .llm_gateway
                .chat(&[llm_gateway::api::Message::system(&prompt)])
                .await?
                .try_collect::<String>()
                .await?;

            #[derive(serde::Deserialize)]
            struct ProcResult {
                // list of paths relative to the currently processed file
                dependencies: Vec<String>,
                // list of relevant line ranges
                lines: Vec<Range>,
            }

            #[derive(serde::Deserialize)]
            struct Range {
                start: usize,
                end: usize,
            }

            let proc_result = serde_json::from_str::<ProcResult>(&json)?;

            // turn relative paths into absolute paths
            let normalized_deps = proc_result
                .dependencies
                .iter()
                .filter_map(|d| normalize(PathBuf::from(path).join(d)))
                .collect::<Vec<_>>();

            let explanations = proc_result
                .lines
                .iter()
                .filter(|r| r.start > 0 && r.end > 0)
                .map(|r| {
                    let end = r.end.min(r.start + 10);

                    serde_json::json!({
                        "start": r.start,
                        "end": end,
                        "relevant_code": lines[r.start..end].join("\n"),
                    })
                })
                .collect::<Vec<_>>();

            Ok::<_, anyhow::Error>(serde_json::json!({
                "explanations": explanations,
                "path": path,
                "relevant_dependencies": normalized_deps,
            }))
        });

        let out = chunks
            // This box seems unnecessary, but it avoids a compiler bug:
            // https://github.com/rust-lang/rust/issues/64552
            .boxed()
            .buffered(5)
            .filter_map(|res| async { res.ok() })
            .collect::<Vec<_>>()
            .await;

        Ok(serde_json::to_string(&out)?)
    }

    async fn answer(
        &self,
        ctx: &AppContext,
        update: Sender<Update>,
        question: &str,
        path_aliases: &[String],
    ) -> Result<()> {
        let messages = self
            .llm_history
            .iter()
            .filter(|m| m.role == "user")
            .map(|m| &m.content)
            .collect::<Vec<_>>();

        let context = serde_json::to_string(&messages)?;
        let prompt = prompts::final_explanation_prompt(&context, question);

        let messages = [llm_gateway::api::Message::system(&prompt)];

        let mut stream = ctx.llm_gateway.chat(&messages).await?.boxed();
        let mut buffer = String::new();
        while let Some(token) = stream.next().await {
            buffer += &token?;
            let (s, _) = partial_parse::rectify_json(&buffer);

            // this /should/ be infallible if rectify_json works
            let json_array: Vec<Vec<serde_json::Value>> =
                serde_json::from_str(&s).expect("failed to rectify_json");

            let search_results = json_array
                .iter()
                .map(Vec::as_slice)
                .filter_map(SearchResult::from_json_array)
                .map(|s| s.substitute_path_alias(path_aliases))
                .collect::<Vec<_>>();

            update.send(Update::Result(search_results)).await?;
        }

        Ok(())
    }

    async fn store(self, id: ConversationId) -> Result<()> {
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
        let path_aliases = serde_json::to_string(&self.path_aliases)?;
        sqlx::query! {
            "INSERT INTO conversations (\
               user_id, thread_id, repo_ref, title, exchanges, llm_history, \
               path_aliases, created_at\
             ) \
             VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))",
            user_id,
            thread_id,
            repo_ref,
            title,
            exchanges,
            llm_history,
            path_aliases,
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
            "SELECT repo_ref, llm_history, exchanges, path_aliases FROM conversations \
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

        Ok(Some(Self {
            repo_ref,
            llm_history,
            exchanges,
            path_aliases,
        }))
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
enum Action {
    /// A user-provided query.
    Query(String),

    #[serde(rename = "ask")]
    Prompt(String),
    Path(String),
    Answer(String),
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
    /// ```
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

    /// The inverse of `deserialize_gpt`; serializes this action into a format described by our
    /// prompt.
    fn serialize_gpt(&self) -> Result<String> {
        let mut obj = serde_json::to_value(self)?;
        let mut fields = mem::take(
            obj.as_object_mut()
                .context("action was not serialized as an object")?,
        )
        .into_iter()
        .collect::<Vec<_>>();

        if fields.len() != 1 {
            bail!("action serialized to multiple keys");
        }

        let (k, v) = fields.pop().unwrap();
        let k = k.into();
        let array = match v {
            serde_json::Value::Null => vec![k],
            serde_json::Value::Array(a) => [vec![k], a].concat(),
            other => vec![k, other],
        };

        Ok(serde_json::to_string(&array)?)
    }
}

/// An action that may not have finished loading yet.
struct ActionStream {
    tokens: String,
    action: Either<BoxStream<'static, Result<String>>, Action>,
}

impl ActionStream {
    /// Load this action, consuming the stream if required.
    async fn load(mut self) -> Result<(Action, String)> {
        let mut stream = match self.action {
            Either::Left(stream) => stream,
            Either::Right(action) => {
                return Ok((action, self.tokens));
            }
        };

        while let Some(token) = stream.next().await {
            self.tokens += &token?;
        }

        let action = Action::deserialize_gpt(&self.tokens)?;
        Ok((action, self.tokens))
    }
}

impl From<Action> for Result<ActionStream> {
    fn from(action: Action) -> Self {
        Ok(ActionStream {
            tokens: action.serialize_gpt()?,
            action: Either::Right(action),
        })
    }
}

#[derive(Clone)]
struct AppContext {
    app: Application,
    llm_gateway: llm_gateway::Client,
}

impl AppContext {
    fn new(app: Application) -> Result<Self> {
        let llm_gateway = llm_gateway::Client::new(&app.config.answer_api_url)
            .temperature(0.0)
            .bearer(app.github_token()?.map(|s| s.expose_secret().clone()));

        Ok(Self { app, llm_gateway })
    }

    fn model(mut self, model: &str) -> Self {
        if model.is_empty() {
            self.llm_gateway.model = None;
        } else {
            self.llm_gateway.model = Some(model.to_owned());
        }

        self
    }
}
