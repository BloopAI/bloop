use std::{path::Path, sync::Arc};

use anyhow::{Context, Result};
use futures::TryFutureExt;
use sqlx::SqlitePool;
use tracing::{debug, error};

use crate::Configuration;

mod query_log;
pub use query_log::QueryLog;

pub type SqlDb = Arc<SqlitePool>;

#[tracing::instrument(skip_all)]
pub async fn initialize(config: &Configuration) -> Result<SqlitePool> {
    let data_dir = config.index_dir.to_string_lossy();
    let url = format!("sqlite://{data_dir}/bleep.db?mode=rwc");

    match connect(&url).await {
        Ok(pool) => {
            debug!("connected");
            Ok(pool)
        }
        Err(e) => {
            error!(?e, "error while migrating, recreating database...");

            reset(&data_dir)?;
            debug!("reset complete");

            Ok(connect(&data_dir)
                .await
                .context("failed to recreate database")?)
        }
    }
}

#[tracing::instrument()]
async fn connect(url: &str) -> Result<SqlitePool> {
    let pool = SqlitePool::connect(url).await?;

    if let Err(e) = sqlx::migrate!()
        .run(&pool)
        .map_err(anyhow::Error::from)
        .and_then(|_| logical_migrations(&pool))
        .await
    {
        // We manually close the pool here to ensure file handles are properly cleaned up on
        // Windows.
        pool.close().await;
        Err(e)?
    } else {
        logical_migrations(&pool).await?;
        Ok(pool)
    }
}

#[tracing::instrument()]
fn reset(data_dir: &str) -> Result<()> {
    let db_path = Path::new(data_dir).join("bleep.db");
    let bk_path = db_path.with_extension("db.bk");
    std::fs::rename(db_path, bk_path).context("failed to backup old database")
}

async fn logical_migrations(db: &SqlitePool) -> Result<()> {
    // A series of logically applied migrations.
    project_migration(db).await
}

async fn project_migration(db: &SqlitePool) -> Result<()> {
    let applied =
        sqlx::query! { "SELECT applied FROM rust_migrations WHERE ref = 'project_migration'" }
            .fetch_one(db)
            .await?
            .applied;

    if applied {
        return Ok(());
    }

    let conversations = sqlx::query! { "SELECT id, project_id, exchanges FROM conversations" }
        .fetch_all(db)
        .await?;

    for row in conversations {
        // As part of this migration, we assume each conversation project only ever had 1 repo.
        // It's not possible for there to be more than one after the accompanying SQL migration.
        let project_repo = sqlx::query! {
            "SELECT repo_ref FROM project_repos WHERE project_id = ?",
            row.project_id,
        }
        .fetch_one(db)
        .await?;

        let mut exchanges = serde_json::from_str::<serde_json::Value>(&row.exchanges)
            .context("did not find valid JSON in `exchanges`")?;

        fixup_exchange(&mut exchanges, &project_repo.repo_ref)
            .context("`exchanges` was malformed")?;

        let exchanges_json = serde_json::to_string(&exchanges)?;

        sqlx::query! {
            "UPDATE conversations SET exchanges = ? WHERE id = ?",
            exchanges_json,
            row.id,
        }
        .execute(db)
        .await?;
    }

    let studio_snapshots = sqlx::query! {
        "SELECT
            context,
            (SELECT project_id FROM studios WHERE studios.id = studio_snapshots.studio_id) AS project_id
        FROM studio_snapshots"
    }
    .fetch_all(db)
    .await?;

    for ss in studio_snapshots {
        let context =
            serde_json::from_str(&ss.context).context("did not find valid JSON in `context`")?;

        for repo_ref in studio_context_repos(&context).context("invalid studio `context` JSON")? {
            sqlx::query! {
                "INSERT INTO project_repos (project_id, repo_ref)
                SELECT $1, $2
                WHERE NOT EXISTS (
                    SELECT 1 FROM project_repos WHERE project_id = $1 AND repo_ref = $2
                )",
                ss.project_id,
                repo_ref,
            }
            .execute(db)
            .await?;
        }
    }

    sqlx::query! { "UPDATE rust_migrations SET applied = true WHERE ref = 'project_migration'" }
        .execute(db)
        .await?;

    Ok(())
}

fn fixup_exchange(exchanges: &mut serde_json::Value, repo_ref: &str) -> Option<()> {
    for exchange in exchanges.as_array_mut()? {
        let exchange = exchange.as_object_mut()?;

        // First we fixup the top-level `paths` field.
        for p in exchange.get_mut("paths")?.as_array_mut()? {
            let path = p.as_str()?.to_owned();
            *p = serde_json::json!({
                "repo": repo_ref,
                "path": path,
            });
        }

        // Then, we replace `CodeChunk::path` with `CodeChunk::repo_path`.
        for cc in exchange.get_mut("code_chunks")?.as_array_mut()? {
            let cc = cc.as_object_mut()?;
            let path = cc.remove("path")?.as_str()?.to_owned();
            cc.insert(
                "repo_path".to_owned(),
                serde_json::json!({
                    "repo": repo_ref,
                    "path": path,
                }),
            );
        }

        // Similarly, update `focused_chunk`, if it exists.
        match exchange.get_mut("focused_chunk") {
            Some(serde_json::Value::Null) | None => {}
            Some(serde_json::Value::Object(fc)) => {
                let file_path = fc.remove("file_path");

                fc.insert(
                    "repo_path".to_owned(),
                    serde_json::json!({
                        "repo": repo_ref,
                        "path": file_path,
                    }),
                );
            }
            Some(_) => return None,
        }

        // Finally, we can update the search steps.
        for step in exchange.get_mut("search_steps")?.as_array_mut()? {
            let step = step.as_object_mut()?;

            if step.get("type").and_then(|v| v.as_str()) == Some("proc") {
                let content = step.get_mut("content")?.as_object_mut()?;

                for p in content.get_mut("paths")?.as_array_mut()? {
                    let path = p.as_str()?.to_owned();
                    *p = serde_json::json!({
                        "repo": repo_ref,
                        "path": path,
                    });
                }
            }
        }
    }

    Some(())
}

fn studio_context_repos(context: &serde_json::Value) -> Option<Vec<&str>> {
    let mut repos = Vec::new();
    for context_file in context.as_array()? {
        repos.push(context_file.as_object()?.get("repo")?.as_str()?);
    }
    Some(repos)
}
