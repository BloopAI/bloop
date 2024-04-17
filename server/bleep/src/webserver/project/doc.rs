use axum::{extract::Path, Extension, Json};
use chrono::NaiveDateTime;

use crate::{
    webserver::{self, middleware::User, Error},
    Application,
};

#[derive(serde::Serialize)]
pub struct Doc {
    id: i64,
    url: String,
    index_status: String,
    name: Option<String>,
    favicon: Option<String>,
    description: Option<String>,
    modified_at: NaiveDateTime,
}

pub async fn list(
    app: Extension<Application>,
    user: Extension<User>,
    Path(project_id): Path<i64>,
) -> webserver::Result<Json<Vec<Doc>>> {
    let user_id = user
        .username()
        .ok_or_else(webserver::no_user_id)?
        .to_string();

    let docs = sqlx::query_as! {
        Doc,
        "SELECT d.id, d.url, d.index_status, d.name, d.favicon, d.description, d.modified_at
        FROM project_docs pd
        INNER JOIN docs d ON d.id = pd.doc_id
        WHERE project_id = $1 AND EXISTS (
            SELECT p.id
            FROM projects p
            WHERE p.id = $1 AND p.user_id = $2
        )",
        project_id,
        user_id,
    }
    .fetch_all(&*app.sql)
    .await?;

    Ok(Json(docs))
}

#[derive(serde::Deserialize)]
pub struct Add {
    doc_id: i64,
}

pub async fn add(
    app: Extension<Application>,
    user: Extension<User>,
    Path(project_id): Path<i64>,
    Json(params): Json<Add>,
) -> webserver::Result<()> {
    let user_id = user
        .username()
        .ok_or_else(webserver::no_user_id)?
        .to_string();

    sqlx::query! {
        "SELECT id FROM projects WHERE id = ? AND user_id = ?",
        project_id,
        user_id,
    }
    .fetch_optional(&*app.sql)
    .await?
    .ok_or_else(|| Error::not_found("project not found"))?;

    sqlx::query! {
        "INSERT INTO project_docs (project_id, doc_id) VALUES ($1, $2)",
        project_id,
        params.doc_id,
    }
    .execute(&*app.sql)
    .await
    .map(|_| ())
    .map_err(Error::internal)
}

pub async fn delete(
    app: Extension<Application>,
    user: Extension<User>,
    Path((project_id, doc_id)): Path<(i64, i64)>,
) -> webserver::Result<()> {
    let user_id = user
        .username()
        .ok_or_else(webserver::no_user_id)?
        .to_string();

    sqlx::query! {
        "DELETE FROM project_docs
        WHERE project_id = $1 AND doc_id = $2 AND EXISTS (
            SELECT id
            FROM projects
            WHERE id = $1 AND user_id = $3
        )
        RETURNING id",
        project_id,
        doc_id,
        user_id,
    }
    .fetch_optional(&*app.sql)
    .await?
    .map(|_| ())
    .ok_or_else(|| Error::not_found("project doc not found"))
}
