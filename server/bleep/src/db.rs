use std::{fs, path::Path, sync::Arc};

use anyhow::{Context, Result};
use sqlx::SqlitePool;
use tracing::{debug, warn};

use crate::Configuration;

mod query_log;
pub use query_log::QueryLog;

pub type SqlDb = Arc<SqlitePool>;

pub async fn init(config: &Configuration) -> Result<SqlitePool> {
    fs::create_dir_all(&config.data_dir)?;
    let data_dir = config.data_dir.to_string_lossy();

    match connect(&data_dir).await {
        Ok(pool) => Ok(pool),
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
    sqlx::migrate!().run(&pool).await?;
    Ok(pool)
}

fn reset(data_dir: &str) -> Result<()> {
    let db_path = Path::new(data_dir).join("bleep.db");
    let bk_path = db_path.with_extension("db.bk");
    std::fs::rename(db_path, bk_path).context("failed to backup old database")
}
