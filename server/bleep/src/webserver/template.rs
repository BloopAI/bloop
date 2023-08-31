use super::{Error, ErrorKind};
use crate::{webserver, Application};
use axum::extract::{Extension, Json, Path};
use chrono::NaiveDateTime;
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct Create {
    name: String,
    content: String,
}

pub async fn create(
    app: Extension<Application>,
    params: Json<Create>,
) -> webserver::Result<String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query!(
        "INSERT INTO templates (id, name, content) VALUES (?, ?, ?)",
        id,
        params.name,
        params.content
    )
    .execute(&*app.sql)
    .await
    .map_err(Error::internal)?;

    Ok(id)
}

#[derive(serde::Serialize)]
pub struct Template {
    id: String,
    name: String,
    modified_at: NaiveDateTime,
    content: String,
}

pub async fn list(app: Extension<Application>) -> webserver::Result<Json<Vec<Template>>> {
    let templates = sqlx::query_as!(
        Template,
        "SELECT id, name, modified_at, content FROM templates"
    )
    .fetch_all(&*app.sql)
    .await
    .map_err(Error::internal)?;

    Ok(Json(templates))
}

pub async fn get(
    app: Extension<Application>,
    Path(id): Path<String>,
) -> webserver::Result<Json<Template>> {
    let template = sqlx::query_as!(
        Template,
        "SELECT id, name, modified_at, content FROM templates WHERE id = ?",
        id
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
    Path(id): Path<String>,
    Json(patch): Json<Patch>,
) -> webserver::Result<()> {
    let mut transaction = app.sql.begin().await.map_err(Error::internal)?;

    // Ensure the ID is valid first.
    sqlx::query!("SELECT id FROM templates WHERE id = ?", id)
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

pub async fn delete(app: Extension<Application>, Path(id): Path<String>) -> webserver::Result<()> {
    sqlx::query!("DELETE FROM templates WHERE id = ? RETURNING id", id)
        .fetch_optional(&*app.sql)
        .await
        .map_err(Error::internal)?
        .ok_or_else(|| Error::new(ErrorKind::NotFound, "unknown template ID"))
        .map(|_| ())
}
