use std::{path::Path, sync::Arc};

use anyhow::{Context, Result};
use sqlx::SqlitePool;
use tracing::{debug, warn};

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
            warn!(?e, "error while migrating, recreating database...");

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
    let pool = SqlitePool::connect(&url).await?;

    if let Err(e) = sqlx::migrate!().run(&pool).await {
        // We manually close the pool here to ensure file handles are properly cleaned up on
        // Windows.
        pool.close().await;
        Err(e)?
    } else {
        Ok(pool)
    }
}

#[tracing::instrument()]
fn reset(data_dir: &str) -> Result<()> {
    let db_path = Path::new(data_dir).join("bleep.db");
    let bk_path = db_path.with_extension("db.bk");
    std::fs::rename(db_path, bk_path).context("failed to backup old database")
}
