use super::{middleware::User, Error, ErrorKind};
use crate::{webserver, Application};
use axum::extract::{Extension, Json, Path};
use chrono::NaiveDateTime;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Create {
    name: String,
    content: String,
}

pub async fn create(
    app: Extension<Application>,
    user: Extension<User>,
    params: Json<Create>,
) -> webserver::Result<String> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let id = sqlx::query!(
        "INSERT INTO templates (name, content, user_id) VALUES (?, ?, ?)",
        params.name,
        params.content,
        user_id,
    )
    .execute(&*app.sql)
    .await
    .map_err(Error::internal)?
    .last_insert_rowid();

    Ok(id.to_string())
}

#[derive(serde::Serialize)]
pub struct Template {
    id: i64,
    name: String,
    modified_at: NaiveDateTime,
    content: String,
}

pub async fn list(
    app: Extension<Application>,
    user: Extension<User>,
) -> webserver::Result<Json<Vec<Template>>> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let templates = sqlx::query_as!(
        Template,
        "SELECT id, name, modified_at, content FROM templates WHERE user_id = ?",
        user_id,
    )
    .fetch_all(&*app.sql)
    .await
    .map_err(Error::internal)?;

    Ok(Json(templates))
}

pub async fn get(
    app: Extension<Application>,
    user: Extension<User>,
    Path(id): Path<String>,
) -> webserver::Result<Json<Template>> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let template = sqlx::query_as!(
        Template,
        "SELECT id, name, modified_at, content FROM templates WHERE id = ? AND user_id = ?",
        id,
        user_id,
    )
    .fetch_optional(&*app.sql)
    .await
    .map_err(Error::internal)?
    .ok_or_else(|| Error::new(ErrorKind::NotFound, "Template not found"))?;

    Ok(Json(template))
}

#[derive(Deserialize)]
pub struct Patch {
    name: Option<String>,
    content: Option<String>,
}

pub async fn patch(
    app: Extension<Application>,
    user: Extension<User>,
    Path(id): Path<String>,
    Json(patch): Json<Patch>,
) -> webserver::Result<()> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let mut transaction = app.sql.begin().await.map_err(Error::internal)?;

    // Ensure the ID is valid first.
    sqlx::query!(
        "SELECT id FROM templates WHERE id = ? AND user_id = ?",
        id,
        user_id
    )
    .fetch_optional(&mut transaction)
    .await
    .map_err(Error::internal)?
    .ok_or_else(|| Error::new(ErrorKind::NotFound, "unknown template ID"))?;

    if let Some(name) = patch.name {
        sqlx::query!("UPDATE templates SET name = ? WHERE id = ?", name, id)
            .execute(&mut transaction)
            .await
            .map_err(Error::internal)?;
    }

    if let Some(content) = patch.content {
        sqlx::query!("UPDATE templates SET content = ? WHERE id = ?", content, id)
            .execute(&mut transaction)
            .await
            .map_err(Error::internal)?;
    }

    sqlx::query!(
        "UPDATE templates SET modified_at = datetime('now') WHERE id = ?",
        id
    )
    .execute(&mut transaction)
    .await
    .map_err(Error::internal)?;

    transaction.commit().await.map_err(Error::internal)?;

    Ok(())
}

pub async fn delete(
    app: Extension<Application>,
    user: Extension<User>,
    Path(id): Path<String>,
) -> webserver::Result<()> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    sqlx::query!(
        "DELETE FROM templates WHERE id = ? AND user_id = ? RETURNING id",
        id,
        user_id
    )
    .fetch_optional(&*app.sql)
    .await
    .map_err(Error::internal)?
    .ok_or_else(|| Error::new(ErrorKind::NotFound, "unknown template ID"))
    .map(|_| ())
}
