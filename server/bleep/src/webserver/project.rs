use std::collections::HashMap;

use crate::{webserver, Application};
use axum::{
    extract::{Path, Query},
    Extension, Json,
};
use chrono::NaiveDateTime;
use futures::TryStreamExt;

use super::{middleware::User, repos::Repo, Error};

pub mod doc;
pub mod repo;

fn default_name() -> String {
    "New Project".into()
}

#[derive(serde::Serialize)]
pub struct ListItem {
    id: i64,
    name: String,
    modified_at: Option<NaiveDateTime>,
    most_common_langs: Vec<String>,
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
    .await?;

    let most_common_langs = sqlx::query! {
        "SELECT pr.project_id, pr.repo_ref
        FROM project_repos pr
        JOIN projects p ON p.id = pr.project_id AND p.user_id = ?",
        user_id,
    }
    .fetch_all(&*app.sql)
    .await?
    .into_iter()
    .filter_map(|row| {
        let repo_ref = row.repo_ref.parse().ok()?;
        let pool_entry = app.repo_pool.get(&repo_ref)?;
        let repo = Repo::from((&repo_ref, pool_entry.get()));
        Some((row.project_id, repo.most_common_lang?))
    })
    .fold(
        HashMap::<_, Vec<_>>::new(),
        |mut a, (project_id, most_common_lang)| {
            a.entry(project_id).or_default().push(most_common_lang);
            a
        },
    );

    let list = projects
        .into_iter()
        .map(|row| ListItem {
            id: row.id,
            name: row.name.unwrap_or_else(default_name),
            modified_at: row.modified_at,
            most_common_langs: most_common_langs
                .get(&row.id)
                .map(Vec::clone)
                .unwrap_or_default(),
        })
        .collect();

    Ok(Json(list))
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
    most_common_langs: Vec<String>,
}

pub async fn get(
    app: Extension<Application>,
    user: Extension<User>,
    Path(id): Path<i64>,
) -> webserver::Result<Json<Get>> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    let row = sqlx::query! {
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
    .map_err(Error::not_found)?;

    let most_common_langs = sqlx::query! {
        "SELECT repo_ref
        FROM project_repos
        WHERE project_id = ?",
        id,
    }
    .fetch_all(&*app.sql)
    .await?
    .into_iter()
    .filter_map(|row| row.repo_ref.parse().ok())
    .filter_map(|repo_ref| app.repo_pool.get(&repo_ref))
    .map(|entry| Repo::from((entry.key(), entry.get())))
    .filter_map(|repo| repo.most_common_lang)
    .collect();

    Ok(Json(Get {
        id,
        name: row.name.unwrap_or_else(default_name),
        modified_at: row.modified_at,
        most_common_langs,
    }))
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

pub async fn delete(
    app: Extension<Application>,
    user: Extension<User>,
    Path(id): Path<i64>,
) -> webserver::Result<()> {
    let user_id = user.username().ok_or_else(super::no_user_id)?;

    sqlx::query! {
        "DELETE FROM projects WHERE id = ? AND user_id = ? RETURNING id",
        id,
        user_id,
    }
    .fetch_optional(&*app.sql)
    .await?
    .map(|_id| ())
    .ok_or_else(|| Error::not_found("could not find project"))
}
