use std::{
    borrow::Cow,
    collections::{HashMap, HashSet},
    mem,
    sync::Arc,
};

use anyhow::{anyhow, bail, Context, Result};
use axum::{
    extract::{Query, State},
    response::{
        sse::{self, Sse},
        IntoResponse,
    },
    routing::MethodRouter,
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
    query::parser::{self, NLQuery},
    repo::RepoRef,
    Application,
};

mod llm_gateway;
mod partial_parse;
mod prompts;

#[derive(Default)]
pub struct RouteState {
    conversations: scc::HashMap<ConversationId, Conversation>,
}

#[derive(Clone, Debug, serde::Deserialize)]
pub struct Params {
    pub q: String,
    pub repo_ref: RepoRef,
    #[serde(default = "default_thread_id")]
    pub thread_id: String,
}

fn default_thread_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub(super) fn endpoint<S>() -> MethodRouter<S> {
    let state = Arc::new(RouteState::default());
    axum::routing::get(handle).with_state(state)
}

pub(super) async fn handle(
    Query(params): Query<Params>,
    State(state): State<Arc<RouteState>>,
    Extension(app): Extension<Application>,
    Extension(user): Extension<User>,
) -> super::Result<impl IntoResponse> {
    let conversation_id = ConversationId {
        user_id: user
            .0
            .ok_or_else(|| super::Error::user("didn't have user ID"))?,
        thread_id: params.thread_id,
    };

    let mut conversation: Conversation = state
        .conversations
        .read_async(&conversation_id, |_k, v| v.clone())
        .await
        .unwrap_or_else(|| Conversation::new(params.repo_ref));

    let ctx = AppContext::new(app)
        .map_err(|e| super::Error::user(e).with_status(StatusCode::UNAUTHORIZED))?;
    let q = params.q;
    let stream = async_stream::try_stream! {
        let mut action_stream = Action::Query(q).into()?;

        loop {
            // The main loop. Here, we create two streams that operate simultaneously; the update
            // stream, which sends updates back to the HTTP event stream response, and the action
            // stream, which returns a single item when there is a new action available to execute.
            // Both of these operate together, and we repeat the process for every new action.

            use futures::future::FutureExt;


            let (update_tx, update_rx) = tokio::sync::mpsc::channel(100);

            let left_stream = tokio_stream::wrappers::ReceiverStream::new(update_rx)
                .map(Either::Left);

            let mut update_stream = UpdateStream::new(&conversation_id, &conversation);
            update_stream.set_tx(update_tx);
            let right_stream = conversation
                .step(&ctx, action_stream, &mut update_stream)
                .into_stream()
                .map(Either::Right);

            let mut next = None;
            for await item in stream::select(left_stream, right_stream) {
                match item {
                    Either::Left(upd) => yield upd,
                    Either::Right(n) => next = n?,
                }
            }

            match next {
                Some(a) => action_stream = a,
                None => break,
            }
        }

        // Storing the conversation here allows us to make subsequent requests.
        state.conversations
            .entry_async(conversation_id)
            .await
            .insert_entry(conversation);
    };

    let stream = stream
        .map(|upd: Result<_>| sse::Event::default().json_data(upd.map_err(|e| e.to_string())))
        .chain(futures::stream::once(async {
            Ok(sse::Event::default().data("[DONE]"))
        }));

    Ok(Sse::new(stream))
}

#[derive(Hash, PartialEq, Eq)]
struct ConversationId {
    thread_id: String,
    user_id: String,
}

#[derive(Clone, Debug)]
struct Conversation {
    history: Vec<llm_gateway::api::Message>,
    path_aliases: Vec<String>,
    repo_ref: RepoRef,
}

impl Conversation {
    fn new(repo_ref: RepoRef) -> Self {
        // We start of with a conversation describing the operations that the LLM can perform, and
        // an initial (hidden) prompt that we pose to the user.

        Self {
            history: vec![
                llm_gateway::api::Message::system(prompts::SYSTEM),
                llm_gateway::api::Message::assistant(prompts::INITIAL_PROMPT),
            ],
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
        update: &mut UpdateStream,
    ) -> Result<Option<ActionStream>> {
        let (action, raw_response) = action_stream.load(update).await.unwrap();

        let question = match action {
            Action::Query(s) => parser::parse_nl(&s)?
                .target
                .context("query was empty")?
                .as_plain()
                .context("user query was not plain text")?
                .clone()
                .into_owned(),

            Action::Prompt(_) => {
                return Ok(None);
            }

            Action::Answer(rephrased_question) => {
                self.answer(ctx, update, &rephrased_question).await?;
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
                    .partial_path_match(&self.repo_ref, &search)
                    .await
                    .map(|c| c.relative_path)
                    .map(|p| format!("{}, {p}", self.path_alias(&p)))
                    .collect::<Vec<_>>();

                // If there are no lexical results, perform a semantic search.
                if paths.is_empty() {
                    // TODO: Semantic search should accept unparsed queries
                    let nl_query = NLQuery {
                        target: Some(parser::Literal::Plain(Cow::Owned(search))),
                        ..Default::default()
                    };

                    let mut semantic_paths: Vec<String> = ctx
                        .app
                        .semantic
                        .as_ref()
                        .context("semantic search is not enabled")?
                        .search(&nl_query, 10)
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
                            format!("{}, {relative_path}", self.path_alias(relative_path))
                        })
                        .collect::<HashSet<_>>()
                        .into_iter()
                        .collect();

                    paths.append(&mut semantic_paths);
                }

                Some("§alias, path".to_owned())
                    .into_iter()
                    .chain(paths)
                    .collect::<Vec<_>>()
                    .join("\n")
            }

            Action::File(file_ref) => {
                // Retrieve the contents of a file.

                let path = match &file_ref {
                    FileRef::Alias(idx) => self
                        .path_aliases
                        .get(*idx)
                        .with_context(|| format!("unknown path alias {idx}"))?,

                    FileRef::Path(p) => p,
                };

                ctx.app
                    .indexes
                    .file
                    .by_path(&self.repo_ref, path)
                    .await?
                    .content
            }

            Action::Code(query) => {
                // Semantic search.

                let nl_query = NLQuery {
                    target: Some(parser::Literal::Plain(Cow::Owned(query))),
                    ..Default::default()
                };

                let chunks = ctx
                    .app
                    .semantic
                    .as_ref()
                    .context("semantic search is not enabled")?
                    .search(&nl_query, 10)
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

            Action::Check(question, path_aliases) => {
                self.check(ctx, question, path_aliases).await?
            }
        };

        self.history.push(llm_gateway::api::Message::user(
            &(question + "\n\nAnswer only with a JSON action."),
        ));

        let stream = ctx.llm_gateway.chat(&self.history).await?.boxed();
        let action_stream = ActionStream {
            tokens: String::new(),
            action: Either::Left(stream),
        };

        Ok(Some(action_stream))
    }

    async fn check(
        &mut self,
        ctx: &AppContext,
        question: String,
        path_aliases: Vec<usize>,
    ) -> Result<String> {
        let paths = path_aliases
            .into_iter()
            .map(|i| self.path_aliases.get(i).ok_or(i))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|i| anyhow!("invalid path alias {i}"))?;

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
            struct Range {
                start: usize,
                end: usize,
                answer: String,
            }

            let explanations = serde_json::from_str::<Vec<Range>>(&json)?
                .into_iter()
                .filter(|r| r.start > 0 && r.end > 0)
                .map(|r| {
                    let end = r.end.min(r.start + 10);

                    serde_json::json!({
                        "start": r.start,
                        "answer": r.answer,
                        "end": end,
                        "relevant_code": lines[r.start..end].join("\n"),
                    })
                })
                .collect::<Vec<_>>();

            Ok::<_, anyhow::Error>(serde_json::json!({
                "explanations": explanations,
                "path": path,
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
        update: &mut UpdateStream,
        question: &str,
    ) -> Result<()> {
        let messages = self
            .history
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
                .collect::<Vec<_>>();

            update.set_results(search_results);

            update.send().await?;
        }

        update.clear_current_message();

        Ok(())
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
    File(FileRef),
    Check(String, Vec<usize>),
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(untagged)]
enum FileRef {
    Path(String),
    Alias(usize),
}

impl Action {
    /// Map this action to a summary update.
    fn update(&self) -> SearchStep {
        match self {
            Self::Answer(..) => SearchStep::_Custom("ANSWER".into(), "Answering query".into()),
            Self::Prompt(_) => SearchStep::_Custom("PROMPT".into(), "Awaiting prompt".into()),
            Self::Query(..) => SearchStep::Query("Processing query".into()),
            Self::Code(f) => SearchStep::Code(format!("Performing semantic search")),
            Self::Path(p) => SearchStep::Path(format!("Searching paths")),
            Self::File(..) => SearchStep::File(format!("Retrieving file contents")),
            Self::Check(..) => SearchStep::File(format!("Checking files")),
        }
    }

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
            array.pop().unwrap_or(serde_json::Value::Null)
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

#[derive(serde::Serialize)]
enum Update {
    Prompt(String),
    Answer(String),
    ProcessingQuery,
    SearchingFiles,
    Answering,
    LoadingFiles,
}

struct UpdateStream {
    sender: Option<Sender<FullUpdate>>,

    // past messages of this conversation
    history: Vec<llm_gateway::api::Message>,

    // the message currently being produced
    current_message: AssistantMessage,

    // auxilliary data that has no other place to go
    thread_id: String,
    user_id: String,
}

impl UpdateStream {
    // initialize the update stream, given an existing conversation history
    fn new(conversation_id: &ConversationId, conversation: &Conversation) -> Self {
        let history = conversation.history.clone();
        let current_message = AssistantMessage::default();
        let thread_id = conversation_id.thread_id.clone();
        let user_id = conversation_id.user_id.clone();

        Self {
            sender: None,
            history,
            current_message,
            thread_id,
            user_id,
        }
    }

    fn set_tx(&mut self, sender: Sender<FullUpdate>) {
        self.sender = Some(sender);
    }

    fn build_update(&self) -> FullUpdate {
        let messages = self
            .history
            .iter()
            .filter_map(|llm_message| match llm_message.role.as_str() {
                "user" => Some(UpdatableMessage::User(UserMessage {
                    content: llm_message.content.clone(),
                })),
                "assistant" => Some(UpdatableMessage::Assistant(AssistantMessage {
                    content: Some(llm_message.content.clone()),
                    status: MessageStatus::Finished,
                    ..Default::default()
                })),
                _ => None,
            })
            .chain(std::iter::once(UpdatableMessage::Assistant(
                self.current_message.clone(),
            )))
            .collect::<Vec<_>>();

        FullUpdate {
            thread_id: self.thread_id.clone(),
            user_id: self.user_id.clone(),
            description: Some("New conversation".into()), // TODO: fill this out cleverly
            messages,
        }
    }

    fn finish_message(&mut self) {
        self.current_message.status = MessageStatus::Finished;
    }

    fn clear_current_message(&mut self) {
        self.current_message = AssistantMessage::default();
    }

    fn add_search_step(&mut self, step: SearchStep) {
        self.current_message.search_steps.push(step);
    }

    // - populates message.results
    // - if a conclusion exists, sets message.content to the conclusion
    fn set_results(&mut self, mut results: Vec<SearchResult>) {
        let conclusion = results
            .iter()
            .position(SearchResult::is_conclusion)
            .and_then(|idx| {
                self.finish_message();
                results.remove(idx).conclusion()
            });

        self.current_message.results = results;
        self.current_message.content = conclusion;
    }

    async fn send(&self) -> Result<()> {
        if let Some(s) = &self.sender {
            s.send(self.build_update())
                .await
                .or(Err(anyhow!("failed to send update")))
        } else {
            Err(anyhow!("failed to send update"))
        }
    }
}

#[derive(serde::Serialize, Debug, Clone, Default)]
struct FullUpdate {
    thread_id: String,
    user_id: String,
    description: Option<String>,
    messages: Vec<UpdatableMessage>,
}

#[derive(serde::Serialize, Debug, Clone)]
#[serde(tag = "role", rename_all = "lowercase")]
enum UpdatableMessage {
    User(UserMessage),
    Assistant(AssistantMessage),
}

#[derive(serde::Serialize, Debug, Clone)]
struct UserMessage {
    content: String,
}

#[derive(serde::Serialize, Debug, Clone, Default)]
struct AssistantMessage {
    status: MessageStatus,
    content: Option<String>,
    search_steps: Vec<SearchStep>,
    results: Vec<SearchResult>,
}

#[derive(serde::Serialize, Debug, Copy, Clone, Default)]
#[serde(rename_all = "UPPERCASE")]
enum MessageStatus {
    Finished,

    #[default]
    Loading,
}

#[derive(serde::Serialize, Debug, Clone)]
#[serde(rename_all = "UPPERCASE")]
#[non_exhaustive]
enum SearchStep {
    Query(String),
    Path(String),
    Code(String),
    Check(String),
    File(String),

    // step type, step content
    _Custom(String, String),
}

#[derive(serde::Serialize, Debug, Clone)]
enum SearchResult {
    Cite(CiteResult),
    New(NewResult),
    Modify(ModifyResult),
    Conclude(ConcludeResult),
}

impl SearchResult {
    fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let tag = v.first()?;

        match tag.as_str()? {
            "cite" => Some(Self::Cite(CiteResult::from_json_array(&v[1..]))),
            "con" => Some(Self::Conclude(ConcludeResult::from_json_array(&v[1..]))),
            "new" => Some(Self::New(NewResult::from_json_array(&v[1..]))),
            _ => None,
        }
    }

    fn is_conclusion(&self) -> bool {
        matches!(self, Self::Conclude(..))
    }

    fn conclusion(self) -> Option<String> {
        match self {
            Self::Conclude(ConcludeResult { comment }) => comment,
            _ => None,
        }
    }
}

#[derive(serde::Serialize, Debug, Clone)]
struct CiteResult {
    path_alias: Option<u64>,
    comment: Option<String>,
    start_line: Option<u64>,
    end_line: Option<u64>,
}

#[derive(serde::Serialize, Debug, Clone)]
struct NewResult {
    language: Option<String>,
    code: Option<String>,
}

#[derive(serde::Serialize, Debug, Clone)]
struct ModifyResult {}

#[derive(serde::Serialize, Debug, Clone)]
struct ConcludeResult {
    comment: Option<String>,
}

impl CiteResult {
    fn from_json_array(v: &[serde_json::Value]) -> Self {
        let path_alias = v.get(0).and_then(serde_json::Value::as_u64);
        let comment = v
            .get(1)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        let start_line = v.get(2).and_then(serde_json::Value::as_u64);
        let end_line = v.get(3).and_then(serde_json::Value::as_u64);
        Self {
            path_alias,
            comment,
            start_line,
            end_line,
        }
    }
}

impl NewResult {
    fn from_json_array(v: &[serde_json::Value]) -> Self {
        let language = v
            .get(0)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        let code = v
            .get(1)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        Self { language, code }
    }
}

impl ConcludeResult {
    fn from_json_array(v: &[serde_json::Value]) -> Self {
        let comment = v
            .get(0)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        Self { comment }
    }
}

/// An action that may not have finished loading yet.
struct ActionStream {
    tokens: String,
    action: Either<BoxStream<'static, Result<String>>, Action>,
}

impl ActionStream {
    /// Load this action, consuming the stream if required.
    async fn load(mut self, update: &mut UpdateStream) -> Result<(Action, String)> {
        let mut stream = match self.action {
            Either::Left(stream) => stream,
            Either::Right(action) => {
                update.add_search_step(action.update());
                update
                    .send()
                    .await
                    .or(Err(anyhow!("failed to send update")))?;
                return Ok((action, self.tokens));
            }
        };

        while let Some(token) = stream.next().await {
            self.tokens += &token?;
        }

        let action = Action::deserialize_gpt(&self.tokens)?;
        update.add_search_step(action.update());
        update
            .send()
            .await
            .or(Err(anyhow!("failed to send update")))?;

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
