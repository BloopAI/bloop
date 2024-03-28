use std::{panic::AssertUnwindSafe, time::Duration};

use anyhow::{anyhow, Context, Result};
use axum::{
    extract::{Path, Query},
    response::{
        sse::{self, Sse},
        IntoResponse,
    },
    Extension,
};
use futures::{future::Either, stream, StreamExt};
use tracing::{debug, error, info, warn};

use super::middleware::User;
use crate::{
    agent::{
        self,
        exchange::{CodeChunk, Exchange, FocusedChunk, RepoPath},
        Action, Agent, ExchangeState,
    },
    db::QueryLog,
    query::parser::{self, Literal},
    repo::RepoRef,
    webserver::conversation::Conversation,
    Application,
};

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

#[derive(Clone, Debug, serde::Deserialize)]
pub struct Answer {
    pub q: String,
    #[serde(default = "default_answer_model")]
    pub answer_model: agent::model::LLMModel,
    #[serde(default = "default_agent_model")]
    pub agent_model: agent::model::LLMModel,
    /// Optional id of the parent of the exchange to overwrite
    /// If this UUID is nil, then overwrite the first exchange in the thread
    pub parent_exchange_id: Option<uuid::Uuid>,
    pub conversation_id: Option<i64>,
}

fn default_answer_model() -> agent::model::LLMModel {
    agent::model::GPT_4_TURBO_24K
}

fn default_agent_model() -> agent::model::LLMModel {
    agent::model::GPT_4
}

pub(super) async fn answer(
    Query(params): Query<Answer>,
    Extension(app): Extension<Application>,
    Extension(user): Extension<User>,
    Path(project_id): Path<i64>,
) -> super::Result<impl IntoResponse> {
    info!(?params.q, "handling /answer query");
    let query_id = uuid::Uuid::new_v4();

    let user_id = user.username().ok_or_else(super::no_user_id)?;

    let mut conversation = match params.conversation_id {
        Some(conversation_id) => {
            Conversation::load(&app.sql, user_id, project_id, conversation_id).await?
        }
        None => Conversation::new(project_id),
    };

    let Answer {
        parent_exchange_id,
        q,
        ..
    } = &params;

    if let Some(parent_exchange_id) = parent_exchange_id {
        let truncate_from_index = if parent_exchange_id.is_nil() {
            0
        } else {
            conversation
                .exchanges
                .iter()
                .position(|e| e.id == *parent_exchange_id)
                .ok_or_else(|| super::Error::user("parent query id not found in exchanges"))?
                + 1
        };

        conversation.exchanges.truncate(truncate_from_index);
    }

    let query = parser::parse_nl(q).context("parse error")?.into_owned();
    let query_target = query
        .target
        .as_ref()
        .context("query was empty")?
        .as_plain()
        .context("user query was not plain text")?
        .clone()
        .into_owned();

    debug!(?query_target, "parsed query target");

    let action = Action::Query(query_target);
    conversation.exchanges.push(Exchange::new(query_id, query));

    AgentExecutor {
        params: params.clone(),
        app: app.clone(),
        user: user.clone(),
        query_id,
        project_id,
        conversation,
        action,
    }
    .execute()
    .await
}

#[derive(Clone)]
struct AgentExecutor {
    params: Answer,
    app: Application,
    user: User,
    query_id: uuid::Uuid,
    project_id: i64,
    conversation: Conversation,
    action: Action,
}

#[allow(clippy::large_enum_variant)]
#[derive(serde::Serialize)]
enum AnswerEvent {
    ChatEvent(Exchange),
    StreamEnd(StreamEnd),
}

#[derive(serde::Serialize)]
struct StreamEnd {
    thread_id: String,
    query_id: uuid::Uuid,
    conversation_id: i64,
}

type SseDynStream<T> = Sse<std::pin::Pin<Box<dyn tokio_stream::Stream<Item = T> + Send>>>;

impl AgentExecutor {
    /// Like `try_execute`, but additionally logs errors in our analytics.
    async fn execute(&mut self) -> super::Result<SseDynStream<Result<sse::Event>>> {
        let response = self.try_execute().await;

        if let Err(err) = response.as_ref() {
            error!(?err, "failed to handle /answer query");
        }

        response
    }

    async fn try_execute(&mut self) -> super::Result<SseDynStream<Result<sse::Event>>> {
        QueryLog::new(&self.app.sql).insert(&self.params.q).await?;

        let username = self.user.username().ok_or_else(super::no_user_id)?;

        let repo_refs = sqlx::query! {
            "SELECT repo_ref
            FROM project_repos
            WHERE project_id = $1 AND EXISTS (
                SELECT id
                FROM projects
                WHERE id = $1 AND user_id = $2
            )",
            self.project_id,
            username,
        }
        .fetch_all(&*self.app.sql)
        .await?
        .into_iter()
        .filter_map(|row| row.repo_ref.parse().ok())
        .collect();

        let llm_gateway = self
            .user
            .llm_gateway(&self.app)
            .await?
            .temperature(0.0)
            .model(self.params.agent_model.model_name);

        // let project: Project = serde_json::from_str(&self.params.project).unwrap();
        let Answer {
            agent_model,
            answer_model,
            ..
        } = self.params.clone();

        let (exchange_tx, exchange_rx) = tokio::sync::mpsc::channel(10);

        let mut action = self.action.clone();
        let mut agent = Agent {
            app: self.app.clone(),
            conversation: self.conversation.clone(),
            exchange_tx,
            llm_gateway,
            user: self.user.clone(),
            query_id: self.query_id,
            repo_refs,
            exchange_state: ExchangeState::Pending,
            answer_model,
            agent_model,
        };

        let stream = async_stream::try_stream! {
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
                        Ok(Either::Left(exchange)) => yield AnswerEvent::ChatEvent(exchange.compressed()),
                        Ok(Either::Right(next_action)) => match next_action {
                            Ok(n) => break next = n,
                            Err(e) => break 'outer Err(agent::Error::Processing(e)),
                        },
                        Err(_) => break 'outer Err(agent::Error::Timeout(timeout)),
                    }
                }

                // NB: Sending updates after all other `await` points in the final `step` call will
                // likely not return a pending future due to the internal receiver queue. So, the call
                // stack usually continues onwards, ultimately resulting in a `Poll::Ready`, backing out
                // of the above loop without ever processing the final message. Here, we empty the
                // queue.
                while let Some(Some(exchange)) = exchange_rx.next().now_or_never() {
                    yield AnswerEvent::ChatEvent(exchange.compressed());
                }

                match next {
                    Some(a) => action = a,
                    None => break Ok(()),
                }
            };

            agent.complete(result.is_ok());

            match result {
                Ok(_) => {
                    let conversation_id = agent.conversation.store(
                        &agent.app.sql,
                        agent.user.username().context("agent failed to get user ID")?,
                    )
                    .await?;

                    let final_message = StreamEnd {
                        thread_id: agent.conversation.thread_id.to_string(),
                        query_id: agent.query_id,
                        conversation_id,
                    };

                    yield AnswerEvent::StreamEnd(final_message);
                }
                Err(agent::Error::Timeout(duration)) => {
                    warn!("Timeout reached.");
                    Err(anyhow!("reached timeout of {duration:?}"))?;
                }
                Err(agent::Error::Processing(e)) => {
                    Err(e)?;
                }
            };
        };

        // We know the stream is unwind safe as it doesn't use synchronization primitives like locks.
        let stream = AssertUnwindSafe(stream)
            .catch_unwind()
            .map(|res| res.unwrap_or_else(|_| Err(anyhow!("stream panicked"))))
            .map(|ex: Result<AnswerEvent>| {
                sse::Event::default()
                    .json_data(ex.map_err(|e| format!("{e:?}")))
                    .map_err(anyhow::Error::new)
            });

        Ok(Sse::new(Box::pin(stream)))
    }
}

#[derive(serde::Deserialize)]
pub struct Explain {
    pub relative_path: String,
    pub line_start: usize,
    pub line_end: usize,
    pub branch: Option<String>,
    pub repo_ref: RepoRef,
    pub conversation_id: Option<i64>,
}

pub async fn explain(
    Query(params): Query<Explain>,
    Extension(app): Extension<Application>,
    Extension(user): Extension<User>,
    Path(project_id): Path<i64>,
) -> super::Result<impl IntoResponse> {
    let query_id = uuid::Uuid::new_v4();
    let repo_path = RepoPath {
        repo: params.repo_ref.clone(),
        path: params.relative_path.clone(),
    };

    // We synthesize a virtual `/answer` request.
    let virtual_req = Answer {
        q: format!(
            "Explain lines {} - {} in {}",
            params.line_start + 1,
            params.line_end + 1,
            params.relative_path
        ),
        conversation_id: params.conversation_id,
        parent_exchange_id: None,
        answer_model: agent::model::GPT_4_TURBO_24K,
        agent_model: agent::model::GPT_4,
    };

    let mut query = parser::parse_nl(&virtual_req.q)
        .context("failed to parse virtual answer query")?
        .into_owned();

    if let Some(branch) = params.branch {
        query.branch.push(Literal::Plain(branch.into()));
    }

    let file_content = app
        .indexes
        .file
        // this unwrap is ok, because we instantiate the `virtual_req` above
        .by_path(&params.repo_ref, &params.relative_path, None)
        .await
        .context("file retrieval failed")?
        .context("did not find requested file")?
        .content;

    let snippet = file_content
        .lines()
        .skip(params.line_start)
        .take(params.line_end - params.line_start)
        .collect::<Vec<_>>()
        .join("\n");

    let mut exchange = Exchange::new(query_id, query);
    exchange.focused_chunk = Some(FocusedChunk {
        repo_path: repo_path.clone(),
        start_line: params.line_start,
        end_line: params.line_end,
    });

    exchange.paths.push(repo_path.clone());
    exchange.code_chunks.push(CodeChunk {
        repo_path: repo_path.clone(),
        alias: 0,
        start_line: params.line_start,
        end_line: params.line_end,
        snippet,
        start_byte: None,
        end_byte: None,
    });

    let mut conversation = Conversation::new(project_id);
    conversation.exchanges.push(exchange);

    let action = Action::Answer { paths: vec![0] };

    AgentExecutor {
        params: virtual_req,
        app,
        user,
        query_id,
        project_id,
        conversation,
        action,
    }
    .execute()
    .await
}
