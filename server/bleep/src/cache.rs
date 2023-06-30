use std::sync::{Arc, RwLock};

use qdrant_client::{
    prelude::QdrantClient,
    qdrant::{
        points_selector::PointsSelectorOneOf, with_payload_selector, with_vectors_selector, Filter,
        PointId, PointStruct, PointsIdsList, PointsSelector, ScrollPoints, WithPayloadSelector,
        WithVectorsSelector,
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

pub(crate) type RepoCacheSnapshot = Arc<scc::HashMap<String, FreshValue<()>>>;

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

    pub(crate) async fn persist(
        &self,
        reporef: &RepoRef,
        cache: RepoCacheSnapshot,
    ) -> anyhow::Result<()> {
        let mut tx = self.db.begin().await?;
        self.delete_tx(&mut tx, reporef).await?;

        let keys = {
            let mut keys = vec![];
            cache.scan_async(|k, _v| keys.push(k.clone())).await;
            keys
        };

        for hash in keys {
            let repo_str = reporef.to_string();
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

    pub(crate) async fn delete_for_repo(&self, reporef: &RepoRef) -> anyhow::Result<()> {
        let mut tx = self.db.begin().await?;
        self.delete_tx(&mut tx, reporef).await?;
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
    cache: scc::HashMap<String, FreshValue<Payload>>,
    update: RwLock<Vec<(PointsSelector, qdrant_client::client::Payload)>>,
    new: RwLock<Vec<PointStruct>>,
}

impl<'a> ChunkCache<'a> {
    pub async fn for_file(
        qdrant: &'a QdrantClient,
        content_hash: &'a str,
    ) -> anyhow::Result<ChunkCache<'a>> {
        let response = qdrant
            .scroll(&ScrollPoints {
                collection_name: semantic::COLLECTION_NAME.to_string(),
                limit: Some(1_000_000),
                filter: Some(Filter {
                    must: [make_kv_keyword_filter("content_hash", content_hash)]
                        .into_iter()
                        .map(Into::into)
                        .collect(),
                    ..Default::default()
                }),
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(with_payload_selector::SelectorOptions::Enable(true)),
                }),
                with_vectors: Some(WithVectorsSelector {
                    selector_options: Some(with_vectors_selector::SelectorOptions::Enable(false)),
                }),
                ..Default::default()
            })
            .await?
            .result
            .into_iter()
            .map(Payload::from_scroll);

        let cache = scc::HashMap::default();
        for payload in response {
            _ = cache.insert(
                payload.id.as_ref().unwrap().clone(),
                FreshValue::stale(payload),
            );
        }

        Ok(Self {
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
        let id = {
            let mut bytes = [0; 16];
            bytes.copy_from_slice(&blake3::hash(data.as_ref()).as_bytes()[16..32]);
            Uuid::from_bytes(bytes).to_string()
        };

        match self.cache.entry(id) {
            scc::hash_map::Entry::Occupied(mut existing) => {
                if payload != existing.get().value {
                    self.update.write().unwrap().push((
                        PointsSelector {
                            points_selector_one_of: Some(PointsSelectorOneOf::Points(
                                PointsIdsList {
                                    ids: vec![PointId::from(existing.key().to_owned())],
                                },
                            )),
                        },
                        qdrant_client::client::Payload::new_from_hashmap(payload.into_qdrant()),
                    ));
                }
                existing.get_mut().fresh = true;
            }
            scc::hash_map::Entry::Vacant(vacant) => {
                self.new.write().unwrap().push(PointStruct {
                    id: Some(PointId::from(vacant.key().clone())),
                    vectors: Some(embedder(data)?.into()),
                    payload: payload.into_qdrant(),
                });
            }
        }

        Ok(())
    }

    pub async fn commit(self) -> anyhow::Result<(usize, usize, usize)> {
        let mut keys = vec![];
        self.cache
            .scan_async(|k, v| {
                if v.fresh {
                    keys.push(k.clone())
                }
            })
            .await;

        let update: Vec<_> = std::mem::take(self.update.write().unwrap().as_mut());
        let update_size = update.len();
        futures::future::join_all(update.into_iter().map(|(id, p)| async move {
            // need another async block to get around scoping issues
            // with referential `&id`
            self.qdrant
                .set_payload(semantic::COLLECTION_NAME, &id, p, None)
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
                .upsert_points(semantic::COLLECTION_NAME, new, None)
                .await?;
        }

        Ok((new_size, update_size, delete_size))
    }
}
