use std::{fs, path::Path};

use anyhow::{anyhow, Context, Result};
use once_cell::sync::OnceCell;
use sqlx::SqlitePool;
use tracing::{debug, warn};

use crate::Configuration;

static POOL: OnceCell<SqlitePool> = OnceCell::new();

pub async fn init(config: &Configuration) -> Result<()> {
    fs::create_dir_all(&config.data_dir)?;
    let data_dir = config.data_dir.to_string_lossy();

    let pool = match connect(&data_dir).await {
        Ok(pool) => pool,
        Err(e) => {
            warn!(
                ?e,
                "encountered DB error while migrating, recreating database..."
            );
            reset(&data_dir)?;
            connect(&data_dir)
                .await
                .context("failed to recreate database")?
        }
    };

    POOL.set(pool)
        .map_err(|_| anyhow!("database was already initialized!"))?;

    Ok(())
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

pub async fn get() -> Result<&'static SqlitePool> {
    POOL.get()
        .ok_or(anyhow!("database pool was not initialized"))
}
