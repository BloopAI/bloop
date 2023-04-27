use axum::{extract::Query, response::IntoResponse, Extension, Json};
use reqwest::StatusCode;

use crate::{
    db,
    webserver::{self, middleware::User, Error},
};

use super::Conversation;

#[derive(serde::Serialize)]
pub struct ConversationPreview {
    pub thread_id: String,
    pub created_at: i64,
    pub preview: String,
}

pub(in crate::webserver) async fn list(
    Extension(user): Extension<User>,
) -> webserver::Result<impl IntoResponse> {
    let db = db::get().await?;

    let user_id = user.0.ok_or_else(|| Error::user("missing user ID"))?;

    // We create a nested query to fetch all lowest-ordinal "user" messages, grouped by
    // conversation.

    let mut conversations = sqlx::query_as! {
        ConversationPreview,
        "SELECT c.thread_id, c.created_at, messages.content as preview \
         FROM conversations c \
         JOIN ( \
             SELECT conversation_id, min(ordinal) ordinal FROM messages \
             WHERE role = \"user\" \
             GROUP BY conversation_id \
         ) m ON m.conversation_id = c.id \
         JOIN messages ON messages.conversation_id = c.id AND messages.ordinal = m.ordinal \
         WHERE c.user_id = ?",
        user_id,
    }
    .fetch_all(db)
    .await
    .map_err(Error::internal)?;

    // Trim the preview, and only read up to the first newline.
    for conversation in &mut conversations {
        conversation.preview = conversation
            .preview
            .trim()
            .split("\n")
            .next()
            .unwrap_or("")
            .to_owned();
    }

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
