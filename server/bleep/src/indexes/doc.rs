use async_stream::{stream, try_stream};
use futures::stream::{Stream, StreamExt};
use qdrant_client::qdrant::{
    point_id::PointIdOptions, r#match::MatchValue, vectors_config, with_payload_selector,
    CreateCollection, Distance, FieldCondition, FieldType, Filter, Match, PointId, PointStruct,
    ScrollPoints, SearchPointGroups, SearchPoints, VectorParams, VectorsConfig,
    WithPayloadSelector,
};
use rayon::prelude::*;
use thiserror::Error;
use tracing::info;

pub const COLLECTION_NAME: &str = "web";

use crate::{
    db::SqlDb,
    scraper::{self, Config, Scraper},
    semantic::{make_kv_keyword_filter, Semantic},
};

use std::collections::HashMap;

pub struct Doc {
    sql: SqlDb,
    semantic: Semantic,
}

#[derive(serde::Serialize)]
pub struct Record {
    pub id: i64,
    pub url: String,
    pub name: Option<String>,
    pub favicon: Option<String>,
    pub description: Option<String>,
    pub modified_at: chrono::NaiveDateTime,
}

#[derive(serde::Serialize)]
pub enum Progress {
    Update(Update),
    Done(i64),
}

#[derive(serde::Serialize)]
pub struct Update {
    url: url::Url,
    discovered_count: usize,
    meta: Option<scraper::Meta>,
}

#[derive(Error, Debug)]
pub enum Error {
    #[error("failed to initialize doc index: {0}")]
    Initialize(String),

    #[error("no document with id: {0}")]
    InvalidDocId(i64),

    #[error("not a valid docs url: `{0}`")]
    InvalidUrl(url::Url),

    #[error("failed to parse `{0}` as a url: {1}")]
    UrlParse(String, url::ParseError),

    #[error("failed to perform sql transaction: {0}")]
    Sql(#[from] sqlx::Error),

    #[error("failed to perform qdrant transaction: {0}")]
    Qdrant(anyhow::Error),

    #[error("failed to embed sequence: {0}")]
    Embed(anyhow::Error),
}

impl Doc {
    /// Initialize docs index
    pub async fn create(sql: SqlDb, semantic: Semantic) -> Result<Self, DocError> {
        if create_indexes(semantic.qdrant_client()).await? {
            info!(%COLLECTION_NAME, "created doc index");
        } else {
            info!(%COLLECTION_NAME, "using existing doc index");
        };

        Ok(Self { sql, semantic })
    }

    /// Add a doc source to the index
    pub fn sync(&self, url: url::Url) -> impl Stream<Item = Result<Progress, Error>> + '_ {
        try_stream! {
            // add entry to sqlite
            let url_string = url.to_string();
            let id = sqlx::query! {
                "INSERT INTO docs (url) VALUES (?)",
                url_string,
            }
            .execute(&*self.sql)
                .await?
                .last_insert_rowid();

            let mut meta = None;

            for await progress in self.insert_into_qdrant(id, url.clone()) {
                if let Some(m) = progress.meta.clone() {
                    meta = Some(m);
                };
                yield Progress::Update(progress);
            }

            if let Some(meta) = meta {
                if let Some(title) = meta.title.clone() {
                    sqlx::query! {
                        "UPDATE docs SET name = ? WHERE id = ?",
                        title,
                        id,
                    }
                    .execute(&*self.sql)
                    .await?;
                }
                if let Some(favicon) = meta.icon.clone() {
                    let mut resolved_url = url.clone();
                    resolved_url.set_path(&favicon);
                    let resolved_url_str = resolved_url.as_str();
                    sqlx::query! {
                        "UPDATE docs SET favicon = ? WHERE id = ?",
                        resolved_url_str,
                        id,
                    }
                    .execute(&*self.sql)
                    .await?;
                }
                if let Some(description) = meta.description.clone() {
                    sqlx::query! {
                        "UPDATE docs SET description = ? WHERE id = ?",
                        description,
                        id,
                    }
                    .execute(&*self.sql)
                    .await?;
                }
            }

            yield Progress::Done(id);
        }
    }

    /// Update documentation in the index - this will rescrape the entire website
    pub fn resync(&self, id: i64) -> impl Stream<Item = Result<Progress, Error>> + '_ {
        try_stream! {
            let url = sqlx::query!("SELECT url FROM docs WHERE id = ?", id)
                .fetch_optional(&*self.sql)
                .await?
                .ok_or(Error::InvalidDocId(id))?
                .url;
            let url = url::Url::parse(&url).map_err(|e| Error::UrlParse(url, e))?;

            // delete old docs from qdrant
            self.delete_from_qdrant(id).await?;

            sqlx::query! {
                "UPDATE docs SET modified_at = datetime('now') WHERE id = ?",
                id,
            }
            .execute(&*self.sql)
                .await?;

            // insert new docs into qdrant
            for await progress in self.insert_into_qdrant(id, url) {
                yield Progress::Update(progress);
            };

            yield Progress::Done(id);
        }
    }

    /// Remove this doc source from qdrant and sqlite
    pub async fn delete(&self, id: i64) -> Result<i64, Error> {
        // delete entry from sql
        let id = sqlx::query!("DELETE FROM docs WHERE id = ? RETURNING id", id)
            .fetch_optional(&*self.sql)
            .await?
            .ok_or(Error::InvalidDocId(id))?
            .id;

        self.delete_from_qdrant(id).await?;

        Ok(id)
    }

    /// List all synced doc sources
    pub async fn list(&self) -> Result<Vec<Record>, Error> {
        Ok(
            sqlx::query!("SELECT id, name, url, favicon, description, modified_at FROM docs")
                .fetch_all(&*self.sql)
                .await?
                .into_iter()
                .map(|record| Record {
                    id: record.id,
                    name: record.name,
                    description: record.description,
                    favicon: record.favicon,
                    url: record.url,
                    modified_at: record.modified_at,
                })
                .collect::<Vec<_>>(),
        )
    }

    /// List a synced doc source by id
    pub async fn list_one(&self, id: i64) -> Result<Record, Error> {
        let record = sqlx::query!(
            "SELECT id, name, url, favicon, description, modified_at FROM docs WHERE id = ?",
            id
        )
        .fetch_one(&*self.sql)
        .await?;

        Ok(Record {
            id: record.id,
            name: record.name,
            description: record.description,
            favicon: record.favicon,
            url: record.url,
            modified_at: record.modified_at,
        })
    }

    /// Search for doc source by title
    pub async fn search(&self, q: String, limit: u64) -> Result<Vec<Record>, Error> {
        let limit = limit.to_string();
        let q = format!("%{q}%");
        let records = sqlx::query!(
            "
            SELECT id, name, url, description, favicon, modified_at
            FROM docs 
            WHERE name LIKE $1 OR description LIKE $1 OR url LIKE $1
            LIMIT ?
            ",
            q,
            limit,
        )
        .fetch_all(&*self.sql)
        .await?;

        Ok(records
            .into_iter()
            .map(|r| Record {
                id: r.id,
                name: r.name,
                favicon: r.favicon,
                description: r.description,
                url: r.url,
                modified_at: r.modified_at,
            })
            .collect())
    }

    /// Search for pages in a given doc source
    pub async fn search_sections(
        &self,
        q: String,
        limit: u64,
        id: i64,
    ) -> Result<Vec<SearchResult>, Error> {
        let term_embedding = self
            .semantic
            .embedder()
            .embed(q.as_str())
            .map_err(Error::Embed)?;
        let data = self
            .semantic
            .qdrant_client()
            .search_points(&SearchPoints {
                collection_name: COLLECTION_NAME.into(),
                vector: term_embedding,
                limit,
                filter: Some(Filter {
                    must: vec![make_kv_int_filter("doc_id", id).into()],
                    ..Default::default()
                }),
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(with_payload_selector::SelectorOptions::Enable(true)),
                }),
                ..Default::default()
            })
            .await
            .map_err(Error::Qdrant)?
            .result;

        Ok(data
            .into_iter()
            .filter_map(|s| SearchResult::from_qdrant(s.id.unwrap(), s.payload))
            .collect())
    }

    pub async fn list_sections(&self, limit: u32, id: i64) -> Result<Vec<SearchResult>, Error> {
        let data = self
            .semantic
            .qdrant_client()
            .scroll(&ScrollPoints {
                collection_name: COLLECTION_NAME.into(),
                limit: Some(limit),
                filter: Some(Filter {
                    must: vec![make_kv_int_filter("doc_id", id).into()],
                    ..Default::default()
                }),
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(with_payload_selector::SelectorOptions::Enable(true)),
                }),
                ..Default::default()
            })
            .await
            .map_err(Error::Qdrant)?
            .result;

        Ok(data
            .into_iter()
            .filter_map(|s| SearchResult::from_qdrant(s.id.unwrap(), s.payload))
            .collect())
    }

    /// Scroll pages in a doc
    pub async fn list_pages(&self, limit: u32, id: i64) -> Result<Vec<PageResult>, Error> {
        let data = self
            .semantic
            .qdrant_client()
            .search_groups(&SearchPointGroups {
                vector: vec![0.; 384], // re-export from semantic::schema, this will cause an index wipe
                collection_name: COLLECTION_NAME.into(),
                limit,
                group_size: 1,
                group_by: "relative_url".into(),
                filter: Some(Filter {
                    must: vec![make_kv_int_filter("doc_id", id).into()],
                    ..Default::default()
                }),
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(with_payload_selector::SelectorOptions::Enable(true)),
                }),
                ..Default::default()
            })
            .await
            .map_err(Error::Qdrant)?
            .result
            .ok_or(Error::Qdrant(anyhow::anyhow!("empty search result field")))?;

        let mut data = data
            .groups
            .into_iter()
            .flat_map(|s| s.hits)
            .filter_map(|s| PageResult::from_qdrant(s.payload))
            .collect::<Vec<_>>();

        data.sort_by(|a, b| a.relative_url.cmp(&b.relative_url));

        Ok(data)
    }

    /// Fetch all sections of a page, in order
    pub async fn fetch<S: AsRef<str>>(
        &self,
        id: i64,
        relative_url: S,
    ) -> Result<Vec<SearchResult>, Error> {
        let data = self
            .semantic
            .qdrant_client()
            .scroll(&ScrollPoints {
                collection_name: COLLECTION_NAME.into(),
                limit: Some(9999), // we want all sections
                filter: Some(Filter {
                    must: vec![
                        make_kv_int_filter("doc_id", id).into(),
                        make_kv_keyword_filter("relative_url", relative_url.as_ref()).into(),
                    ],
                    ..Default::default()
                }),
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(with_payload_selector::SelectorOptions::Enable(true)),
                }),
                ..Default::default()
            })
            .await
            .map_err(Error::Qdrant)?
            .result;

        let mut data = data
            .into_iter()
            .filter_map(|s| SearchResult::from_qdrant(s.id.unwrap(), s.payload))
            .collect::<Vec<_>>();

        data.sort_by_key(|s| s.section_range.start);

        Ok(data)
    }

    /// Scrape & insert a doc source into qdrant and return doc metadata if available
    fn insert_into_qdrant(&self, id: i64, url: url::Url) -> impl Stream<Item = Update> + '_ {
        stream! {
            let mut scraper = Scraper::with_config(Config::new(url.clone()));
            let mut stream = Box::pin(scraper.complete());
            let mut handles = Vec::new();
            let mut discovered_count = 0;
            while let Some(doc) = stream.next().await {
                discovered_count += 1;
                let mut progress = Update {
                    url: doc.url.clone(),
                    discovered_count,
                    meta: None
                };
                if let Some(m) = doc.meta.clone() {
                    progress.meta = Some(m);
                }
                yield progress;
                let semantic = self.semantic.clone();
                let u = url.clone();
                handles.push(tokio::task::spawn(async move {
                    let embedder = semantic.embedder();
                    let points_to_insert = doc.embed(id, &u, embedder);
                    let _ = semantic
                        .qdrant_client()
                        .upsert_points(COLLECTION_NAME, points_to_insert, None)
                        .await;
                    }));
            }
        }
    }

    async fn delete_from_qdrant(&self, id: i64) -> Result<(), Error> {
        let id_filter = make_kv_int_filter("doc_id", id).into();
        let selector = Filter {
            must: vec![id_filter],
            ..Default::default()
        }
        .into();
        self.semantic
            .qdrant_client()
            .delete_points(COLLECTION_NAME, &selector, None)
            .await
            .map_err(Error::Qdrant)?;
        Ok(())
    }
}

async fn create_indexes(qdrant: &qdrant_client::prelude::QdrantClient) -> Result<bool, Error> {
    if !qdrant
        .has_collection(COLLECTION_NAME)
        .await
        .unwrap_or(false)
    {
        qdrant
            .create_collection(&CreateCollection {
                collection_name: COLLECTION_NAME.to_string(),
                vectors_config: Some(VectorsConfig {
                    config: Some(vectors_config::Config::Params(VectorParams {
                        size: 384_u64,
                        distance: Distance::Cosine.into(),
                        ..Default::default()
                    })),
                }),
                ..Default::default()
            })
            .await
            .map_err(Error::Qdrant)?;

        // initialize indexes
        let text_fields = &["text", "relative_path", "ancestry_text"];
        for field in text_fields {
            qdrant
                .create_field_index(COLLECTION_NAME, field, FieldType::Text, None, None)
                .await
                .map_err(Error::Qdrant)?;
        }
        return Ok(true);
    }
    Ok(false)
}

impl scraper::Document {
    fn embed(
        &self,
        id: i64,
        url: &url::Url,
        embedder: &dyn crate::semantic::Embedder,
    ) -> Vec<PointStruct> {
        info!("inserting points for `{}`", self.url.as_str());
        scraper::chunk::by_section(
            &self.content,           // section content
            url.as_str(),            // section url base
            &self.relative_url(url), // relative path
            embedder.tokenizer(),
        )
        .par_bridge()
        .map(|(section, chunks)| {
            let embeddings = chunks
                .iter()
                .filter_map(|c| {
                    embedder
                        .embed(&format!(
                            "{}\t{}\t{}\n{}",
                            url.as_str(),
                            &self.relative_url(url),
                            section.ancestry_str(),
                            c.data,
                        ))
                        .ok()
                })
                .collect::<Vec<_>>();
            let average_embedding = embeddings.iter().fold(vec![0.; 384], |acc, e| {
                acc.into_iter()
                    .zip(e.iter())
                    .map(|(acc_elem, e_elem)| acc_elem + e_elem)
                    .collect::<Vec<_>>()
            });
            (section, average_embedding)
        })
        .map(|(section, avg_embedding)| {
            let mut payload = HashMap::new();
            payload.insert("doc_id".to_owned(), id.into());
            payload.insert("doc_source".to_owned(), url.to_string().into());
            payload.insert("relative_url".to_owned(), self.relative_url(url).into());
            payload.insert(
                "start".to_owned(),
                (section.section_range.start.byte as i64).into(),
            );
            payload.insert(
                "end".to_owned(),
                (section.section_range.end.byte as i64).into(),
            );
            payload.insert("text".to_owned(), section.data.into());
            payload.insert("header".to_owned(), section.header.unwrap_or("").into());
            payload.insert("ancestry_text".to_owned(), section.ancestry_str().into());
            payload.insert("ancestry".to_owned(), section.ancestry.into());
            PointStruct {
                id: Some(PointId {
                    point_id_options: Some(PointIdOptions::Uuid(uuid::Uuid::new_v4().to_string())),
                }),
                vectors: Some(avg_embedding.into()),
                payload,
            }
        })
        .collect::<Vec<_>>()
    }
}

fn make_kv_int_filter(key: &str, value: i64) -> FieldCondition {
    let key = key.to_owned();
    let value = value.to_owned();
    FieldCondition {
        key,
        r#match: Some(Match {
            match_value: MatchValue::Integer(value).into(),
        }),
        ..Default::default()
    }
}

#[derive(serde::Serialize)]
pub struct SearchResult {
    pub doc_id: i64,
    pub point_id: uuid::Uuid,
    pub doc_source: url::Url,
    pub relative_url: String,
    pub header: String,
    pub ancestry: Vec<String>,
    pub text: String,
    pub section_range: std::ops::Range<usize>,
}

impl SearchResult {
    pub fn from_qdrant(
        id: PointId,
        payload: HashMap<String, qdrant_client::qdrant::Value>,
    ) -> Option<Self> {
        let doc_id = payload["doc_id"].as_integer()?;
        let point_id = id.point_id_options.and_then(|opts| match opts {
            PointIdOptions::Uuid(u) => uuid::Uuid::try_parse(&u).ok(),
            _ => None,
        })?;
        let doc_source = payload["doc_source"]
            .as_str()
            .and_then(|s| url::Url::parse(s).ok())?;
        let relative_url = payload["relative_url"].as_str().map(ToOwned::to_owned)?;
        let section_start_byte: usize = payload["start"]
            .as_integer()
            .and_then(|i| i.try_into().ok())?;
        let section_end_byte: usize = payload["end"]
            .as_integer()
            .and_then(|i| i.try_into().ok())?;
        let header = payload["header"].as_str().map(ToOwned::to_owned)?;
        let ancestry = payload["ancestry"]
            .as_list()
            .map(ToOwned::to_owned)?
            .into_iter()
            .map(|item| item.as_str().unwrap().to_owned())
            .collect();
        let text = payload["text"].as_str().map(ToOwned::to_owned)?;
        Some(Self {
            doc_id,
            point_id,
            doc_source,
            relative_url,
            header,
            ancestry,
            text,
            section_range: section_start_byte..section_end_byte,
        })
    }
}

#[derive(serde::Serialize)]
pub struct PageResult {
    pub doc_id: i64,
    pub doc_source: url::Url,
    pub relative_url: String,
    pub title: String,
}

impl PageResult {
    pub fn from_qdrant(payload: HashMap<String, qdrant_client::qdrant::Value>) -> Option<Self> {
        let doc_id = payload["doc_id"].as_integer()?;
        let doc_source = payload["doc_source"]
            .as_str()
            .and_then(|s| url::Url::parse(s).ok())?;
        let relative_url = payload["relative_url"].as_str().map(ToOwned::to_owned)?;
        let title = format!("{} - placeholder", relative_url.clone());
        Some(Self {
            doc_id,
            doc_source,
            relative_url,
            title,
        })
    }
}
