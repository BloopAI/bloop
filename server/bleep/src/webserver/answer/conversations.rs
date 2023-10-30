use anyhow::{Context, Result};
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Extension, Json,
};
use reqwest::StatusCode;
use std::fmt;
use tracing::info;

use crate::{
    agent::{exchange::Exchange, Project},
    db::SqlDb,
    repo::RepoRef,
    webserver::{self, middleware::User, Error, ErrorKind},
    Application,
};

pub type Conversation = (Project, Vec<Exchange>);

#[derive(Hash, PartialEq, Eq, Clone)]
pub struct ConversationId {
    pub thread_id: uuid::Uuid,
    pub user_id: String,
}

impl fmt::Display for ConversationId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}::{}", self.user_id, self.thread_id)
    }
}

#[derive(serde::Serialize)]
pub struct ConversationPreview {
    pub thread_id: String,
    pub created_at: i64,
    pub title: String,
}

#[derive(serde::Deserialize)]
pub(in crate::webserver) struct List {
    repo_ref: Option<RepoRef>,
}

pub(in crate::webserver) async fn list(
    Extension(user): Extension<User>,
    Query(query): Query<List>,
    State(app): State<Application>,
) -> webserver::Result<impl IntoResponse> {
    let db = app.sql.as_ref();
    let user_id = user
        .username()
        .ok_or_else(|| Error::user("missing user ID"))?;

    let conversations = if let Some(repo_ref) = query.repo_ref {
        let repo_ref = repo_ref.to_string();
        sqlx::query_as! {
            ConversationPreview,
            "SELECT thread_id, created_at, title \
             FROM conversations \
             WHERE user_id = ? AND repo_ref = ? \
             ORDER BY created_at DESC",
            user_id,
            repo_ref,
        }
        .fetch_all(db)
        .await
    } else {
        sqlx::query_as! {
            ConversationPreview,
            "SELECT thread_id, created_at, title \
             FROM conversations \
             WHERE user_id = ? \
             ORDER BY created_at DESC",
            user_id,
        }
        .fetch_all(db)
        .await
    }
    .map_err(Error::internal)?;

    Ok(Json(conversations))
}

#[derive(serde::Deserialize)]
pub(in crate::webserver) struct Delete {
    thread_id: String,
}

pub(in crate::webserver) async fn delete(
    Query(params): Query<Delete>,
    Extension(user): Extension<User>,
    State(app): State<Application>,
) -> webserver::Result<()> {
    let db = app.sql.as_ref();
    let user_id = user
        .username()
        .ok_or_else(|| Error::user("missing user ID"))?;

    let result = sqlx::query! {
        "DELETE FROM conversations WHERE user_id = ? AND thread_id = ?",
        user_id,
        params.thread_id,
    }
    .execute(db)
    .await
    .map_err(Error::internal)?;

    if result.rows_affected() == 0 {
        return Err(Error::user("conversation not found").with_status(StatusCode::NOT_FOUND));
    }

    Ok(())
}

pub(in crate::webserver) async fn thread(
    Path(thread_id): Path<uuid::Uuid>,
    Extension(user): Extension<User>,
    State(app): State<Application>,
) -> webserver::Result<impl IntoResponse> {
    let user_id = user
        .username()
        .ok_or_else(|| Error::user("missing user ID"))?
        .to_owned();

    let exchanges = load(&app.sql, &ConversationId { thread_id, user_id })
        .await?
        .ok_or_else(|| Error::new(ErrorKind::NotFound, "thread was not found"))?;

    let exchanges = exchanges
        .into_iter()
        .map(|ex| ex.compressed())
        .collect::<Vec<_>>();

    Ok(Json(exchanges))
}

pub async fn store(db: &SqlDb, id: ConversationId, conversation: Conversation) -> Result<()> {
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

    let (project, exchanges) = conversation;
    let repo_ref = project.id();
    let title = exchanges
        .first()
        .and_then(|list| list.query())
        .and_then(|q| q.split('\n').next().map(|s| s.to_string()))
        .context("couldn't find conversation title")?;

    let exchanges = serde_json::to_string(&exchanges)?;
    sqlx::query! {
        "INSERT INTO conversations (\
            user_id, thread_id, repo_ref, title, exchanges, created_at\
            ) \
            VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))",
        user_id,
        thread_id,
        repo_ref,
        title,
        exchanges,
    }
    .execute(&mut transaction)
    .await?;

    transaction.commit().await?;

    Ok(())
}

pub async fn load(db: &SqlDb, id: &ConversationId) -> Result<Option<Vec<Exchange>>> {
    let (user_id, thread_id) = (id.user_id.clone(), id.thread_id.to_string());

    let row = sqlx::query! {
        "SELECT repo_ref, exchanges FROM conversations \
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

    let exchanges = serde_json::from_str(&row.exchanges)?;
    Ok(Some(exchanges))
}
