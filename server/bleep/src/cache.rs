use std::{path::PathBuf, sync::Arc};

use anyhow::Context;
use qdrant_client::{
    prelude::QdrantClient,
    qdrant::{
        with_payload_selector, with_vectors_selector, Filter, PointId, PointStruct, SearchPoints,
        WithPayloadSelector, WithVectorsSelector,
    },
};
use sqlx::Sqlite;
use uuid::Uuid;

use crate::{
    repo::RepoRef,
    semantic::{self, make_kv_keyword_filter, Embedding, Payload},
};

use super::db::SqlDb;

#[derive(serde::Serialize, serde::Deserialize)]
pub(crate) struct FreshValue<T> {
    // default value is `false` on deserialize
    pub(crate) fresh: bool,
    pub(crate) value: T,
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

pub(crate) type Branches = Vec<String>;
pub(crate) type RepoCacheSnapshot = Arc<scc::HashMap<PathBuf, FreshValue<(String, Branches)>>>;

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
            "SELECT file_path, content_hash, branches FROM file_cache \
             WHERE repo_ref = ?",
            repo_str,
        }
        .fetch_all(self.db.as_ref())
        .await?;

        let output = scc::HashMap::default();
        for row in rows {
            _ = output.insert(
                PathBuf::from(row.file_path),
                (row.content_hash, serde_json::from_str(&row.branches)?).into(),
            );
        }

        Ok(output.into())
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
		 (repo_ref, file_path, content_hash, branches) \
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

pub struct ChunkCache<'a> {
    qdrant: &'a QdrantClient,
    cache: scc::HashMap<String, FreshValue<Payload>>,
}

impl<'a> ChunkCache<'a> {
    pub async fn for_file(
        qdrant: &'a QdrantClient,
        repo_ref: &'a str,
        repo_name: &'a str,
        relative_path: &'a str,
    ) -> anyhow::Result<ChunkCache<'a>> {
        let response = qdrant
            .search_points(&SearchPoints {
                limit: 10000,
                vector: vec![0f32; semantic::EMBEDDING_DIMENSION],
                collection_name: semantic::COLLECTION_NAME.to_string(),
                offset: None,
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(with_payload_selector::SelectorOptions::Enable(true)),
                }),
                filter: Some(Filter {
                    must: [
                        make_kv_keyword_filter("repo_ref", repo_ref),
                        make_kv_keyword_filter("repo_name", repo_name),
                        make_kv_keyword_filter("relative_path", relative_path),
                    ]
                    .into_iter()
                    .map(Into::into)
                    .collect(),
                    ..Default::default()
                }),
                with_vectors: Some(WithVectorsSelector {
                    selector_options: Some(with_vectors_selector::SelectorOptions::Enable(true)),
                }),
                ..Default::default()
            })
            .await?
            .result
            .into_iter()
            .map(Payload::from_qdrant);

        let cache = scc::HashMap::default();
        for payload in response {
            _ = cache.insert(
                payload.id.as_ref().unwrap().clone(),
                FreshValue::stale(payload),
            );
        }

        Ok(Self { qdrant, cache })
    }

    pub fn update_or_embed(
        &self,
        data: &'a str,
        embedder: impl FnOnce(&'a str) -> anyhow::Result<Embedding>,
        mut payload: Payload,
    ) -> anyhow::Result<()> {
        let id = {
            let mut bytes = [0; 16];
            bytes.copy_from_slice(&blake3::hash(data.as_ref()).as_bytes()[16..32]);
            Uuid::from_bytes(bytes).to_string()
        };

        match self.cache.entry(id) {
            scc::hash_map::Entry::Occupied(mut existing) => {
                payload.embedding = existing.get_mut().value.embedding.take();
                *existing.get_mut() = payload.into();
                existing.get_mut().fresh = true;
            }
            scc::hash_map::Entry::Vacant(vacant) => {
                payload.embedding = Some(embedder(data)?);
                vacant.insert_entry(payload.into());
            }
        }

        Ok(())
    }

    pub async fn commit(self) -> anyhow::Result<(usize, usize)> {
        let mut keys = vec![];
        self.cache
            .scan_async(|k, v| {
                if v.fresh {
                    keys.push(k.clone())
                }
            })
            .await;

        let mut to_upsert = vec![];
        for k in keys {
            let (id, mut payload) = self.cache.remove_async(&k).await.unwrap();
            to_upsert.push(PointStruct {
                id: Some(PointId::from(id)),
                vectors: payload.value.embedding.take().map(Into::into),
                payload: payload.value.into_qdrant(),
            });
        }

        let upsert_size = to_upsert.len();
        if !to_upsert.is_empty() {
            self.qdrant
                .upsert_points(semantic::COLLECTION_NAME, to_upsert, None)
                .await?;
        }

        let mut to_delete = vec![];
        self.cache
            .scan_async(|id, _| to_delete.push(PointId::from(id.to_owned())))
            .await;

        let delete_size = to_delete.len();
        if !to_delete.is_empty() {
            self.qdrant
                .delete_points(semantic::COLLECTION_NAME, &to_delete.into(), None)
                .await?;
        }

        Ok((upsert_size, delete_size))
    }
}
