use crate::{webserver, Application};
use axum::{
    extract::{Path, Query},
    Extension, Json,
};
use chrono::NaiveDateTime;

use super::{middleware::User, Error};

fn default_name() -> String {
    "New Project".into()
}

#[derive(serde::Serialize)]
pub struct ListItem {
    id: i64,
    name: String,
    modified_at: Option<NaiveDateTime>,
}

pub async fn list(
    app: Extension<Application>,
    user: Extension<User>,
) -> webserver::Result<Json<Vec<ListItem>>> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    let projects = sqlx::query! {
        "SELECT p.id, p.name, (
            SELECT ss.modified_at
            FROM studio_snapshots ss
            JOIN studios s ON s.project_id = p.id AND ss.studio_id = s.id
            ORDER BY ss.modified_at DESC
            LIMIT 1
        ) AS modified_at
        FROM projects p
        WHERE user_id = ?",
        user_id,
    }
    .fetch_all(&*app.sql)
    .await?
    .into_iter()
    .map(|row| ListItem {
        id: row.id,
        name: row.name.unwrap_or_else(default_name),
        modified_at: row.modified_at,
    })
    .collect();

    Ok(Json(projects))
}

#[derive(serde::Deserialize)]
pub struct Create {
    name: Option<String>,
}

pub async fn create(
    app: Extension<Application>,
    user: Extension<User>,
    Json(params): Json<Create>,
) -> webserver::Result<String> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    let project_id = sqlx::query! {
        "INSERT INTO projects (user_id, name) VALUES (?, ?) RETURNING id",
        user_id,
        params.name,
    }
    .fetch_one(&*app.sql)
    .await?
    .id;

    Ok(project_id.to_string())
}

#[derive(serde::Serialize)]
pub struct Get {
    id: i64,
    name: String,
    modified_at: Option<NaiveDateTime>,
}

pub async fn get(
    app: Extension<Application>,
    user: Extension<User>,
    Path(id): Path<i64>,
) -> webserver::Result<Json<Get>> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    sqlx::query! {
        "SELECT name, (
            SELECT ss.modified_at
            FROM studio_snapshots ss
            JOIN studios s ON s.project_id = $1 AND ss.studio_id = s.id
            ORDER BY ss.modified_at DESC
            LIMIT 1
        ) AS modified_at
        FROM projects
        WHERE id = $1 AND user_id = $2
        LIMIT 1",
        id,
        user_id,
    }
    .fetch_one(&*app.sql)
    .await
    .map_err(Error::not_found)
    .map(|row| Get {
        id,
        name: row.name.unwrap_or_else(default_name),
        modified_at: row.modified_at,
    })
    .map(Json)
}

#[derive(serde::Deserialize)]
pub struct Update {
    name: String,
}

pub async fn update(
    app: Extension<Application>,
    user: Extension<User>,
    Path(id): Path<i64>,
    Json(update): Json<Update>,
) -> webserver::Result<()> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    sqlx::query! {
        "UPDATE projects SET name = ? WHERE id = ? AND user_id = ? RETURNING id",
        update.name,
        id,
        user_id,
    }
    .fetch_one(&*app.sql)
    .await
    .map(|_id| ())
    .map_err(Error::internal)
}
