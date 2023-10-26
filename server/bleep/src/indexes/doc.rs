use async_stream::{stream, try_stream};
use futures::stream::{Stream, StreamExt};
use qdrant_client::qdrant::{
    point_id::PointIdOptions, r#match::MatchValue, vectors_config, with_payload_selector,
    CreateCollection, Distance, FieldCondition, FieldType, Filter, Match, PointId, PointStruct,
    ScrollPoints, SearchPointGroups, VectorParams, VectorsConfig, WithPayloadSelector,
};
use rayon::prelude::*;
use tantivy::{
    collector::TopDocs,
    query::{BooleanQuery, BoostQuery, Query, RegexQuery, TermQuery},
    schema::{
        Field, IndexRecordOption, Schema, SchemaBuilder, Term, TextFieldIndexing, TextOptions,
        FAST, INDEXED, STORED, TEXT,
    },
    tokenizer::NgramTokenizer,
    DocId, Score, SegmentReader,
};
use thiserror::Error;
use tokio::sync::Mutex;
use tracing::info;

pub const COLLECTION_NAME: &str = "web";

use crate::{
    db::SqlDb,
    query::compiler::{case_permutations, trigrams},
    scraper::{self, Config, Scraper},
    semantic::{make_kv_keyword_filter, Semantic},
};

use std::{collections::HashMap, sync::Arc};

#[derive(Clone)]
pub struct Doc {
    sql: SqlDb,
    semantic: Semantic,
    section_index: tantivy::Index,
    section_schema: SectionSchema,
}

#[derive(Clone)]
pub struct SectionSchema {
    pub(super) schema: Schema,

    pub doc_id: Field,
    pub point_id: Field,
    pub doc_source: Field,
    pub doc_title: Field,
    pub doc_description: Field,
    pub relative_url: Field,
    pub header: Field,
    pub ancestry: Field,
    pub text: Field,
    pub start_byte: Field,
    pub end_byte: Field,
    pub section_depth: Field,
    // pub raw_relative_url: Field,
}

impl SectionSchema {
    pub fn new() -> Self {
        let mut builder = SchemaBuilder::new();
        let trigram = TextOptions::default().set_stored().set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("default")
                .set_index_option(IndexRecordOption::WithFreqsAndPositions),
        );

        let doc_id = builder.add_i64_field("doc_id", FAST | STORED | INDEXED);
        let point_id = builder.add_text_field("point_id", STORED);
        let doc_source = builder.add_text_field("doc_source", STORED);
        let doc_title = builder.add_text_field("doc_title", TEXT | STORED);
        let doc_description = builder.add_text_field("doc_description", TEXT | STORED);
        let relative_url = builder.add_text_field("relative_url", TEXT | STORED);
        let header = builder.add_text_field("header", TEXT | STORED);
        let ancestry = builder.add_text_field("ancestry", TEXT | STORED);
        let text = builder.add_text_field("text", trigram);
        let start_byte = builder.add_u64_field("start_byte", STORED);
        let end_byte = builder.add_u64_field("end_byte", STORED);
        let section_depth = builder.add_u64_field("section_depth", FAST | STORED);

        Self {
            doc_id,
            point_id,
            doc_source,
            doc_title,
            doc_description,
            relative_url,
            header,
            ancestry,
            text,
            start_byte,
            end_byte,
            section_depth,
            // raw_relative_url,
            schema: builder.build(),
        }
    }
}

static STATUS_DONE: &str = "done";
static STATUS_INDEXING: &str = "indexing";

#[derive(serde::Serialize)]
pub struct Record {
    pub id: i64,
    pub url: String,
    pub index_status: String,
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

    #[serde(skip)]
    meta: scraper::Meta,
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

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("tantivy error: {0}")]
    Tantivy(#[from] tantivy::error::TantivyError),
}

impl Doc {
    fn index_writer(&self) -> Result<tantivy::IndexWriter, Error> {
        self.section_index
            .writer(crate::config::default_buffer_size())
            .map_err(Error::Tantivy)
    }

    fn index_reader(&self) -> Result<tantivy::IndexReader, Error> {
        self.section_index.reader().map_err(Error::Tantivy)
    }
    /// Initialize docs index
    pub async fn create(
        sql: SqlDb,
        semantic: Semantic,
        path: &std::path::Path,
    ) -> Result<Self, Error> {
        if create_indexes(semantic.qdrant_client()).await? {
            info!(%COLLECTION_NAME, "created doc index");
        } else {
            info!(%COLLECTION_NAME, "using existing doc index");
        };

        std::fs::create_dir_all(path)?;

        let section_schema = SectionSchema::new();
        let mut section_index = tantivy::Index::open_or_create(
            tantivy::directory::MmapDirectory::open(path)
                .map_err(|e| Error::Initialize(e.to_string()))?,
            section_schema.schema.clone(),
        )
        .map_err(|e| Error::Initialize(e.to_string()))?;

        section_index
            .set_default_multithread_executor()
            .map_err(|e| Error::Initialize(e.to_string()))?;
        section_index
            .set_multithread_executor(4)
            .map_err(|e| Error::Initialize(e.to_string()))?;

        section_index
            .tokenizers()
            .register("default", NgramTokenizer::new(1, 3, false).unwrap());

        // Ok(index)

        Ok(Self {
            sql,
            semantic,
            section_index,
            section_schema,
        })
    }

    async fn set_title(&self, title: &str, id: i64) -> Result<(), Error> {
        sqlx::query! {
            "UPDATE docs SET name = ? WHERE id = ?",
            title,
            id,
        }
        .execute(&*self.sql)
        .await
        .map(|_| ())
        .map_err(Error::Sql)
    }

    async fn set_favicon(&self, favicon: &str, id: i64) -> Result<(), Error> {
        sqlx::query! {
            "UPDATE docs SET favicon = ? WHERE id = ?",
            favicon,
            id,
        }
        .execute(&*self.sql)
        .await
        .map(|_| ())
        .map_err(Error::Sql)
    }

    async fn set_description(&self, description: &str, id: i64) -> Result<(), Error> {
        sqlx::query! {
            "UPDATE docs SET description = ? WHERE id = ?",
            description,
            id,
        }
        .execute(&*self.sql)
        .await
        .map(|_| ())
        .map_err(Error::Sql)
    }

    async fn set_index_status(&self, status: &str, id: i64) -> Result<(), Error> {
        let status = status.to_string();
        sqlx::query! {
            "UPDATE docs SET index_status = ? WHERE id = ?",
            status,
            id,
        }
        .execute(&*self.sql)
        .await
        .map(|_| ())
        .map_err(Error::Sql)
    }

    /// Add a doc source to the index
    pub async fn sync(
        self,
        url: url::Url,
    ) -> Result<impl Stream<Item = Result<Progress, Error>>, Error> {
        // add entry to sqlite
        let url_string = url.to_string();
        let id = sqlx::query! {
            "INSERT INTO docs (url, index_status) VALUES (?, ?)",
            url_string,
            STATUS_INDEXING,
        }
        .execute(&*self.sql)
        .await?
        .last_insert_rowid();

        let index_writer = Arc::new(Mutex::new(self.index_writer()?));

        let stream = try_stream! {
            let mut is_meta_set = false;
            let stream = self.clone().insert_into_qdrant(id, url.clone(), Arc::clone(&index_writer));

            // TODO: handle empty stream error here

            for await progress in stream {
                // populate metadata in sqlite
                //
                // the first scraped doc that contains metadata is used to populate
                // metadata in sqlite - this is typically the base_url entered by the user,
                // if the base_url does not contain any metadata, we move on the the second
                // scraped url
                if !progress.meta.is_empty() {
                    if !is_meta_set {
                        // set title
                        if let Some(title) = &progress.meta.title {
                            self.set_title(title, id).await?;
                        }

                        // set favicon
                        if let Some(favicon) = &progress.meta.icon {
                            let resolved_url = url::Url::parse(&favicon).unwrap_or_else(|_|
                                normalize_absolute_url(&url, &favicon)
                            );
                            self.set_favicon(resolved_url.as_str(), id).await?;
                        }

                        // set description
                        if let Some(description) = &progress.meta.description {
                            self.set_description(description, id).await?;

                        }

                        // do not set meta for this doc provider in subsequent turns
                        is_meta_set = true;
                    }
                };
                yield Progress::Update(progress);
            }

            self.set_index_status(STATUS_DONE, id).await?;
            yield Progress::Done(id);
        };

        Ok(stream)
    }

    /// Update documentation in the index - this will rescrape the entire website
    pub async fn resync(self, id: i64) -> Result<impl Stream<Item = Progress>, Error> {
        let url = sqlx::query!("SELECT url FROM docs WHERE id = ?", id)
            .fetch_optional(&*self.sql)
            .await?
            .ok_or(Error::InvalidDocId(id))?
            .url;
        let url = url::Url::parse(&url).map_err(|e| Error::UrlParse(url, e))?;

        // delete old docs from qdrant
        self.delete_from_qdrant(id).await?;

        // delete old docs from tantivy
        self.index_writer()?
            .delete_term(Term::from_field_i64(self.section_schema.doc_id, id));

        sqlx::query! {
            "UPDATE docs SET modified_at = datetime('now') WHERE id = ?",
            id,
        }
        .execute(&*self.sql)
        .await?;

        let index_writer = Arc::new(Mutex::new(self.index_writer()?));

        let progress_stream = self
            .insert_into_qdrant(id, url, Arc::clone(&index_writer))
            .map(|progress| Progress::Update(progress));
        let done_stream = futures::stream::once(async move { Progress::Done(id) });

        Ok(progress_stream.chain(done_stream))
    }

    /// Remove this doc source from qdrant and sqlite
    pub async fn delete(&self, id: i64) -> Result<i64, Error> {
        // delete entry from sql
        let id = sqlx::query!("DELETE FROM docs WHERE id = ? RETURNING id", id)
            .fetch_optional(&*self.sql)
            .await?
            .ok_or(Error::InvalidDocId(id))?
            .id;

        // delete entry from qdrant
        self.delete_from_qdrant(id).await?;

        // delete entry from tantivy
        self.index_writer()?
            .delete_term(Term::from_field_i64(self.section_schema.doc_id, id));

        Ok(id)
    }

    /// List all synced doc sources
    pub async fn list(&self) -> Result<Vec<Record>, Error> {
        Ok(sqlx::query!(
            "SELECT id, index_status, name, url, favicon, description, modified_at FROM docs"
        )
        .fetch_all(&*self.sql)
        .await?
        .into_iter()
        .map(|record| Record {
            id: record.id,
            name: record.name,
            index_status: record.index_status,
            description: record.description,
            favicon: record.favicon,
            url: record.url,
            modified_at: record.modified_at,
        })
        .collect::<Vec<_>>())
    }

    /// List a synced doc source by id
    pub async fn list_one(&self, id: i64) -> Result<Record, Error> {
        let record = sqlx::query!(
            "SELECT id, index_status, name, url, favicon, description, modified_at FROM docs WHERE id = ?",
            id
        )
        .fetch_one(&*self.sql)
        .await?;

        Ok(Record {
            id: record.id,
            name: record.name,
            index_status: record.index_status,
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
            SELECT id, name, url, description, favicon, modified_at, index_status
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
                index_status: r.index_status,
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
        // use the tantivy index for section search
        let reader = self.index_reader()?;
        let searcher = reader.searcher();

        let doc_id_query = Box::new(TermQuery::new(
            Term::from_field_i64(self.section_schema.doc_id, id),
            IndexRecordOption::Basic,
        ));

        let relative_url_query = Box::new(BoostQuery::new(
            build_trigram_query(&q, self.section_schema.relative_url),
            1.5,
        )) as Box<dyn Query>;

        let title_query = Box::new(BoostQuery::new(
            build_trigram_query(&q, self.section_schema.doc_title),
            1.5,
        )) as Box<dyn Query>;

        let ancestry_query = Box::new(BoostQuery::new(
            build_trigram_query(&q, self.section_schema.ancestry),
            1.25,
        )) as Box<dyn Query>;

        let text_query = build_trigram_query(&q, self.section_schema.text);

        let query = BooleanQuery::intersection(vec![
            doc_id_query,
            Box::new(BooleanQuery::union(vec![
                ancestry_query,
                title_query,
                relative_url_query,
                text_query,
            ])) as Box<dyn Query>,
        ]);

        let section_depth_field = (&self.section_schema.schema)
            .get_field_name(self.section_schema.section_depth)
            .to_owned();
        let collector = TopDocs::with_limit(limit as usize).tweak_score(
            move |segment_reader: &SegmentReader| {
                let section_depth_reader = segment_reader
                    .fast_fields()
                    .u64(section_depth_field.as_str())
                    .unwrap();

                move |doc: DocId, original_score: Score| {
                    let section_depth: u64 = section_depth_reader.values.get_val(doc) + 1;
                    let section_depth_falloff = 2.0_f32.powf(1. / section_depth as f32);
                    section_depth_falloff * original_score
                }
            },
        );
        let results = searcher.search(&query, &collector).unwrap();

        Ok(results
            .into_iter()
            .map(|(_score, addr)| {
                let retrieved_doc = searcher
                    .doc(addr)
                    .expect("failed to get document by address");
                SearchResult {
                    doc_id: retrieved_doc
                        .get_first(self.section_schema.doc_id)
                        .unwrap()
                        .as_i64()
                        .unwrap(),
                    point_id: retrieved_doc
                        .get_first(self.section_schema.point_id)
                        .unwrap()
                        .as_text()
                        .unwrap()
                        .parse::<uuid::Uuid>()
                        .unwrap(),
                    doc_source: retrieved_doc
                        .get_first(self.section_schema.doc_source)
                        .unwrap()
                        .as_text()
                        .unwrap()
                        .parse::<url::Url>()
                        .unwrap(),
                    ancestry: retrieved_doc
                        .get_first(self.section_schema.ancestry)
                        .unwrap()
                        .as_text()
                        .map(|t| {
                            scraper::chunk::Section::ancestry_from_str(t)
                                .into_iter()
                                .map(ToOwned::to_owned)
                                .collect()
                        })
                        .unwrap(),
                    header: retrieved_doc
                        .get_first(self.section_schema.header)
                        .unwrap()
                        .as_text()
                        .unwrap()
                        .to_owned(),
                    relative_url: retrieved_doc
                        .get_first(self.section_schema.relative_url)
                        .unwrap()
                        .as_text()
                        .unwrap()
                        .to_owned(),
                    section_range: retrieved_doc
                        .get_first(self.section_schema.start_byte)
                        .unwrap()
                        .as_u64()
                        .unwrap() as usize
                        ..retrieved_doc
                            .get_first(self.section_schema.end_byte)
                            .unwrap()
                            .as_u64()
                            .unwrap() as usize,
                    text: retrieved_doc
                        .get_first(self.section_schema.text)
                        .unwrap()
                        .as_text()
                        .unwrap()
                        .to_owned(),
                }
            })
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
        limit: u32,
    ) -> Result<Vec<SearchResult>, Error> {
        let data = self
            .semantic
            .qdrant_client()
            .scroll(&ScrollPoints {
                collection_name: COLLECTION_NAME.into(),
                limit: Some(limit),
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

        if data.is_empty() {
            return Err(Error::InvalidDocId(id));
        }

        let mut data = data
            .into_iter()
            .filter_map(|s| SearchResult::from_qdrant(s.id.unwrap(), s.payload))
            .collect::<Vec<_>>();

        data.sort_by_key(|s| s.section_range.start);

        Ok(data)
    }

    pub async fn contains_page<S: AsRef<str>>(&self, id: i64, relative_url: S) -> bool {
        use std::ops::Not;
        self.semantic
            .qdrant_client()
            .scroll(&ScrollPoints {
                collection_name: COLLECTION_NAME.into(),
                limit: Some(1),
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
            .map(|v| v.result.is_empty())
            .unwrap_or(true)
            .not()
    }

    /// Scrape & insert a doc source into qdrant and return doc metadata if available
    fn insert_into_qdrant(
        self,
        id: i64,
        url: url::Url,
        index_writer: Arc<Mutex<tantivy::IndexWriter>>,
    ) -> impl Stream<Item = Update> {
        stream! {
            let mut scraper = Scraper::with_config(Config::new(url.clone()));
            let mut stream = Box::pin(scraper.complete());
            let mut handles = Vec::new();
            let mut discovered_count = 0;
            while let Some(doc) = stream.next().await {
                discovered_count += 1;
                let progress = Update {
                    url: doc.url.clone(),
                    discovered_count,
                    meta: doc.meta.clone(),
                };
                yield progress;
                let semantic = self.semantic.clone();
                let u = url.clone();
                let section_schema = self.section_schema.clone();
                let index_writer = Arc::clone(&index_writer);
                if !self.contains_page(id, doc.relative_url(&url)).await
                {
                    handles.push(tokio::task::spawn(async move {
                        let embedder = semantic.embedder();
                        let (tantivy_docs_to_insert, points_to_insert) = doc.embed(id, &u, embedder, section_schema);
                        let mut lock = index_writer.lock().await;
                        for d in tantivy_docs_to_insert {
                            info!("inserting doc into tantivy: `{}` - `{}`", id, u.as_str());
                            lock.add_document(d);
                        }
                        lock.commit();
                        let _ = semantic
                            .qdrant_client()
                            .upsert_points(COLLECTION_NAME, points_to_insert, None)
                            .await;
                        }));
                }
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
        schema: SectionSchema,
    ) -> (Vec<tantivy::Document>, Vec<PointStruct>) {
        info!("inserting points for `{}`", self.url.as_str());
        scraper::chunk::by_section(
            &self.content,           // section content
            url.as_str(),            // section url base
            &self.relative_url(url), // relative path
            embedder.tokenizer(),
        )
        .par_bridge()
        // .inspect(|(section, chunks)| {
        //     println!("{}", section.data);
        // })
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
            let point_id = {
                let mut bytes = [0; 16];
                let mut hasher = blake3::Hasher::new();
                hasher.update(&id.to_le_bytes()); // doc id
                hasher.update(self.meta.title.as_deref().unwrap_or("").as_bytes()); // title of this page
                hasher.update(&section.data.as_bytes()); // section data
                hasher.update(&section.section_range.start.byte.to_le_bytes()); // section start location
                hasher.update(&section.section_range.end.byte.to_le_bytes()); // section end location
                bytes.copy_from_slice(&hasher.finalize().as_bytes()[16..32]);
                uuid::Uuid::from_bytes(bytes).to_string()
            };

            use tantivy::doc;
            let tantivy_doc = doc!(
                schema.doc_id => id,
                schema.point_id => point_id.as_str(),
                schema.doc_source => url.as_str(),
                schema.doc_title => self.meta.title.as_deref().clone().unwrap_or_default(),
                schema.doc_description => self.meta.description.as_deref().clone().unwrap_or_default(),
                schema.relative_url => self.relative_url(url).as_str(),
                schema.header => section.header.as_deref().clone().unwrap_or_default(),
                schema.ancestry => section.ancestry_str().as_str(),
                schema.text => section.data,
                schema.start_byte => section.section_range.start.byte as u64,
                schema.end_byte => section.section_range.start.byte as u64,
                schema.section_depth => section.ancestry.len() as u64,
            );

            let mut payload = HashMap::new();
            let favicon = self.meta.icon.as_deref().unwrap_or("");
            let favicon_url = url::Url::parse(&favicon)
                .unwrap_or_else(|_| normalize_absolute_url(&url, &favicon));
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

            // doc meta
            payload.insert(
                "doc_title".to_owned(),
                self.meta.title.as_deref().unwrap_or("").into(),
            );
            payload.insert(
                "doc_description".to_owned(),
                self.meta.description.as_deref().unwrap_or("").into(),
            );
            payload.insert("doc_favicon".to_owned(), favicon_url.as_str().into());
            (
                tantivy_doc,
                PointStruct {
                    id: Some(PointId {
                        point_id_options: Some(PointIdOptions::Uuid(point_id.to_string())),
                    }),
                    vectors: Some(avg_embedding.into()),
                    payload,
                },
            )
        })
        .unzip()
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
    pub doc_title: String,
    pub doc_description: String,
    pub doc_favicon: String,
    pub relative_url: String,
}

impl PageResult {
    pub fn from_qdrant(payload: HashMap<String, qdrant_client::qdrant::Value>) -> Option<Self> {
        let doc_id = payload["doc_id"].as_integer()?;
        let doc_source = payload["doc_source"]
            .as_str()
            .and_then(|s| url::Url::parse(s).ok())?;
        let relative_url = payload["relative_url"].as_str().map(ToOwned::to_owned)?;
        let doc_title = payload["doc_title"].as_str().map(ToOwned::to_owned)?;
        let doc_description = payload["doc_description"].as_str().map(ToOwned::to_owned)?;
        let doc_favicon = payload["doc_favicon"].as_str().map(ToOwned::to_owned)?;
        Some(Self {
            doc_id,
            doc_source,
            doc_title,
            doc_description,
            doc_favicon,
            relative_url,
        })
    }
}

fn normalize_absolute_url(base_url: &url::Url, absolute_url: &str) -> url::Url {
    let mut root = base_url.clone();
    root.set_path(&absolute_url);
    root
}

fn build_trigram_query(query: &str, field: Field) -> Box<dyn Query> {
    Box::new(BooleanQuery::intersection(
        trigrams(query)
            .map(|t| {
                BooleanQuery::union(
                    case_permutations(t.as_str())
                        .map(|s| Term::from_field_text(field, s.as_str()))
                        .map(|q| TermQuery::new(q, IndexRecordOption::Basic))
                        .map(Box::new)
                        .map(|q| q as Box<dyn Query>)
                        .collect::<Vec<_>>(),
                )
            })
            .map(Box::new)
            .map(|q| q as Box<dyn Query>)
            .collect::<Vec<_>>(),
    )) as Box<dyn Query>
}

fn build_regex_query(query: &str, field: Field) -> Box<dyn Query> {
    Box::new(RegexQuery::from_pattern(&regex::escape(query), field).unwrap()) as Box<dyn Query>
}
