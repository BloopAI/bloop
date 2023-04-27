use std::fs;

use anyhow::{Result, anyhow};
use once_cell::sync::{Lazy, OnceCell};
use sqlx::SqlitePool;
use tracing::debug;

use crate::Configuration;

static POOL: OnceCell<SqlitePool> = OnceCell::new();

pub async fn init(config: &Configuration) -> Result<()> {
    fs::create_dir_all(&config.data_dir)?;
    let data_dir = config.data_dir.to_string_lossy();

    let url = format!("sqlite://{data_dir}/bleep.db?mode=rwc");
    debug!("loading db from {url}");
    let pool = SqlitePool::connect(&url).await?;

    sqlx::migrate!().run(&pool).await?;

    POOL.set(pool).map_err(|_| anyhow!("database was already initialized!"))?;

    Ok(())
}

pub async fn get() -> Result<&'static SqlitePool> {
    POOL.get().ok_or(anyhow!("database pool was not initialized"))
}
