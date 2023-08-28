use std::sync::{Arc, RwLock};

use qdrant_client::qdrant::PointId;
use sqlx::Sqlite;
use tracing::{error, trace};
use uuid::Uuid;

use crate::{
    repo::RepoRef,
    semantic::{
        embedder::{EmbedChunk, EmbedLog},
        Payload, Semantic,
    },
};

use super::db::SqlDb;

#[derive(serde::Serialize, serde::Deserialize, Eq)]
pub(crate) struct FreshValue<T> {
    // default value is `false` on deserialize
    pub(crate) fresh: bool,
    pub(crate) value: T,
}

impl<T> PartialEq for FreshValue<T>
where
    T: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        self.value.eq(&other.value)
    }
}

impl<T> FreshValue<T> {
    fn stale(value: T) -> Self {
        Self {
            fresh: false,
            value,
        }
    }
}

impl<T> From<T> for FreshValue<T> {
    fn from(value: T) -> Self {
        Self { fresh: true, value }
    }
}

/// Snapshot of the current state of a FileCache
/// Since it's atomically (as in ACID) read from SQLite, this will be
/// representative at a single point in time
pub(crate) type FileCacheSnapshot = Arc<scc::HashMap<String, FreshValue<()>>>;

/// Manage the SQL cache for a repository, establishing a
/// content-addressed space for files in it.
///
/// The cache keys are should be directly mirrored in Tantivy for each
/// file entry, as Tantivy can't upsert content.
///
/// NB: consistency with Tantivy state is NOT ensured here.
pub(crate) struct FileCache<'a> {
    db: &'a SqlDb,
    reporef: &'a RepoRef,
    semantic: Option<&'a Semantic>,
    embed_log: EmbedLog,
}

impl<'a> FileCache<'a> {
    pub(crate) fn for_repo(
        db: &'a SqlDb,
        semantic: Option<&'a Semantic>,
        reporef: &'a RepoRef,
    ) -> Self {
        Self {
            db,
            reporef,
            semantic,
            embed_log: Default::default(),
        }
    }

    pub(crate) async fn retrieve(&self) -> FileCacheSnapshot {
        let repo_str = self.reporef.to_string();
        let rows = sqlx::query! {
            "SELECT cache_hash FROM file_cache \
             WHERE repo_ref = ?",
            repo_str,
        }
        .fetch_all(self.db.as_ref())
        .await;

        let output = scc::HashMap::default();
        for row in rows.into_iter().flatten() {
            _ = output.insert(row.cache_hash, FreshValue::stale(()));
        }

        output.into()
    }

    pub(crate) async fn persist(&self, cache: FileCacheSnapshot) -> anyhow::Result<()> {
        let mut tx = self.db.begin().await?;
        self.delete_files(&mut tx).await?;

        let keys = {
            let mut keys = vec![];
            cache.scan_async(|k, _v| keys.push(k.clone())).await;
            keys
        };

        for hash in keys {
            let repo_str = self.reporef.to_string();
            sqlx::query!(
                "INSERT INTO file_cache \
		 (repo_ref, cache_hash) \
                 VALUES (?, ?)",
                repo_str,
                hash,
            )
            .execute(&mut tx)
            .await?;
        }

        tx.commit().await?;

        Ok(())
    }

    pub(crate) async fn delete(&self) -> anyhow::Result<()> {
        let mut tx = self.db.begin().await?;
        self.delete_files(&mut tx).await?;
        self.delete_chunks(&mut tx).await?;
        tx.commit().await?;

        Ok(())
    }

    async fn delete_files(&self, tx: &mut sqlx::Transaction<'_, Sqlite>) -> anyhow::Result<()> {
        let repo_str = self.reporef.to_string();
        sqlx::query! {
            "DELETE FROM file_cache \
                 WHERE repo_ref = ?",
            repo_str
        }
        .execute(&mut *tx)
        .await?;

        Ok(())
    }

    async fn delete_chunks(&self, tx: &mut sqlx::Transaction<'_, Sqlite>) -> anyhow::Result<()> {
        let repo_str = self.reporef.to_string();
        sqlx::query! {
            "DELETE FROM chunk_cache \
                 WHERE repo_ref = ?",
            repo_str
        }
        .execute(&mut *tx)
        .await?;

        Ok(())
    }

    /// Commit the embed log, invoking the embedder if batch size is met.
    ///
    /// If `flush == true`, drain the log, send the entire batch to
    /// the embedder, and commit the results, disregarding the internal
    /// batch sizing.
    pub async fn commit_embed_log(&self, flush: bool) -> anyhow::Result<()> {
        let Some(semantic) = self.semantic
	else {
	    return Ok(());
	};

        let to_commit = semantic
            .embedder()
            .batch_embed(&self.embed_log, flush)
            .await?;

        if !to_commit.is_empty() {
            if let Err(err) = semantic
                .qdrant_client()
                .upsert_points(&semantic.collection_name(), to_commit, None)
                .await
            {
                error!(?err, "failed to write new points into qdrant");
            }
        }

        Ok(())
    }

    pub async fn chunks_for_file(&'a self, key: &'a str) -> ChunkCache<'a> {
        ChunkCache::for_file(
            self.db,
            self.semantic
                .expect("we shouldn't get here without semantic db configured"),
            self.reporef,
            &self.embed_log,
            key,
        )
        .await
    }
}

/// Manage both the SQL cache and the underlying qdrant database to
/// ensure consistency.
///
/// Operates on a single file's level.
pub struct ChunkCache<'a> {
    sql: &'a SqlDb,
    semantic: &'a Semantic,
    reporef: &'a RepoRef,
    file_cache_key: &'a str,
    cache: scc::HashMap<String, FreshValue<String>>,
    update: scc::HashMap<(Vec<String>, String), Vec<String>>,
    new_sql: RwLock<Vec<(String, String)>>,
    embed_log: &'a EmbedLog,
}

impl<'a> ChunkCache<'a> {
    async fn for_file(
        sql: &'a SqlDb,
        semantic: &'a Semantic,
        reporef: &'a RepoRef,
        embed_log: &'a EmbedLog,
        file_cache_key: &'a str,
    ) -> ChunkCache<'a> {
        let rows = sqlx::query! {
            "SELECT chunk_hash, branches FROM chunk_cache \
             WHERE file_hash = ?",
            file_cache_key,
        }
        .fetch_all(sql.as_ref())
        .await;

        let cache = scc::HashMap::<String, FreshValue<_>>::default();
        for row in rows.into_iter().flatten() {
            _ = cache.insert(row.chunk_hash, FreshValue::stale(row.branches));
        }

        Self {
            sql,
            semantic,
            reporef,
            file_cache_key,
            cache,
            embed_log,
            update: Default::default(),
            new_sql: Default::default(),
        }
    }

    pub fn update_or_embed(&self, data: &'a str, payload: Payload) -> anyhow::Result<()> {
        let id = self.cache_key(data, &payload);
        let branches_hash = blake3::hash(payload.branches.join("\n").as_ref()).to_string();

        match self.cache.entry(id) {
            scc::hash_map::Entry::Occupied(mut existing) => {
                let key = existing.key();
                trace!(?key, "found; not upserting new");
                if existing.get().value != branches_hash {
                    self.update
                        .entry((payload.branches, branches_hash.clone()))
                        .or_insert_with(Vec::new)
                        .get_mut()
                        .push(existing.key().to_owned());
                }
                *existing.get_mut() = branches_hash.into();
            }
            scc::hash_map::Entry::Vacant(vacant) => {
                let key = vacant.key();
                trace!(?key, "inserting new");
                self.new_sql
                    .write()
                    .unwrap()
                    .push((vacant.key().to_owned(), branches_hash.clone()));

                self.embed_log.push(EmbedChunk {
                    id: vacant.key().clone(),
                    data: data.into(),
                    payload: payload.into_qdrant(),
                });

                vacant.insert_entry(branches_hash.into());
            }
        }

        Ok(())
    }

    /// Commit both qdrant and cache changes to the respective databases.
    ///
    /// The SQLite operations mirror qdrant changes 1:1, so any
    /// discrepancy between the 2 should be minimized.
    ///
    /// In addition, the SQLite cache is committed only AFTER all
    /// qdrant writes have successfully completed, meaning they're in
    /// qdrant's pipelines.
    ///
    /// Since qdrant changes are pipelined on their end, data written
    /// here is not necessarily available for querying when the
    /// commit's completed.
    pub async fn commit(self) -> anyhow::Result<(usize, usize, usize)> {
        let mut tx = self.sql.begin().await?;

        let update_size = self.commit_branch_updates(&mut tx).await?;
        let delete_size = self.commit_deletes(&mut tx).await?;
        let new_size = self.commit_inserts(&mut tx).await?;

        tx.commit().await?;

        Ok((new_size, update_size, delete_size))
    }

    /// Insert new additions to sqlite
    ///
    /// Note this step will update the cache before changes are
    /// actually written to qdrant in batches.
    ///
    /// All qdrant operations are executed in batches through a call
    /// to [`FileCache::commit_chunks`].
    async fn commit_inserts(
        &self,
        tx: &mut sqlx::Transaction<'_, Sqlite>,
    ) -> Result<usize, anyhow::Error> {
        let new_sql = std::mem::take(&mut *self.new_sql.write().unwrap());
        let new_size = new_sql.len();

        let repo_str = self.reporef.to_string();
        for (p, branches) in new_sql {
            sqlx::query! {
                "INSERT INTO chunk_cache (chunk_hash, file_hash, branches, repo_ref) \
                 VALUES (?, ?, ?, ?)",
                 p, self.file_cache_key, branches, repo_str
            }
            .execute(&mut *tx)
            .await?;
        }

        Ok(new_size)
    }

    /// Delete points that have expired in the latest index.
    async fn commit_deletes(
        &self,
        tx: &mut sqlx::Transaction<'_, Sqlite>,
    ) -> Result<usize, anyhow::Error> {
        let mut to_delete = vec![];
        self.cache
            .scan_async(|id, p| {
                if !p.fresh {
                    to_delete.push(id.to_owned());
                }
            })
            .await;

        let delete_size = to_delete.len();
        for p in to_delete.iter() {
            sqlx::query! {
                "DELETE FROM chunk_cache \
                 WHERE chunk_hash = ? AND file_hash = ?",
                p,
                self.file_cache_key
            }
            .execute(&mut *tx)
            .await?;
        }

        if !to_delete.is_empty() {
            self.semantic
                .qdrant_client()
                .delete_points(
                    self.semantic.collection_name(),
                    &to_delete
                        .into_iter()
                        .map(PointId::from)
                        .collect::<Vec<_>>()
                        .into(),
                    None,
                )
                .await?;
        }
        Ok(delete_size)
    }

    /// Update points where the list of branches in which they're
    /// searchable has changed.
    async fn commit_branch_updates(
        &self,
        tx: &mut sqlx::Transaction<'_, Sqlite>,
    ) -> Result<usize, anyhow::Error> {
        let mut update_size = 0;
        let mut qdrant_updates = vec![];

        let mut next = self.update.first_occupied_entry();
        while let Some(entry) = next {
            let (branches_list, branches_hash) = entry.key();
            let points = entry.get();
            update_size += points.len();

            for p in entry.get() {
                sqlx::query! {
                    "UPDATE chunk_cache SET branches = ? \
                     WHERE chunk_hash = ?",
                     branches_hash,
                     p
                }
                .execute(&mut *tx)
                .await?;
            }

            let id = points
                .iter()
                .cloned()
                .map(PointId::from)
                .collect::<Vec<_>>()
                .into();

            let payload = qdrant_client::client::Payload::new_from_hashmap(
                [("branches".to_string(), branches_list.to_owned().into())].into(),
            );

            qdrant_updates.push(async move {
                self.semantic
                    .qdrant_client()
                    .set_payload(self.semantic.collection_name(), &id, payload, None)
                    .await
            });
            next = entry.next();
        }

        // Note these actions aren't actually parallel, merely
        // concurrent.
        //
        // This should be fine since the number of updates would be
        // reasonably small.
        futures::future::join_all(qdrant_updates.into_iter())
            .await
            .into_iter()
            .collect::<Result<Vec<_>, _>>()?;

        Ok(update_size)
    }

    /// Return the cache key for the file that contains these chunks
    pub fn file_hash(&self) -> String {
        self.file_cache_key.to_string()
    }

    /// Generate a content hash from the embedding data, and pin it to
    /// the containing file's content id.
    fn cache_key(&self, data: &str, payload: &Payload) -> String {
        let id = {
            let mut bytes = [0; 16];
            let mut hasher = blake3::Hasher::new();
            hasher.update(&payload.start_line.to_le_bytes());
            hasher.update(&payload.end_line.to_le_bytes());
            hasher.update(self.file_cache_key.as_bytes());
            hasher.update(data.as_ref());
            bytes.copy_from_slice(&hasher.finalize().as_bytes()[16..32]);
            Uuid::from_bytes(bytes).to_string()
        };
        id
    }
}
