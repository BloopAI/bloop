use std::{
    collections::HashSet,
    ops::Deref,
    sync::{Arc, RwLock},
    time::Instant,
};

use qdrant_client::qdrant::{PointId, PointStruct};
use rayon::prelude::ParallelIterator;
use scc::hash_map::Entry;
use sqlx::Sqlite;
use tracing::{error, info, trace, warn};
use uuid::Uuid;

use crate::{
    repo::RepoRef,
    semantic::{
        embedder::{EmbedChunk, EmbedQueue},
        Payload, Semantic,
    },
    state::RepositoryPool,
};

use super::db::SqlDb;

#[derive(serde::Serialize, serde::Deserialize, Eq)]
pub struct FreshValue<T> {
    // default value is `false` on deserialize
    pub(crate) fresh: bool,
    pub(crate) value: T,
}

impl<T: Default> FreshValue<T> {
    fn fresh_default() -> Self {
        Self {
            fresh: true,
            value: Default::default(),
        }
    }
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
pub struct FileCacheSnapshot<'a> {
    snapshot: Arc<scc::HashMap<CacheKeys, FreshValue<()>>>,
    parent: &'a FileCache,
    reporef: &'a RepoRef,
}

/// CacheKeys unifies the different keys to different databases.
///
/// Different layers of cache use different keys.
///
/// Tantivy keys are more specific. Since in Tantivy we can't update
/// an existing record, all cache keys identify a record in the
/// database universally (as in, in space & time).
///
/// In QDrant, however, it is possible to update existing records,
/// therefore the cache key is less strong. We use the weaker key to
/// identify existing, similar records, and update them with a
/// refreshed property set.
///
/// For the specific calculation of what goes into these keys, take a
/// look at
/// [`Workload::cache_keys`][crate::indexes::file::Workload::cache_keys]
#[derive(Clone, Debug, Hash, PartialEq, Eq)]
pub struct CacheKeys(String, String);

impl CacheKeys {
    pub fn new(semantic: impl Into<String>, tantivy: impl Into<String>) -> Self {
        Self(semantic.into(), tantivy.into())
    }

    pub fn tantivy(&self) -> &str {
        &self.1
    }

    pub fn semantic(&self) -> &str {
        &self.0
    }
}

impl<'a> FileCacheSnapshot<'a> {
    pub(crate) fn parent(&'a self) -> &'a FileCache {
        self.parent
    }

    #[tracing::instrument(skip(self))]
    pub(crate) fn is_fresh(&self, keys: &CacheKeys) -> bool {
        match self.snapshot.entry(keys.clone()) {
            Entry::Occupied(mut val) => {
                val.get_mut().fresh = true;

                trace!("cache hit");
                true
            }
            Entry::Vacant(val) => {
                _ = val.insert_entry(FreshValue::fresh_default());

                trace!("cache miss");
                false
            }
        }
    }
}

impl<'a> Deref for FileCacheSnapshot<'a> {
    type Target = scc::HashMap<CacheKeys, FreshValue<()>>;

    fn deref(&self) -> &Self::Target {
        &self.snapshot
    }
}

/// Manage the SQL cache for a repository, establishing a
/// content-addressed space for files in it.
///
/// The cache keys are should be directly mirrored in Tantivy for each
/// file entry, as Tantivy can't upsert content.
///
/// NB: consistency with Tantivy state is NOT ensured here.
pub struct FileCache {
    db: SqlDb,
    semantic: Semantic,
    embed_queue: EmbedQueue,
}

impl<'a> FileCache {
    pub(crate) fn new(db: SqlDb, semantic: Semantic) -> Self {
        Self {
            db,
            semantic,
            embed_queue: Default::default(),
        }
    }

    pub(crate) async fn reset(&'a self, repo_pool: &RepositoryPool) -> anyhow::Result<()> {
        let mut refs = vec![];
        // knocking out our current file caches will force re-indexing qdrant
        repo_pool.for_each(|reporef, repo| {
            refs.push(reporef.to_owned());
            repo.last_index_unix_secs = 0;
        });

        for reporef in refs {
            self.delete(&reporef).await?;
        }

        Ok(())
    }

    /// Retrieve a file-level snapshot of the cache for the repository in scope.
    pub(crate) async fn retrieve(&'a self, reporef: &'a RepoRef) -> FileCacheSnapshot<'a> {
        let repo_str = reporef.to_string();
        let rows = sqlx::query! {
            "SELECT cache_hash FROM file_cache \
             WHERE repo_ref = ?",
            repo_str,
        }
        .fetch_all(self.db.as_ref())
        .await;

        let output = scc::HashMap::default();
        for row in rows.into_iter().flatten() {
            let (semantic_hash, tantivy_hash) = row.cache_hash.split_at(64);
            _ = output.insert(
                CacheKeys::new(semantic_hash, tantivy_hash),
                FreshValue::stale(()),
            );
        }

        FileCacheSnapshot {
            reporef,
            parent: self,
            snapshot: output.into(),
        }
    }

    /// Synchronize the cache and DBs.
    ///
    /// `delete_tantivy` is a callback that takes a single key and
    /// records the delete operation in a Tantivy writer.
    ///
    /// Semantic deletions are handled internally.
    pub(crate) async fn synchronize(
        &'a self,
        cache: FileCacheSnapshot<'a>,
        delete_tantivy: impl Fn(&str),
    ) -> anyhow::Result<()> {
        let mut tx = self.db.begin().await?;
        self.delete_files(cache.reporef, &mut tx).await?;

        let repo_str = cache.reporef.to_string();

        // files that are no longer tracked by the git index are to be removed
        // from the tantivy & qdrant indices
        let qdrant_stale = {
            let mut semantic_fresh = HashSet::new();
            let mut semantic_all = HashSet::new();

            cache.retain(|k, v| {
                // check if it's already in to avoid unnecessary copies
                if v.fresh && !semantic_fresh.contains(k.semantic()) {
                    semantic_fresh.insert(k.semantic().to_string());
                }

                if !semantic_all.contains(k.semantic()) {
                    semantic_all.insert(k.semantic().to_string());
                }

                // just call the passed closure for tantivy
                if !v.fresh {
                    delete_tantivy(k.tantivy())
                }

                v.fresh
            });

            semantic_all
                .difference(&semantic_fresh)
                .cloned()
                .collect::<Vec<_>>()
        };

        // generate a transaction to push the remaining entries
        // into the sql cache
        {
            let mut next = cache.first_occupied_entry_async().await;
            while let Some(entry) = next {
                let key = entry.key();
                let hash = format!("{}{}", key.0, key.1);
                sqlx::query!(
                    "INSERT INTO file_cache \
		 (repo_ref, cache_hash) \
                 VALUES (?, ?)",
                    repo_str,
                    hash,
                )
                .execute(&mut tx)
                .await?;

                next = entry.next();
            }

            tx.commit().await?;
        }

        // batch-delete points from qdrant index
        if !qdrant_stale.is_empty() {
            let semantic = self.semantic.clone();
            tokio::spawn(async move {
                semantic
                    .delete_points_for_hash(&repo_str, qdrant_stale.into_iter())
                    .await;
            });
        }

        // make sure we generate & commit all remaining embeddings
        self.batched_embed_or_flush_queue(true).await?;

        Ok(())
    }

    /// Delete all caches for the repository in scope.
    pub(crate) async fn delete(&self, reporef: &RepoRef) -> anyhow::Result<()> {
        let mut tx = self.db.begin().await?;
        self.delete_files(reporef, &mut tx).await?;
        self.delete_chunks(reporef, &mut tx).await?;
        tx.commit().await?;

        Ok(())
    }

    /// Process the next chunk from the embedding queue if the batch size is met.
    pub fn process_embedding_queue(&self) -> anyhow::Result<()> {
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current()
                .block_on(async { self.batched_embed_or_flush_queue(false).await })
        })
    }

    /// Commit the embed log, invoking the embedder if batch size is met.
    ///
    /// If `flush == true`, drain the log, send the entire batch to
    /// the embedder, and commit the results, disregarding the internal
    /// batch sizing.
    async fn batched_embed_or_flush_queue(&self, flush: bool) -> anyhow::Result<()> {
        let new_points = self.embed_queued_points(flush).await?;

        if !new_points.is_empty() {
            if let Err(err) = self
                .semantic
                .qdrant_client()
                .upsert_points(self.semantic.collection_name(), new_points, None)
                .await
            {
                error!(?err, "failed to write new points into qdrant");
            }
        }
        Ok(())
    }

    /// Empty the queue in batches, and generate embeddings using the
    /// configured embedder
    async fn embed_queued_points(&self, flush: bool) -> Result<Vec<PointStruct>, anyhow::Error> {
        let batch_size = self.semantic.config.embedding_batch_size.get();
        let log = &self.embed_queue;
        let mut output = vec![];

        loop {
            // if we're not currently flushing the log, only process full batches
            if log.is_empty() || (log.len() < batch_size && !flush) {
                return Ok(output);
            }

            let mut batch = vec![];

            // fill this batch with embeddings
            while let Some(embedding) = log.pop() {
                batch.push(embedding);

                if batch.len() == batch_size {
                    break;
                }
            }

            let (elapsed, res) = {
                let time = Instant::now();
                let res = self
                    .semantic
                    .embedder()
                    .batch_embed(batch.iter().map(|c| c.data.as_ref()).collect::<Vec<_>>())
                    .await;

                (time.elapsed(), res)
            };

            match res {
                Ok(res) => {
                    trace!(?elapsed, size = batch.len(), "batch embedding successful");
                    output.extend(
                        res.into_iter()
                            .zip(batch)
                            .map(|(embedding, src)| PointStruct {
                                id: Some(PointId::from(src.id)),
                                vectors: Some(embedding.into()),
                                payload: src.payload,
                            }),
                    )
                }
                Err(err) => {
                    error!(
                        ?err,
                        ?elapsed,
                        size = batch.len(),
                        "remote batch embeddings failed"
                    )
                }
            }
        }
    }

    /// Chunks and inserts the buffer content into the semantic db.
    ///
    /// Assumes that the semantic db is initialized and usable, otherwise panics.
    #[allow(clippy::too_many_arguments)]
    pub(crate) async fn process_semantic(
        &self,
        cache_keys: &CacheKeys,
        repo_name: &str,
        repo_ref: &RepoRef,
        relative_path: &str,
        buffer: &str,
        lang_str: &str,
        branches: &[String],
    ) {
        let chunk_cache = self.chunks_for_file(repo_ref, cache_keys).await;
        self.semantic
            .chunks_for_buffer(
                cache_keys.semantic().into(),
                repo_name,
                &repo_ref.to_string(),
                relative_path,
                buffer,
                lang_str,
                branches,
            )
            .for_each(|(data, payload)| {
                let cached = chunk_cache.update_or_embed(&data, payload);
                if let Err(err) = cached {
                    warn!(?err, %repo_name, %relative_path, "embedding failed");
                }
            });

        match chunk_cache.commit().await {
            Ok((new, updated, deleted)) => {
                info!(
                    repo_name,
                    relative_path, new, updated, deleted, "Successful commit"
                )
            }
            Err(err) => {
                warn!(repo_name, relative_path, ?err, "Failed to upsert vectors")
            }
        }
    }

    /// Delete all files in the `file_cache` table for the repository in scope.
    async fn delete_files(
        &self,
        reporef: &RepoRef,
        tx: &mut sqlx::Transaction<'_, Sqlite>,
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

    /// Delete all chunks in the `chunk_cache` table for the repository in scope.
    async fn delete_chunks(
        &self,
        reporef: &RepoRef,
        tx: &mut sqlx::Transaction<'_, Sqlite>,
    ) -> anyhow::Result<()> {
        let repo_str = reporef.to_string();
        sqlx::query! {
            "DELETE FROM chunk_cache \
                 WHERE repo_ref = ?",
            repo_str
        }
        .execute(&mut *tx)
        .await?;

        Ok(())
    }

    async fn chunks_for_file(&'a self, reporef: &'a RepoRef, key: &'a CacheKeys) -> ChunkCache<'a> {
        ChunkCache::for_file(
            &self.db,
            &self.semantic,
            reporef,
            &self.embed_queue,
            key.semantic(),
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
    embed_queue: &'a EmbedQueue,
}

impl<'a> ChunkCache<'a> {
    async fn for_file(
        sql: &'a SqlDb,
        semantic: &'a Semantic,
        reporef: &'a RepoRef,
        embed_log: &'a EmbedQueue,
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
            embed_queue: embed_log,
            update: Default::default(),
            new_sql: Default::default(),
        }
    }

    /// Update a cache entry with the details from `payload`, or create a new embedding.
    ///
    /// New insertions are queued, and stored on the repository-level
    /// `FileCache` instance that created this.
    fn update_or_embed(&self, data: &'a str, payload: Payload) -> anyhow::Result<()> {
        let id = self.derive_chunk_uuid(data, &payload);
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

                self.embed_queue.push(EmbedChunk {
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
    /// to [`FileCache::commit_embed_log`].
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

    /// Generate a content hash from the embedding data, and pin it to
    /// the containing file's content id.
    fn derive_chunk_uuid(&self, data: &str, payload: &Payload) -> String {
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
