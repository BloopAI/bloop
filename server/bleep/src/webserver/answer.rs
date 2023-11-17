use std::{panic::AssertUnwindSafe, time::Duration};

use anyhow::{anyhow, Context, Result};
use axum::{
    extract::Query,
    response::{
        sse::{self, Sse},
        IntoResponse,
    },
    Extension, Json,
};
use futures::{future::Either, stream, StreamExt};
use reqwest::StatusCode;
use serde_json::json;
use tracing::{debug, error, info, warn};

use self::conversations::ConversationId;

use super::middleware::User;
use crate::{
    agent::{
        self,
        exchange::{CodeChunk, Exchange, FocusedChunk},
        Action, Agent, ExchangeState,
    },
    analytics::{EventData, QueryEvent},
    db::QueryLog,
    query::parser::{self, Literal},
    repo::RepoRef,
    Application,
};

pub mod conversations;

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
pub struct Answer {
    pub q: String,
    pub repo_ref: RepoRef,
    #[serde(default = "default_model")]
    pub model: agent::model::AnswerModel,
    #[serde(default = "default_thread_id")]
    pub thread_id: uuid::Uuid,
    /// Optional id of the parent of the exchange to overwrite
    /// If this UUID is nil, then overwrite the first exchange in the thread
    pub parent_exchange_id: Option<uuid::Uuid>,
}

fn default_thread_id() -> uuid::Uuid {
    uuid::Uuid::new_v4()
}

fn default_model() -> agent::model::AnswerModel {
    agent::model::GPT_3_5_TURBO_FINETUNED
}

pub(super) async fn answer(
    Query(params): Query<Answer>,
    Extension(app): Extension<Application>,
    Extension(user): Extension<User>,
) -> super::Result<impl IntoResponse> {
    info!(?params.q, "handling /answer query");
    let query_id = uuid::Uuid::new_v4();

    let conversation_id = ConversationId {
        user_id: user
            .username()
            .ok_or_else(|| super::Error::user("didn't have user ID"))?
            .to_string(),
        thread_id: params.thread_id,
    };

    let (_, mut exchanges) = conversations::load(&app.sql, &conversation_id)
        .await?
        .unwrap_or_else(|| (params.repo_ref.clone(), Vec::new()));

    let Answer {
        parent_exchange_id,
        q,
        ..
    } = &params;

    if let Some(parent_exchange_id) = parent_exchange_id {
        let truncate_from_index = if parent_exchange_id.is_nil() {
            0
        } else {
            exchanges
                .iter()
                .position(|e| e.id == *parent_exchange_id)
                .ok_or_else(|| super::Error::user("parent query id not found in exchanges"))?
                + 1
        };

        exchanges.truncate(truncate_from_index);
    }

    let query = parser::parse_nl(q).context("parse error")?.first().unwrap().to_owned();
    let query_target = query
        .target
        .as_ref()
        .context("query was empty")?
        .content()
        .context("user query was not a content query")?
        .as_plain()
        .context("user query was not plain text")?
        .clone()
        .into_owned();

    debug!(?query_target, "parsed query target");

    let action = Action::Query(query_target);
    exchanges.push(Exchange::new(query_id, query.into_owned()));

    execute_agent(
        params.clone(),
        app.clone(),
        user.clone(),
        query_id,
        conversation_id,
        exchanges,
        action,
    )
    .await
}

/// Like `try_execute_agent`, but additionally logs errors in our analytics.
async fn execute_agent(
    params: Answer,
    app: Application,
    user: User,
    query_id: uuid::Uuid,
    conversation_id: ConversationId,
    exchanges: Vec<Exchange>,
    action: Action,
) -> super::Result<
    Sse<std::pin::Pin<Box<dyn tokio_stream::Stream<Item = Result<sse::Event>> + Send>>>,
> {
    let response = try_execute_agent(
        params.clone(),
        app.clone(),
        user.clone(),
        query_id,
        conversation_id,
        exchanges,
        action,
    )
    .await;

    if let Err(err) = response.as_ref() {
        error!(?err, "failed to handle /answer query");

        app.track_query(
            &user,
            &QueryEvent {
                query_id,
                thread_id: params.thread_id,
                repo_ref: Some(params.repo_ref),
                data: EventData::output_stage("error")
                    .with_payload("status", err.status.as_u16())
                    .with_payload("message", err.message()),
            },
        );
    }

    response
}

async fn try_execute_agent(
    params: Answer,
    app: Application,
    user: User,
    query_id: uuid::Uuid,
    conversation_id: ConversationId,
    exchanges: Vec<Exchange>,
    mut action: Action,
) -> super::Result<
    Sse<std::pin::Pin<Box<dyn tokio_stream::Stream<Item = Result<sse::Event>> + Send>>>,
> {
    QueryLog::new(&app.sql).insert(&params.q).await?;

    let llm_gateway = user
        .llm_gateway(&app)
        .await?
        .temperature(0.0)
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
        Ok(_) => unreachable!(),
        Err(err) => {
            warn!(
                ?err,
                "failed to check compatibility ... defaulting to `incompatible`"
            );
            let failed_to_check = futures::stream::once(async {
                Ok(sse::Event::default()
                    .json_data(serde_json::json!({"Err": "failed to check compatibility"}))
                    .unwrap())
            });
            return Ok(Sse::new(Box::pin(failed_to_check)));
        }
    };

    let Answer {
        thread_id,
        repo_ref,
        model,
        ..
    } = params.clone();
    let stream = async_stream::try_stream! {
        let (exchange_tx, exchange_rx) = tokio::sync::mpsc::channel(10);

        let mut agent = Agent {
            app,
            repo_ref,
            exchanges,
            exchange_tx,
            llm_gateway,
            user,
            thread_id,
            query_id,
            exchange_state: ExchangeState::Pending,
            model,
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
                    Ok(Either::Left(exchange)) => yield exchange.compressed(),
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
                yield exchange.compressed();
            }

            match next {
                Some(a) => action = a,
                None => break Ok(()),
            }
        };

        agent.complete(result.is_ok());

        match result {
            Ok(_) => {}
            Err(agent::Error::Timeout(duration)) => {
                warn!("Timeout reached.");
                agent.track_query(
                    EventData::output_stage("error")
                        .with_payload("timeout", duration.as_secs()),
                );
                Err(anyhow!("reached timeout of {duration:?}"))?;
            }
            Err(agent::Error::Processing(e)) => {
                agent.track_query(
                    EventData::output_stage("error")
                        .with_payload("message", e.to_string()),
                );
                Err(e)?;
            }
        }
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
                .json_data(ex.map_err(|e| e.to_string()))
                .map_err(anyhow::Error::new)
        });

    let done_stream = futures::stream::once(async { Ok(sse::Event::default().data("[DONE]")) });

    let stream = init_stream.chain(answer_stream).chain(done_stream);

    Ok(Sse::new(Box::pin(stream)))
}

#[derive(serde::Deserialize)]
pub struct Explain {
    pub relative_path: String,
    pub line_start: usize,
    pub line_end: usize,
    pub branch: Option<String>,
    pub repo_ref: RepoRef,
    #[serde(default = "default_thread_id")]
    pub thread_id: uuid::Uuid,
}

pub async fn explain(
    Query(params): Query<Explain>,
    Extension(app): Extension<Application>,
    Extension(user): Extension<User>,
) -> super::Result<impl IntoResponse> {
    let query_id = uuid::Uuid::new_v4();

    // We synthesize a virtual `/answer` request.
    let virtual_req = Answer {
        q: format!(
            "Explain lines {} - {} in {}",
            params.line_start + 1,
            params.line_end + 1,
            params.relative_path
        ),
        repo_ref: params.repo_ref,
        thread_id: params.thread_id,
        parent_exchange_id: None,
        model: agent::model::GPT_4,
    };

    let conversation_id = ConversationId {
        thread_id: params.thread_id,
        user_id: user
            .username()
            .ok_or_else(|| super::Error::user("didn't have user ID"))?
            .to_string(),
    };

    let mut query = parser::parse_nl(&virtual_req.q)
        .context("failed to parse virtual answer query")?
        .remove(0)
        .into_owned();

    if let Some(branch) = params.branch {
        query
            .branch
            .insert(Literal::Plain(std::borrow::Cow::Owned(branch)));
    }

    let file_content = app
        .indexes
        .file
        .by_path(&virtual_req.repo_ref, &params.relative_path, None)
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
        file_path: params.relative_path.clone(),
        start_line: params.line_start,
        end_line: params.line_end,
    });

    exchange.paths.push(params.relative_path.clone());
    exchange.code_chunks.push(CodeChunk {
        path: params.relative_path.clone(),
        alias: 0,
        start_line: params.line_start,
        end_line: params.line_end,
        snippet,
    });

    let action = Action::Answer { paths: vec![0] };

    execute_agent(
        virtual_req,
        app,
        user,
        query_id,
        conversation_id,
        vec![exchange],
        action,
    )
    .await
}
