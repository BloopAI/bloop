use std::{ops::Deref, str::FromStr, sync::Arc, time::Duration};

use anyhow::{anyhow, Context, Result};
use futures::{Future, TryStreamExt};
use tokio::sync::mpsc::Sender;
use tracing::{debug, error, info, instrument};

use crate::{
    agent::exchange::RepoPath,
    indexes::reader::{ContentDocument, FileDocument},
    llm::client::{api, Client},
    query::{parser, stopwords::remove_stopwords},
    repo::RepoRef,
    semantic::{self, SemanticSearchParams},
    webserver::{conversation::Conversation, middleware::User},
    Application,
};

use self::exchange::{Exchange, SearchStep, Update};

/// The maximum number of steps the agent will take before forcing an answer.
const MAX_STEPS: usize = 10;

pub mod exchange;
pub mod model;
pub mod prompts;
pub mod symbol;
pub mod transcoder;

/// A collection of modules that each add methods to `Agent`.
///
/// These methods correspond to `Action` handlers, and often have supporting methods and supporting
/// functions, that are local to their own implementation. These modules also have independent
/// tests.
mod tools {
    pub mod answer;
    pub mod code;
    pub mod path;
    pub mod proc;
}

pub enum Error {
    Timeout(Duration),
    Processing(anyhow::Error),
}

pub struct Agent {
    pub app: Application,
    pub conversation: Conversation,
    pub exchange_tx: Sender<Exchange>,

    pub llm_gateway: Client,
    pub user: User,
    pub query_id: uuid::Uuid,
    pub repo_refs: Vec<RepoRef>,

    pub answer_model: model::LLMModel,
    pub agent_model: model::LLMModel,

    /// Indicate whether the request was answered.
    ///
    /// This is used in the `Drop` handler, in order to track cancelled answer queries.
    pub exchange_state: ExchangeState,
}

pub enum ExchangeState {
    Pending,
    Complete,
    Failed,
}

pub struct AgentSemanticSearchParams<'a> {
    pub query: parser::Literal<'a>,
    pub paths: Vec<RepoPath>,
    pub repos: Vec<RepoRef>,
    pub semantic_params: SemanticSearchParams,
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
        match self.exchange_state {
            ExchangeState::Failed => {}
            ExchangeState::Pending => {
                if std::thread::panicking() {
                } else {
                    self.last_exchange_mut().apply_update(Update::SetTimestamp);
                    tokio::spawn(self.store());
                }
            }

            ExchangeState::Complete => {
                tokio::spawn(self.store());
            }
        }
    }
}

impl Agent {
    /// Complete this agent, preventing an analytics message from sending on drop.
    pub fn complete(&mut self, success: bool) {
        // Checked in `Drop::drop`
        self.exchange_state = if success {
            ExchangeState::Complete
        } else {
            ExchangeState::Failed
        };
    }

    /// Update the last exchange
    #[instrument(skip(self), level = "debug")]
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

    fn last_exchange(&self) -> &Exchange {
        self.conversation
            .exchanges
            .last()
            .expect("exchange list was empty")
    }

    fn last_exchange_mut(&mut self) -> &mut Exchange {
        self.conversation
            .exchanges
            .last_mut()
            .expect("exchange list was empty")
    }

    fn paths(&self) -> impl Iterator<Item = &RepoPath> {
        self.conversation
            .exchanges
            .iter()
            .flat_map(|e| e.paths.iter())
    }

    fn get_path_alias(&mut self, repo_path: &RepoPath) -> usize {
        // This has to be stored a variable due to a Rust NLL bug:
        // https://github.com/rust-lang/rust/issues/51826
        let pos = self.paths().position(|p| p == repo_path);
        if let Some(i) = pos {
            i
        } else {
            let i = self.paths().count();
            self.last_exchange_mut().paths.push(repo_path.clone());
            i
        }
    }

    fn relevant_repos(&self) -> Vec<RepoRef> {
        let query_repos = self.last_exchange().query.repos().collect::<Vec<_>>();

        if query_repos.is_empty() {
            self.repo_refs.clone()
        } else {
            self.repo_refs
                .iter()
                .filter(|r| query_repos.contains(&r.indexed_name().into()))
                .cloned()
                .collect()
        }
    }

    pub async fn step(&mut self, action: Action) -> Result<Option<Action>> {
        info!(?action, %self.conversation.thread_id, "executing next action");

        match &action {
            Action::Query(s) => {
                // Always make a code search for the user query on the first exchange
                if self.conversation.exchanges.len() == 1 {
                    let keywords = {
                        let keys = remove_stopwords(s);
                        if keys.is_empty() {
                            s.clone()
                        } else {
                            keys
                        }
                    };
                    self.code_search(&keywords).await?;
                }
                s.clone()
            }

            Action::Answer { paths } => {
                self.answer(paths).await.context("answer action failed")?;
                return Ok(None);
            }

            Action::Path { query } => self.path_search(query).await?,
            Action::Code { query } => self.code_search(query).await?,
            Action::Proc { query, paths } => self.process_files(query, paths).await?,
        };

        if self.last_exchange().search_steps.len() >= MAX_STEPS {
            return Ok(Some(Action::Answer {
                paths: self.paths().enumerate().map(|(i, _)| i).collect(),
            }));
        }

        let functions = serde_json::from_value::<Vec<api::Function>>(
            prompts::functions(self.paths().next().is_some()), // Only add proc if there are paths in context
        )
        .unwrap();

        let mut history = vec![api::Message::system(&prompts::system(self.paths()))];
        history.extend(self.history()?);

        let trimmed_history = trim_history(history.clone(), self.agent_model)?;

        let raw_response = self
            .llm_gateway
            .chat_stream(&trimmed_history, Some(&functions))
            .await?
            .try_fold(api::FunctionCall::default(), |acc, e| async move {
                let e: api::FunctionCall = serde_json::from_str(&e).map_err(|err| {
                    tracing::error!(
                        "Failed to deserialize to FunctionCall: {:?}. Error: {:?}",
                        e,
                        err
                    );
                    err
                })?;
                Ok(api::FunctionCall {
                    name: acc.name.or(e.name),
                    arguments: acc.arguments + &e.arguments,
                })
            })
            .await
            .context("failed to fold LLM function call output")?;

        let action =
            Action::deserialize_gpt(&raw_response).context("failed to deserialize LLM output")?;

        Ok(Some(action))
    }

    /// The full history of messages, including intermediate function calls
    fn history(&self) -> Result<Vec<api::Message>> {
        const ANSWER_MAX_HISTORY_SIZE: usize = 3;
        const FUNCTION_CALL_INSTRUCTION: &str = "Call a function. Do not answer";

        let history = self
            .conversation
            .exchanges
            .iter()
            .rev()
            .take(ANSWER_MAX_HISTORY_SIZE)
            .rev()
            .try_fold(Vec::new(), |mut acc, e| -> Result<_> {
                let query = e
                    .query()
                    .map(|q| api::Message::user(&q))
                    .ok_or_else(|| anyhow!("query does not have target"))?;

                let steps = e.search_steps.iter().flat_map(|s| {
                    let (name, arguments) = match s {
                        SearchStep::Path { query, .. } => (
                            "path".to_owned(),
                            format!("{{\n \"query\": \"{query}\"\n}}"),
                        ),
                        SearchStep::Code { query, .. } => (
                            "code".to_owned(),
                            format!("{{\n \"query\": \"{query}\"\n}}"),
                        ),
                        SearchStep::Proc { query, paths, .. } => (
                            "proc".to_owned(),
                            format!(
                                "{{\n \"paths\": [{}],\n \"query\": \"{query}\"\n}}",
                                paths
                                    .iter()
                                    .map(|path| self
                                        .paths()
                                        .position(|p| p == path)
                                        .unwrap()
                                        .to_string())
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            ),
                        ),
                    };

                    vec![
                        api::Message::function_call(&api::FunctionCall {
                            name: Some(name.clone()),
                            arguments,
                        }),
                        api::Message::function_return(&name, &s.get_response()),
                        api::Message::user(FUNCTION_CALL_INSTRUCTION),
                    ]
                });

                let answer = match e.answer() {
                    // NB: We intentionally discard the summary as it is redundant.
                    Some(answer) => {
                        let encoded = transcoder::encode_summarized(answer, "gpt-3.5-turbo")?;
                        Some(api::Message::function_return("none", &encoded))
                    }

                    None => None,
                };

                acc.extend(
                    std::iter::once(query)
                        .chain(vec![api::Message::user(FUNCTION_CALL_INSTRUCTION)])
                        .chain(steps)
                        .chain(answer.into_iter()),
                );
                Ok(acc)
            })?;
        Ok(history)
    }

    #[allow(clippy::too_many_arguments)]
    async fn semantic_search(
        &self,
        AgentSemanticSearchParams {
            query,
            paths,
            repos,
            semantic_params,
        }: AgentSemanticSearchParams<'_>,
    ) -> Result<Vec<semantic::Payload>> {
        let paths_set = paths
            .into_iter()
            .map(|p| parser::Literal::Plain(p.path.into()))
            .collect::<Vec<_>>();

        let paths = if paths_set.is_empty() {
            self.last_exchange().query.paths.clone()
        } else if self.last_exchange().query.paths.is_empty() {
            paths_set
        } else {
            paths_set
                .into_iter()
                .zip(self.last_exchange().query.paths.clone())
                .flat_map(|(llm, user)| {
                    if llm
                        .as_plain()
                        .unwrap()
                        .starts_with(user.as_plain().unwrap().as_ref())
                    {
                        // llm-defined is more specific than user request
                        vec![llm]
                    } else if user
                        .as_plain()
                        .unwrap()
                        .starts_with(llm.as_plain().unwrap().as_ref())
                    {
                        // user-defined is more specific than llm request
                        vec![user]
                    } else {
                        vec![llm, user]
                    }
                })
                .collect()
        };

        let query = parser::SemanticQuery {
            target: Some(query),
            repos: repos
                .iter()
                .map(RepoRef::indexed_name)
                .map(|r| parser::Literal::Plain(r.into()))
                .collect(),
            paths,
            ..self.last_exchange().query.clone()
        };

        debug!(?query, %self.conversation.thread_id, "executing semantic query");
        self.app.semantic.search(&query, semantic_params).await
    }

    async fn get_file_content(
        &self,
        RepoPath { repo, path }: &RepoPath,
    ) -> Result<Option<ContentDocument>> {
        let branch = self.last_exchange().query.first_branch();

        debug!(%repo, path, ?branch, %self.conversation.thread_id, "executing file search");
        self.app
            .indexes
            .file
            .by_path(repo, path, branch.as_deref())
            .await
            .with_context(|| format!("failed to read path: {}", path))
    }

    async fn fuzzy_path_search<'a>(
        &'a self,
        query: &str,
    ) -> impl Iterator<Item = FileDocument> + 'a {
        let langs = self.last_exchange().query.langs.iter().map(Deref::deref);
        let user_id = "1";

        let (repos, branches): (Vec<_>, Vec<_>) = sqlx::query! {
            "SELECT pr.repo_ref, pr.branch
            FROM project_repos pr
            INNER JOIN projects p ON p.id = pr.project_id AND p.user_id = ?",
            user_id,
        }
        .fetch_all(&*self.app.sql)
        .await
        .expect("failed to fetch repo associations")
        .into_iter()
        .filter_map(|row| {
            let repo_ref = RepoRef::from_str(&row.repo_ref).ok()?;
            Some((repo_ref, row.branch))
        })
        .filter(|(repo_ref, _)| self.repo_refs.contains(repo_ref))
        .unzip();

        let branch = branches.first().cloned().flatten();

        debug!(?query, ?branch, %self.conversation.thread_id, "executing fuzzy search");
        self.app
            .indexes
            .file
            .skim_fuzzy_path_match(repos.into_iter(), query, branch.as_deref(), langs, 50)
            .await
    }

    /// Store the conversation in the DB.
    ///
    /// This allows us to make subsequent requests.
    // NB: This isn't an `async fn` so as to not capture a lifetime.
    fn store(&mut self) -> impl Future<Output = ()> {
        let sql = Arc::clone(&self.app.sql);

        let user_id = "1".to_string();

        let conversation = self.conversation.clone();

        async move {
            conversation.store(&sql, &user_id).await.expect("failed to store conversation");
        }
    }
}

fn trim_history(
    mut history: Vec<api::Message>,
    model: model::LLMModel,
) -> Result<Vec<api::Message>> {
    const HIDDEN: &str = "[HIDDEN]";

    let mut tiktoken_msgs = history.iter().map(|m| m.into()).collect::<Vec<_>>();

    while tiktoken_rs::get_chat_completion_max_tokens(model.tokenizer, &tiktoken_msgs)?
        < model.history_headroom
    {
        let _ = history
            .iter_mut()
            .zip(tiktoken_msgs.iter_mut())
            .position(|(m, tm)| match m {
                api::Message::PlainText {
                    role,
                    ref mut content,
                } => {
                    if role == "assistant" && content != HIDDEN {
                        *content = HIDDEN.into();
                        tm.content = Some(HIDDEN.into());
                        true
                    } else {
                        false
                    }
                }
                api::Message::FunctionReturn {
                    role: _,
                    name: _,
                    ref mut content,
                } if content != HIDDEN => {
                    *content = HIDDEN.into();
                    tm.content = Some(HIDDEN.into());
                    true
                }
                _ => false,
            })
            .ok_or_else(|| anyhow!("could not find message to trim"))?;
    }

    Ok(history)
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Action {
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
    fn deserialize_gpt(call: &api::FunctionCall) -> Result<Self> {
        let mut map = serde_json::Map::new();
        map.insert(
            call.name.clone().unwrap(),
            serde_json::from_str(&call.arguments)?,
        );

        Ok(serde_json::from_value(serde_json::Value::Object(map))?)
    }
}
