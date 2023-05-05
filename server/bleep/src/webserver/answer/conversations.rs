use axum::{
    extract::{Path, Query},
    response::IntoResponse,
    Extension, Json,
};
use reqwest::StatusCode;

use crate::{
    db,
    webserver::{self, middleware::User, Error, ErrorKind},
};

use super::{Conversation, ConversationId};

#[derive(serde::Serialize)]
pub struct ConversationPreview {
    pub thread_id: String,
    pub created_at: i64,
    pub title: String,
}

pub(in crate::webserver) async fn list(
    Extension(user): Extension<User>,
) -> webserver::Result<impl IntoResponse> {
    let db = db::get().await?;

    let user_id = user.0.ok_or_else(|| Error::user("missing user ID"))?;

    let conversations = sqlx::query_as! {
        ConversationPreview,
        "SELECT thread_id, created_at, title \
         FROM conversations \
         WHERE user_id = ? \
         ORDER BY created_at DESC",
        user_id,
    }
    .fetch_all(db)
    .await
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
) -> webserver::Result<()> {
    let db = db::get().await?;
    let user_id = user.0.ok_or_else(|| Error::user("missing user ID"))?;

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
) -> webserver::Result<impl IntoResponse> {
    let user_id = user.0.ok_or_else(|| Error::user("missing user ID"))?;
    let conversation = Conversation::load(&ConversationId { thread_id, user_id })
        .await?
        .ok_or_else(|| Error::new(ErrorKind::NotFound, "thread was not found"))?;

    Ok(Json(conversation.exchanges))
}
