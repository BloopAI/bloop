use std::ops::Range;

use anyhow::Context;
use axum::{extract::{Query, Path}, Extension, Json};
use chrono::NaiveDateTime;
use futures::{stream, StreamExt, TryStreamExt};
use uuid::Uuid;

use super::{Error, ErrorKind};
use crate::{repo::RepoRef, webserver, Application};

#[derive(serde::Deserialize)]
pub struct Create {
    name: String,
}

pub async fn create(app: Extension<Application>, params: Json<Create>) -> webserver::Result<()> {
    let id = Uuid::new_v4().to_string();

    sqlx::query! {
        "INSERT INTO studios (id, name, context, messages) VALUES (?, ?, ?, ?)",
        id,
        params.name,
        "[]",
        "[]"
    }
    .execute(&*app.sql)
    .await
    .map_err(Error::internal)?;

    Ok(())
}

#[derive(serde::Serialize)]
pub struct ListItem {
    id: String,
    name: String,
    modified_at: NaiveDateTime,
}

pub async fn list(app: Extension<Application>) -> webserver::Result<Json<Vec<ListItem>>> {
    sqlx::query_as! { ListItem, "SELECT id, name, modified_at FROM studios" }
        .fetch_all(&*app.sql)
        .await
        .map_err(Error::internal)
        .map(Json)
}

#[derive(serde::Serialize)]
pub struct Studio {
    name: String,
    modified_at: NaiveDateTime,
    context: Vec<ContextFile>,
    messages: Vec<Message>,
    token_count: usize,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ContextFile {
    path: String,
    hidden: bool,
    repo: RepoRef,
    branch: String,
    ranges: Vec<Range<usize>>,
}

#[derive(serde::Serialize, serde::Deserialize)]
enum Message {
    User(String),
    Assistant(String),
}

pub async fn get(
    app: Extension<Application>,
    Path(id): Path<String>,
) -> webserver::Result<Json<Studio>> {
    let row = sqlx::query! {
        "SELECT id, name, context, messages, modified_at
         FROM studios
         WHERE id = ?",
         id
    }
    .fetch_optional(&*app.sql)
    .await
    .map_err(Error::internal)?
    .ok_or_else(|| Error::new(ErrorKind::NotFound, "unknown studio ID"))?;

    let context: Vec<ContextFile> =
        serde_json::from_str(&row.context).context("failed to deserialize context")?;
    let messages: Vec<Message> =
        serde_json::from_str(&row.messages).context("failed to deserialize message list")?;

    Ok(Json(Studio {
        modified_at: row.modified_at,
        name: row.name,
        context,
        messages,
        token_count: 0,
    }))
}

#[derive(serde::Deserialize)]
pub struct Patch {
    name: Option<String>,
    modified_at: Option<NaiveDateTime>,
    context: Option<Vec<ContextFile>>,
    messages: Option<Vec<Message>>,
}

#[axum::debug_handler]
pub async fn patch(
    app: Extension<Application>,
    Path(id): Path<String>,
    Json(patch): Json<Patch>,
) -> webserver::Result<Json<TokenCounts>> {
    let mut transaction = app.sql.begin().await.map_err(Error::internal)?;

    // Ensure the ID is valid first.
    sqlx::query!("SELECT id FROM studios WHERE id = ?", id)
        .fetch_optional(&mut transaction)
        .await
        .map_err(Error::internal)?
        .ok_or_else(|| Error::new(ErrorKind::NotFound, "unknown code studio ID"))?;

    if let Some(name) = patch.name {
        sqlx::query!("UPDATE studios SET name = ? WHERE id = ?", name, id)
            .execute(&mut transaction)
            .await
            .map_err(Error::internal)?;
    }

    if let Some(modified_at) = patch.modified_at {
        sqlx::query!(
            "UPDATE studios SET modified_at = ? WHERE id = ?",
            modified_at,
            id
        )
        .execute(&mut transaction)
        .await
        .map_err(Error::internal)?;
    }

    if let Some(context) = patch.context {
        let json = serde_json::to_string(&context).unwrap();
        sqlx::query!("UPDATE studios SET context = ? WHERE id = ?", json, id)
            .execute(&mut transaction)
            .await
            .map_err(Error::internal)?;
    }

    if let Some(messages) = patch.messages {
        let json = serde_json::to_string(&messages).unwrap();
        sqlx::query!("UPDATE studios SET messages = ? WHERE id = ?", json, id)
            .execute(&mut transaction)
            .await
            .map_err(Error::internal)?;
    }

    sqlx::query!("UPDATE studios SET modified_at = datetime('now') WHERE id = ?", id)
        .execute(&mut transaction)
        .await
        .map_err(Error::internal)?;

    // Re-fetch the context in case we didn't change it. If we did, this will now be the updated
    // value.
    let context_json = sqlx::query!("SELECT context FROM studios WHERE id = ?", id)
        .fetch_optional(&mut transaction)
        .await
        .map_err(Error::internal)?
        .map(|r| r.context)
        .unwrap_or_default();

    let context: Vec<ContextFile> =
        serde_json::from_str(&context_json).context("invalid context JSON")?;

    let counts = token_counts((*app).clone(), &context).await?;

    transaction.commit().await.map_err(Error::internal)?;

    Ok(Json(counts))
}

#[derive(serde::Serialize)]
pub struct TokenCounts {
    total: usize,
    per_file: Vec<usize>,
}

async fn token_counts(app: Application, context: &[ContextFile]) -> webserver::Result<TokenCounts> {
    let per_file = stream::iter(context)
        .filter(|file| async { !file.hidden })
        .then(|file| {
            let app = app.clone();

            async move {
                let doc = app
                    .indexes
                    .file
                    .by_path(&file.repo, &file.path, Some(&file.branch))
                    .await
                    .map_err(Error::internal)?
                    .with_context(|| {
                        format!(
                            "file `{}` did not exist in repo `{}`, branch `{}`",
                            file.path, file.repo, file.branch
                        )
                    })?;

                let lines = doc.content.lines().collect::<Vec<_>>();

                let mut token_count = 0;
                for range in &file.ranges {
                    let chunk = lines
                        .iter()
                        .copied()
                        .skip(range.start)
                        .take(range.end - range.start)
                        .collect::<Vec<_>>()
                        .join("\n");

                    let core_bpe = tiktoken_rs::get_bpe_from_model("gpt-4-0613").unwrap();
                    token_count += core_bpe.encode_ordinary(&chunk).len();
                }

                Ok::<_, Error>(token_count)
            }
        })
        .try_collect::<Vec<_>>()
        .await?;

    Ok(TokenCounts {
        total: per_file.iter().sum(),
        per_file,
    })
}
