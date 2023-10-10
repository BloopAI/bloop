use std::{path::Path, sync::Arc};

use anyhow::{Context, Result};
use sqlx::SqlitePool;
use tracing::{debug, warn};

use crate::Configuration;

mod query_log;
pub use query_log::QueryLog;

pub type SqlDb = Arc<SqlitePool>;

pub async fn init(config: &Configuration) -> Result<SqlitePool> {
    let data_dir = config.index_dir.to_string_lossy();

    match connect(&data_dir).await {
        Ok(pool) => {
            debug!("successfully connected to DB");
            Ok(pool)
        }
        Err(e) => {
            warn!(
                ?e,
                "encountered DB error while migrating, recreating database..."
            );
            reset(&data_dir)?;
            Ok(connect(&data_dir)
                .await
                .context("failed to recreate database")?)
        }
    }
}

async fn connect(data_dir: &str) -> Result<SqlitePool> {
    let url = format!("sqlite://{data_dir}/bleep.db?mode=rwc");
    debug!("loading db from {url}");
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

fn reset(data_dir: &str) -> Result<()> {
    let db_path = Path::new(data_dir).join("bleep.db");
    let bk_path = db_path.with_extension("db.bk");
    std::fs::rename(db_path, bk_path).context("failed to backup old database")
}
