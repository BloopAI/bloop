use super::{middleware::User, Error, ErrorKind};
use crate::{webserver, Application};
use anyhow::Context;
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
        .username()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let id = sqlx::query!(
        "INSERT INTO templates (name, content, user_id) VALUES (?, ?, ?)",
        params.name,
        params.content,
        user_id,
    )
    .execute(&*app.sql)
    .await?
    .last_insert_rowid();

    Ok(id.to_string())
}

#[derive(serde::Serialize)]
pub struct Template {
    id: i64,
    name: String,
    modified_at: NaiveDateTime,
    content: String,
    is_default: bool,
}

pub async fn list(
    app: Extension<Application>,
    user: Extension<User>,
) -> webserver::Result<Json<Vec<Template>>> {
    let user_id = user
        .username()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let templates = sqlx::query_as!(
        Template,
        "SELECT id, name, modified_at, content, user_id IS NULL as \"is_default: bool\"
        FROM templates
        WHERE user_id = ? OR user_id IS NULL",
        user_id,
    )
    .fetch_all(&*app.sql)
    .await?;

    Ok(Json(templates))
}

pub async fn get(
    app: Extension<Application>,
    user: Extension<User>,
    Path(id): Path<String>,
) -> webserver::Result<Json<Template>> {
    let user_id = user
        .username()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let template = sqlx::query_as!(
        Template,
        "SELECT id, name, modified_at, content, user_id IS NULL as \"is_default: bool\"
        FROM templates
        WHERE id = ? AND (user_id = ? OR user_id IS NULL)",
        id,
        user_id,
    )
    .fetch_optional(&*app.sql)
    .await?
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
    Path(mut id): Path<i64>,
    Json(patch): Json<Patch>,
) -> webserver::Result<String> {
    let user_id = user
        .username()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let mut transaction = app.sql.begin().await?;

    // Ensure the ID is valid first.
    let template_user_id = sqlx::query!(
        "SELECT user_id FROM templates WHERE id = ? AND (user_id = ? OR user_id IS NULL)",
        id,
        user_id,
    )
    .fetch_optional(&mut transaction)
    .await?
    .map(|row| row.user_id)
    .ok_or_else(|| Error::new(ErrorKind::NotFound, "unknown template ID"))?;

    if template_user_id.is_none() {
        id = sqlx::query! {
            "INSERT INTO templates(name, content, user_id)
            SELECT name, content, ?
            FROM templates
            WHERE id = ?
            RETURNING id",
            user_id,
            id,
        }
        .fetch_one(&mut transaction)
        .await
        .map(|row| row.id)?
        .context("query didn't return new ID")?;
    }

    if let Some(name) = patch.name {
        sqlx::query!("UPDATE templates SET name = ? WHERE id = ?", name, id)
            .execute(&mut transaction)
            .await?;
    }

    if let Some(content) = patch.content {
        sqlx::query!("UPDATE templates SET content = ? WHERE id = ?", content, id)
            .execute(&mut transaction)
            .await?;
    }

    sqlx::query!(
        "UPDATE templates SET modified_at = datetime('now') WHERE id = ?",
        id
    )
    .execute(&mut transaction)
    .await?;

    transaction.commit().await?;

    Ok(id.to_string())
}

pub async fn delete(
    app: Extension<Application>,
    user: Extension<User>,
    Path(id): Path<i64>,
) -> webserver::Result<()> {
    let user_id = user
        .username()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    sqlx::query!(
        "DELETE FROM templates WHERE id = ? AND user_id = ? RETURNING id",
        id,
        user_id
    )
    .fetch_optional(&*app.sql)
    .await?
    .ok_or_else(|| Error::new(ErrorKind::NotFound, "unknown template ID"))
    .map(|_| ())
}
