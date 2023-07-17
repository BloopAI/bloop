use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
};

use qdrant_client::{
    prelude::QdrantClient,
    qdrant::{
        point_id::PointIdOptions, points_selector::PointsSelectorOneOf, with_payload_selector,
        with_vectors_selector, Filter, PayloadIncludeSelector, PointId, PointStruct, PointsIdsList,
        PointsSelector, ScrollPoints, Value, WithPayloadSelector, WithVectorsSelector,
    },
};
use sqlx::Sqlite;
use uuid::Uuid;

use crate::{
    repo::RepoRef,
    semantic::{self, make_kv_keyword_filter, Embedding, Payload},
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

/// Unique content in a repository, where every entry is a file
/// The cache keys are directly mirrored in Tantivy, as Tantivy can't
/// upsert content
pub(crate) struct FileCache<'a> {
    db: &'a SqlDb,
    reporef: &'a RepoRef,
}

impl<'a> FileCache<'a> {
    pub(crate) fn new(db: &'a SqlDb, reporef: &'a RepoRef) -> Self {
        Self { db, reporef }
    }

    pub(crate) async fn retrieve(&self) -> anyhow::Result<FileCacheSnapshot> {
        let repo_str = self.reporef.to_string();
        let rows = sqlx::query! {
            "SELECT cache_hash FROM file_cache \
             WHERE repo_ref = ?",
            repo_str,
        }
        .fetch_all(self.db.as_ref())
        .await?;

        let output = scc::HashMap::default();
        for row in rows {
            _ = output.insert(row.cache_hash, FreshValue::stale(()));
        }

        Ok(output.into())
    }

    pub(crate) async fn persist(&self, cache: FileCacheSnapshot) -> anyhow::Result<()> {
        let mut tx = self.db.begin().await?;
        self.delete_tx(&mut tx, self.reporef).await?;

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
        self.delete_tx(&mut tx, self.reporef).await?;
        tx.commit().await?;

        Ok(())
    }

    async fn delete_tx(
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

pub struct ChunkCache<'a> {
    qdrant: &'a QdrantClient,
    cache: scc::HashMap<String, FreshValue<HashMap<String, Value>>>,
    update: RwLock<Vec<(PointsSelector, qdrant_client::client::Payload)>>,
    new: RwLock<Vec<PointStruct>>,
    tantivy_cache_key: &'a str,
}

impl<'a> ChunkCache<'a> {
    pub async fn for_file(
        qdrant: &'a QdrantClient,
        tantivy_cache_key: &'a str,
        is_cold_run: bool,
    ) -> anyhow::Result<ChunkCache<'a>> {
        if is_cold_run {
            return Ok(Self {
                tantivy_cache_key,
                qdrant,
                cache: Default::default(),
                update: Default::default(),
                new: Default::default(),
            });
        }

        let response = qdrant
            .scroll(&ScrollPoints {
                collection_name: semantic::COLLECTION_NAME.to_string(),
                limit: Some(1_000),
                filter: Some(Filter {
                    must: [make_kv_keyword_filter("content_hash", tantivy_cache_key)]
                        .into_iter()
                        .map(Into::into)
                        .collect(),
                    ..Default::default()
                }),
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(with_payload_selector::SelectorOptions::Include(
                        PayloadIncludeSelector {
                            fields: vec!["branches".to_string()],
                        },
                    )),
                }),
                with_vectors: Some(WithVectorsSelector {
                    selector_options: Some(with_vectors_selector::SelectorOptions::Enable(false)),
                }),
                ..Default::default()
            })
            .await?
            .result
            .into_iter();

        let cache = scc::HashMap::default();
        for point in response {
            let Some(PointId { point_id_options: Some(PointIdOptions::Uuid(id)) }) = point.id
	    else {
		// unless the db was corrupted/written by someone else,
		// this shouldn't happen
		unreachable!("corrupted db");
	    };

            _ = cache.insert(id, FreshValue::stale(point.payload));
        }

        Ok(Self {
            tantivy_cache_key,
            qdrant,
            cache,
            update: Default::default(),
            new: Default::default(),
        })
    }

    pub fn update_or_embed(
        &self,
        data: &'a str,
        embedder: impl FnOnce(&'a str) -> anyhow::Result<Embedding>,
        payload: Payload,
    ) -> anyhow::Result<()> {
        let id = self.cache_key(data);
        let update_payload = payload.into_qdrant();

        match self.cache.entry(id) {
            scc::hash_map::Entry::Occupied(mut existing) => {
                if !existing
                    .get()
                    .value
                    .iter()
                    .all(|(k, v)| update_payload.get(k) == Some(v))
                {
                    self.update.write().unwrap().push((
                        PointsSelector {
                            points_selector_one_of: Some(PointsSelectorOneOf::Points(
                                PointsIdsList {
                                    ids: vec![PointId::from(existing.key().to_owned())],
                                },
                            )),
                        },
                        qdrant_client::client::Payload::new_from_hashmap(update_payload),
                    ));
                }
                existing.get_mut().fresh = true;
            }
            scc::hash_map::Entry::Vacant(vacant) => {
                self.new.write().unwrap().push(PointStruct {
                    id: Some(PointId::from(vacant.key().clone())),
                    vectors: Some(embedder(data)?.into()),
                    payload: update_payload,
                });
            }
        }

        Ok(())
    }

    /// Generate a content hash from the embedding data, and pin it to
    /// the containing file's content id.
    fn cache_key(&self, data: &str) -> String {
        let id = {
            let mut bytes = [0; 16];
            let mut hasher = blake3::Hasher::new();
            hasher.update(self.tantivy_cache_key.as_bytes());
            hasher.update(data.as_ref());
            bytes.copy_from_slice(&hasher.finalize().as_bytes()[16..32]);
            Uuid::from_bytes(bytes).to_string()
        };
        id
    }

    pub async fn commit(self) -> anyhow::Result<(usize, usize, usize)> {
        let update: Vec<_> = std::mem::take(self.update.write().unwrap().as_mut());
        let update_size = update.len();
        futures::future::join_all(update.into_iter().map(|(id, p)| async move {
            // need another async block to get around scoping issues
            // with referential `&id`
            self.qdrant
                .set_payload_blocking(semantic::COLLECTION_NAME, &id, p, None)
                .await
        }))
        .await
        .into_iter()
        .collect::<Result<Vec<_>, _>>()?;

        let mut to_delete = vec![];
        self.cache
            .scan_async(|id, p| {
                if !p.fresh {
                    to_delete.push(PointId::from(id.to_owned()))
                }
            })
            .await;

        let delete_size = to_delete.len();
        if !to_delete.is_empty() {
            self.qdrant
                .delete_points(semantic::COLLECTION_NAME, &to_delete.into(), None)
                .await?;
        }

        let new: Vec<_> = std::mem::take(self.new.write().unwrap().as_mut());
        let new_size = new.len();
        if !new.is_empty() {
            self.qdrant
                .upsert_points_blocking(semantic::COLLECTION_NAME, new, None)
                .await?;
        }

        Ok((new_size, update_size, delete_size))
    }
}
