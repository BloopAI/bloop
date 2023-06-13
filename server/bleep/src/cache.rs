use std::path::PathBuf;

use anyhow::Context;
use sqlx::Sqlite;

use crate::repo::RepoRef;

use super::db::SqlDb;

#[derive(serde::Serialize, serde::Deserialize)]
pub(crate) struct FreshValue<T> {
    // default value is `false` on deserialize
    pub(crate) fresh: bool,
    pub(crate) value: T,
}

impl<T> From<T> for FreshValue<T> {
    fn from(value: T) -> Self {
        Self { fresh: true, value }
    }
}

pub(crate) type Branches = Vec<String>;
pub(crate) type RepoCacheSnapshot = scc::HashMap<PathBuf, FreshValue<(String, Branches)>>;

pub(crate) struct FileCache<'a> {
    db: &'a SqlDb,
}

impl<'a> FileCache<'a> {
    pub(crate) fn new(db: &'a SqlDb) -> Self {
        Self { db }
    }

    pub(crate) async fn for_repo(&self, reporef: &RepoRef) -> anyhow::Result<RepoCacheSnapshot> {
        let repo_str = reporef.to_string();
        let rows = sqlx::query! {
            "SELECT file_name, hash, branches FROM file_cache \
             WHERE repo_ref = ?",
            repo_str,
        }
        .fetch_all(self.db.as_ref())
        .await?;

        let output = scc::HashMap::default();
        for row in rows {
            _ = output.insert(
                PathBuf::from(row.file_name),
                (row.hash, serde_json::from_str(&row.branches)?).into(),
            );
        }

        Ok(output)
    }

    pub(crate) async fn persist(
        &self,
        reporef: &RepoRef,
        cache: RepoCacheSnapshot,
    ) -> anyhow::Result<()> {
        let mut tx = self.db.begin().await?;
        self.delete_all(&mut tx, reporef).await?;

        let keys = {
            let mut keys = vec![];
            cache.scan_async(|k, _v| keys.push(k.clone())).await;
            keys
        };

        for k in keys {
            let (file_name, entry) = cache.remove(&k).context("can't happen")?;
            let branches = serde_json::to_string(&entry.value.1)?;
            let repo_str = reporef.to_string();
            let file = file_name.to_string_lossy();
            sqlx::query!(
                "INSERT INTO file_cache \
		 (repo_ref, file_name, hash, branches) \
                 VALUES (?, ?, ?, ?)",
                repo_str,
                file,
                entry.value.0,
                branches
            )
            .execute(&mut tx)
            .await?;
        }

        tx.commit().await?;

        Ok(())
    }

    pub(crate) async fn delete_for_repo(&self, reporef: &RepoRef) -> anyhow::Result<()> {
        let mut tx = self.db.begin().await?;
        self.delete_all(&mut tx, reporef).await?;
        tx.commit().await?;

        Ok(())
    }

    async fn delete_all(
        &self,
        tx: &mut sqlx::Transaction<'_, Sqlite>,
        reporef: &RepoRef,
    ) -> anyhow::Result<()> {
        let repo_str = reporef.to_string();
        sqlx::query! {
            "DELETE FROM file_cache \
                 WHERE repo_ref = ?",
            repo_str
        }
        .execute(&mut *tx)
        .await?;

        Ok(())
    }
}
