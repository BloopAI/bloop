use std::{ops::Deref, sync::Arc, time::Duration};

use anyhow::{anyhow, Context, Result};
use futures::{Future, TryStreamExt};
use tokio::sync::mpsc::Sender;
use tracing::{debug, error, info, instrument};

use crate::{
    analytics::{EventData, QueryEvent},
    indexes::reader::{ContentDocument, FileDocument},
    llm_gateway::{self, api::FunctionCall},
    query::{parser, stopwords::remove_stopwords},
    repo::RepoRef,
    semantic,
    webserver::{
        answer::conversations::{self, ConversationId},
        middleware::User,
    },
    Application,
};

use self::exchange::{Exchange, SearchStep, Update};

/// The maximum number of steps the agent will take before forcing an answer.
const MAX_STEPS: usize = 10;

pub mod exchange;
pub mod model;
pub mod prompts;
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
    pub repo_ref: RepoRef,
    pub exchanges: Vec<Exchange>,
    pub exchange_tx: Sender<Exchange>,

    pub llm_gateway: llm_gateway::Client,
    pub user: User,
    pub thread_id: uuid::Uuid,
    pub query_id: uuid::Uuid,

    pub model: model::AnswerModel,

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
                    self.track_query(
                        EventData::output_stage("cancelled")
                            .with_payload("message", "request panicked"),
                    );
                } else {
                    self.last_exchange_mut().apply_update(Update::Cancel);

                    self.track_query(
                        EventData::output_stage("cancelled")
                            .with_payload("message", "request was cancelled"),
                    );

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

    pub fn track_query(&self, data: EventData) {
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

    fn paths(&self) -> impl Iterator<Item = &str> {
        self.exchanges
            .iter()
            .flat_map(|e| e.paths.iter())
            .map(String::as_str)
    }

    fn get_path_alias(&mut self, path: &str) -> usize {
        // This has to be stored a variable due to a Rust NLL bug:
        // https://github.com/rust-lang/rust/issues/51826
        let pos = self.paths().position(|p| p == path);
        if let Some(i) = pos {
            i
        } else {
            let i = self.paths().count();
            self.last_exchange_mut().paths.push(path.to_owned());
            i
        }
    }

    #[instrument(skip(self))]
    pub async fn step(&mut self, action: Action) -> Result<Option<Action>> {
        info!(?action, %self.thread_id, "executing next action");

        match &action {
            Action::Query(s) => {
                self.track_query(EventData::input_stage("query").with_payload("q", s));

                // Always make a code search for the user query on the first exchange
                if self.exchanges.len() == 1 {
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

        let functions = serde_json::from_value::<Vec<llm_gateway::api::Function>>(
            prompts::functions(self.paths().next().is_some()), // Only add proc if there are paths in context
        )
        .unwrap();

        let mut history = vec![llm_gateway::api::Message::system(&prompts::system(
            self.paths(),
        ))];
        history.extend(self.history()?);

        let trimmed_history = trim_history(history.clone(), self.model)?;

        let raw_response = self
            .llm_gateway
            .chat_stream(&trimmed_history, Some(&functions))
            .await?
            .try_fold(
                llm_gateway::api::FunctionCall::default(),
                |acc, e| async move {
                    let e: FunctionCall = serde_json::from_str(&e).map_err(|err| {
                        tracing::error!(
                            "Failed to deserialize to FunctionCall: {:?}. Error: {:?}",
                            e,
                            err
                        );
                        err
                    })?;
                    Ok(FunctionCall {
                        name: acc.name.or(e.name),
                        arguments: acc.arguments + &e.arguments,
                    })
                },
            )
            .await
            .context("failed to fold LLM function call output")?;

        self.track_query(
            EventData::output_stage("llm_reply")
                .with_payload("full_history", &history)
                .with_payload("trimmed_history", &trimmed_history)
                .with_payload("last_message", history.last())
                .with_payload("functions", &functions)
                .with_payload("raw_response", &raw_response)
                .with_payload("model", &self.llm_gateway.model),
        );

        let action =
            Action::deserialize_gpt(&raw_response).context("failed to deserialize LLM output")?;

        Ok(Some(action))
    }

    /// The full history of messages, including intermediate function calls
    fn history(&self) -> Result<Vec<llm_gateway::api::Message>> {
        const ANSWER_MAX_HISTORY_SIZE: usize = 3;
        const FUNCTION_CALL_INSTRUCTION: &str = "Call a function. Do not answer";

        let history = self
            .exchanges
            .iter()
            .rev()
            .take(ANSWER_MAX_HISTORY_SIZE)
            .rev()
            .try_fold(Vec::new(), |mut acc, e| -> Result<_> {
                let query = e
                    .query()
                    .map(|q| llm_gateway::api::Message::user(&q))
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
                        llm_gateway::api::Message::function_call(&FunctionCall {
                            name: Some(name.clone()),
                            arguments,
                        }),
                        llm_gateway::api::Message::function_return(&name, &s.get_response()),
                        llm_gateway::api::Message::user(FUNCTION_CALL_INSTRUCTION),
                    ]
                });

                let answer = match e.answer() {
                    // NB: We intentionally discard the summary as it is redundant.
                    Some((answer, _conclusion)) => {
                        let encoded = transcoder::encode_summarized(answer, None, "gpt-3.5-turbo")?;
                        Some(llm_gateway::api::Message::function_return("none", &encoded))
                    }

                    None => None,
                };

                acc.extend(
                    std::iter::once(query)
                        .chain(vec![llm_gateway::api::Message::user(
                            FUNCTION_CALL_INSTRUCTION,
                        )])
                        .chain(steps)
                        .chain(answer.into_iter()),
                );
                Ok(acc)
            })?;
        Ok(history)
    }

    async fn semantic_search(
        &self,
        query: parser::Literal<'_>,
        paths: Vec<String>,
        limit: u64,
        offset: u64,
        threshold: f32,
        retrieve_more: bool,
    ) -> Result<Vec<semantic::Payload>> {
        let paths_set = paths
            .into_iter()
            .map(|p| parser::Literal::Plain(p.into()))
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
            repos: [parser::Literal::Plain(self.repo_ref.display_name().into())].into(),
            paths,
            ..self.last_exchange().query.clone()
        };

        debug!(?query, %self.thread_id, "executing semantic query");
        self.app
            .semantic
            .search(&query, limit, offset, threshold, retrieve_more)
            .await
    }

    #[allow(dead_code)]
    async fn batch_semantic_search(
        &self,
        queries: Vec<parser::Literal<'_>>,
        limit: u64,
        offset: u64,
        threshold: f32,
        retrieve_more: bool,
    ) -> Result<Vec<semantic::Payload>> {
        let queries = queries
            .iter()
            .map(|q| parser::SemanticQuery {
                target: Some(q.clone()),
                repos: [parser::Literal::Plain(self.repo_ref.display_name().into())].into(),
                ..self.last_exchange().query.clone()
            })
            .collect::<Vec<_>>();

        let queries = queries.iter().collect::<Vec<_>>();

        debug!(?queries, %self.thread_id, "executing semantic query");
        self.app
            .semantic
            .batch_search(queries.as_slice(), limit, offset, threshold, retrieve_more)
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
        let langs = self.last_exchange().query.langs.iter().map(Deref::deref);

        debug!(%self.repo_ref, query, ?branch, %self.thread_id, "executing fuzzy search");
        self.app
            .indexes
            .file
            .fuzzy_path_match(&self.repo_ref, query, branch.as_deref(), langs, 50)
            .await
    }

    /// Store the conversation in the DB.
    ///
    /// This allows us to make subsequent requests.
    // NB: This isn't an `async fn` so as to not capture a lifetime.
    fn store(&mut self) -> impl Future<Output = ()> {
        let sql = Arc::clone(&self.app.sql);
        let conversation = (self.repo_ref.clone(), self.exchanges.clone());
        let conversation_id = self
            .user
            .username()
            .context("didn't have user ID")
            .map(|user_id| ConversationId {
                thread_id: self.thread_id,
                user_id: user_id.to_owned(),
            });

        async move {
            let result = match conversation_id {
                Ok(conversation_id) => {
                    conversations::store(&sql, conversation_id, conversation).await
                }
                Err(e) => Err(e),
            };

            if let Err(e) = result {
                error!("failed to store conversation: {e}");
            }
        }
    }
}

fn trim_history(
    mut history: Vec<llm_gateway::api::Message>,
    model: model::AnswerModel,
) -> Result<Vec<llm_gateway::api::Message>> {
    const HIDDEN: &str = "[HIDDEN]";

    let mut tiktoken_msgs = history.iter().map(|m| m.into()).collect::<Vec<_>>();

    while tiktoken_rs::get_chat_completion_max_tokens(model.tokenizer, &tiktoken_msgs)?
        < model.history_headroom
    {
        let _ = history
            .iter_mut()
            .zip(tiktoken_msgs.iter_mut())
            .position(|(m, tm)| match m {
                llm_gateway::api::Message::PlainText {
                    role,
                    ref mut content,
                } => {
                    if role == "assistant" && content != HIDDEN {
                        *content = HIDDEN.into();
                        tm.content = HIDDEN.into();
                        true
                    } else {
                        false
                    }
                }
                llm_gateway::api::Message::FunctionReturn {
                    role: _,
                    name: _,
                    ref mut content,
                } if content != HIDDEN => {
                    *content = HIDDEN.into();
                    tm.content = HIDDEN.into();
                    true
                }
                _ => false,
            })
            .ok_or_else(|| anyhow!("could not find message to trim"))?;
    }

    Ok(history)
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
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
    fn deserialize_gpt(call: &FunctionCall) -> Result<Self> {
        let mut map = serde_json::Map::new();
        map.insert(
            call.name.clone().unwrap(),
            serde_json::from_str(&call.arguments)?,
        );

        Ok(serde_json::from_value(serde_json::Value::Object(map))?)
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;

    #[test]
    fn test_trimming_history() {
        let long_string = "long string ".repeat(2000);
        let history = vec![
            llm_gateway::api::Message::system("foo"),
            llm_gateway::api::Message::user("bar"),
            llm_gateway::api::Message::assistant("baz"),
            llm_gateway::api::Message::user("box"),
            llm_gateway::api::Message::assistant(&long_string),
            llm_gateway::api::Message::user("fred"),
            llm_gateway::api::Message::assistant("thud"),
            llm_gateway::api::Message::user(&long_string),
            llm_gateway::api::Message::user("corge"),
        ];

        assert_eq!(
            trim_history(history, model::GPT_4).unwrap(),
            vec![
                llm_gateway::api::Message::system("foo"),
                llm_gateway::api::Message::user("bar"),
                llm_gateway::api::Message::assistant("[HIDDEN]"),
                llm_gateway::api::Message::user("box"),
                llm_gateway::api::Message::assistant("[HIDDEN]"),
                llm_gateway::api::Message::user("fred"),
                llm_gateway::api::Message::assistant("thud"),
                llm_gateway::api::Message::user(&long_string),
                llm_gateway::api::Message::user("corge"),
            ]
        );
    }
}
