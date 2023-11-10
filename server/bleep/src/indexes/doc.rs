use async_stream::{stream, try_stream};
use futures::stream::{Stream, StreamExt};
use rayon::prelude::*;
use tantivy::{
    collector::TopDocs,
    query::{BooleanQuery, Query, TermQuery},
    schema::{Field, IndexRecordOption, Term},
    tokenizer::NgramTokenizer,
};
use thiserror::Error;
use tokio::sync::Mutex;
use tracing::{error, info, trace};

use crate::{
    db::SqlDb,
    indexes::schema,
    query::compiler::{case_permutations, trigrams},
    scraper::{self, Config, Scraper},
};

use std::{collections::HashSet, sync::Arc};

#[derive(Clone)]
pub struct Doc {
    sql: SqlDb,
    section_index: tantivy::Index,
    section_schema: schema::Section,
    buffer_size: usize,
}

static STATUS_DONE: &str = "done";
static STATUS_INDEXING: &str = "indexing";

#[derive(serde::Serialize)]
pub struct SqlRecord {
    pub id: i64,
    pub url: String,
    pub index_status: String,
    pub name: Option<String>,
    pub favicon: Option<String>,
    pub description: Option<String>,
    pub modified_at: chrono::NaiveDateTime,
}

#[derive(serde::Serialize, Clone)]
pub enum Progress {
    Update(Update),
    Done(i64),
}

#[derive(serde::Serialize, Clone)]
pub struct Update {
    url: url::Url,
    discovered_count: usize,

    #[serde(skip)]
    metadata: scraper::Meta,
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

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("tantivy error: {0}")]
    Tantivy(#[from] tantivy::error::TantivyError),

    #[error("duplicate url: {0}")]
    DuplicateUrl(url::Url),

    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("no docs found at url: {0}")]
    EmptyDocs(url::Url),
}

impl Doc {
    fn index_writer(&self) -> Result<tantivy::IndexWriter, Error> {
        self.section_index
            .writer(self.buffer_size)
            .map_err(Error::Tantivy)
    }

    fn index_reader(&self) -> Result<tantivy::IndexReader, Error> {
        self.section_index.reader().map_err(Error::Tantivy)
    }

    /// Initialize docs index
    pub fn create(
        sql: SqlDb,
        path: &std::path::Path,
        buffer_size: usize,
        max_threads: usize,
    ) -> Result<Self, Error> {
        std::fs::create_dir_all(path)?;

        let section_schema = schema::Section::new();
        let mut section_index = tantivy::Index::open_or_create(
            tantivy::directory::MmapDirectory::open(path)
                .map_err(|e| Error::Initialize(e.to_string()))?, // todo: handle tantivy index upgrades here
            section_schema.schema.clone(),
        )
        .map_err(|e| Error::Initialize(e.to_string()))?;

        section_index
            .set_multithread_executor(max_threads)
            .map_err(|e| Error::Initialize(e.to_string()))?;

        section_index
            .tokenizers()
            .register("trigram", NgramTokenizer::new(1, 3, false).unwrap());

        Ok(Self {
            sql,
            section_index,
            section_schema,
            buffer_size,
        })
    }

    async fn set_title<'a, E>(&self, title: &str, id: i64, executor: &'a mut E) -> Result<(), Error>
    where
        &'a mut E: sqlx::Executor<'a, Database = sqlx::Sqlite>,
    {
        sqlx::query! {
            "UPDATE docs SET name = ? WHERE id = ?",
            title,
            id,
        }
        .execute(executor)
        .await
        .map(|_| ())
        .map_err(Error::Sql)
    }

    async fn set_favicon<'a, E>(
        &self,
        favicon: &str,
        id: i64,
        executor: &'a mut E,
    ) -> Result<(), Error>
    where
        &'a mut E: sqlx::Executor<'a, Database = sqlx::Sqlite>,
    {
        sqlx::query! {
            "UPDATE docs SET favicon = ? WHERE id = ?",
            favicon,
            id,
        }
        .execute(executor)
        .await
        .map(|_| ())
        .map_err(Error::Sql)
    }

    async fn set_description<'a, E>(
        &self,
        description: &str,
        id: i64,
        executor: &'a mut E,
    ) -> Result<(), Error>
    where
        &'a mut E: sqlx::Executor<'a, Database = sqlx::Sqlite>,
    {
        sqlx::query! {
            "UPDATE docs SET description = ? WHERE id = ?",
            description,
            id,
        }
        .execute(executor)
        .await
        .map(|_| ())
        .map_err(Error::Sql)
    }

    async fn set_metadata<'a, E>(
        &self,
        metadata: &scraper::Meta,
        id: i64,
        doc_source: &url::Url,
        executor: &'a mut E,
    ) where
        for<'t> &'t mut E: sqlx::Executor<'t, Database = sqlx::Sqlite>,
    {
        // set title
        if let Some(title) = &metadata.title {
            if let Err(e) = self.set_title(title, id, executor).await {
                error!(%e, %title, %id, "failed to set doc title");
            } else {
                info!(%id, %title, "doc title set");
            };
        }

        // set favicon
        if let Some(favicon) = &metadata.icon {
            let resolved_url = url::Url::parse(favicon)
                .unwrap_or_else(|_| normalize_absolute_url(doc_source, favicon));
            if let Err(e) = self.set_favicon(resolved_url.as_str(), id, executor).await {
                error!(%e, %favicon, %id, "failed to set doc icon");
            } else {
                info!(%id, %favicon, "doc icon set");
            };
        }

        // set description
        if let Some(description) = &metadata.description {
            if let Err(e) = self.set_description(description, id, executor).await {
                error!(%e, %description, %id, "failed to set doc description");
            } else {
                info!(%id, %description, "doc description set");
            };
        }
    }

    async fn set_index_status<'a, E>(&self, status: &str, id: i64, executor: E) -> Result<(), Error>
    where
        E: sqlx::Executor<'a, Database = sqlx::Sqlite>,
    {
        let status = status.to_string();
        sqlx::query! {
            "UPDATE docs SET index_status = ? WHERE id = ?",
            status,
            id,
        }
        .execute(executor)
        .await
        .map(|_| ())
        .map_err(Error::Sql)
    }

    /// Add a doc source to the index
    ///
    /// The sqlite DB stores metadata about the doc-provider, and the tantivy index stores
    /// searchable page content.
    pub async fn sync(self, url: url::Url) -> impl Stream<Item = Result<Progress, Error>> {
        try_stream! {
            // check if index writer is available
            let index_writer = Arc::new(Mutex::new(self.index_writer()?));

            let mut transaction = self.sql.begin().await?;

            // add entry to sqlite
            let url_string = url.to_string();
            let id = sqlx::query! {
                "INSERT INTO docs (url, index_status) VALUES (?, ?)",
                url_string,
                STATUS_INDEXING,
            }
            .execute(&mut transaction)
            .await?
            .last_insert_rowid();

            let mut is_meta_set = false;
            let stream =
                self.clone()
                    .insert_into_tantivy(id, url.clone(), Arc::clone(&index_writer));
            let mut discovered_count = 0;
            for await progress in stream {
                // populate metadata in sqlite
                //
                // the first scraped doc that contains metadata is used to populate
                // metadata in sqlite - this is typically the base_url entered by the user,
                // if the base_url does not contain any metadata, we move on the the second
                // scraped url
                if let Progress::Update(update) = progress.clone() {
                    discovered_count = update.discovered_count;
                    if update.url == url || (!update.metadata.is_empty() && !is_meta_set) {
                        // do not set meta for this doc provider in subsequent turns
                        is_meta_set = true;
                        self.set_metadata(&update.metadata, id, &url, &mut transaction).await;
                    };
                }
                yield progress;
            }

            // scraped doc, but no pages
            if discovered_count == 0 {
                // delete sql entry
                sqlx::query!("DELETE FROM docs WHERE id = ? RETURNING id", id)
                    .fetch_optional(&mut transaction)
                    .await?
                    .ok_or(Error::InvalidDocId(id))?;
                error!(doc_source = url.as_str(), "no docs found at url");
                // return error
                Err(Error::EmptyDocs(url))?;
            }

            self.set_index_status(STATUS_DONE, id, &mut transaction).await?;
            transaction.commit().await?;
        }
    }

    /// Update documentation in the index - this will rescrape the entire website
    pub async fn resync(self, id: i64) -> impl Stream<Item = Result<Progress, Error>> {
        try_stream! {
            let url = sqlx::query!("SELECT url FROM docs WHERE id = ?", id)
                .fetch_optional(&*self.sql)
                .await?
                .ok_or(Error::InvalidDocId(id))?
                .url;
            let url = url::Url::parse(&url).map_err(|e| Error::UrlParse(url, e))?;

            // delete old docs from tantivy
            self.index_writer()?
                .delete_term(Term::from_field_i64(self.section_schema.doc_id, id));
            self.index_writer()?.commit()?;

            sqlx::query! {
                "UPDATE docs SET modified_at = datetime('now') WHERE id = ?",
                id,
            }
            .execute(&*self.sql)
            .await?;

            let index_writer = Arc::new(Mutex::new(self.index_writer()?));

            let stream = self
                .insert_into_tantivy(id, url, Arc::clone(&index_writer));
            for await progress in stream {
                yield progress;
            }
        }
    }

    /// Remove this doc source from tantivy and sqlite
    pub async fn delete(&self, id: i64) -> Result<i64, Error> {
        // delete entry from sql
        let id = sqlx::query!("DELETE FROM docs WHERE id = ? RETURNING id", id)
            .fetch_optional(&*self.sql)
            .await?
            .ok_or(Error::InvalidDocId(id))?
            .id;

        // delete entry from tantivy
        self.index_writer()?
            .delete_term(Term::from_field_i64(self.section_schema.doc_id, id));
        self.index_writer()?.commit()?;

        Ok(id)
    }

    /// List all synced doc sources
    pub async fn list(&self) -> Result<Vec<SqlRecord>, Error> {
        Ok(sqlx::query!(
            "SELECT id, index_status, name, url, favicon, description, modified_at FROM docs"
        )
        .fetch_all(&*self.sql)
        .await?
        .into_iter()
        .map(|record| SqlRecord {
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
    pub async fn list_one(&self, id: i64) -> Result<SqlRecord, Error> {
        let record = sqlx::query!(
            "SELECT id, index_status, name, url, favicon, description, modified_at FROM docs WHERE id = ?",
            id
        )
        .fetch_one(&*self.sql)
        .await?;

        Ok(SqlRecord {
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
    pub async fn search(&self, q: String, limit: usize) -> Result<Vec<SqlRecord>, Error> {
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
            .map(|r| SqlRecord {
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
        limit: usize,
        id: i64,
    ) -> Result<Vec<Section>, Error> {
        // use the tantivy index for section search
        let reader = self.index_reader()?;
        let searcher = reader.searcher();

        let doc_id_query = Box::new(TermQuery::new(
            Term::from_field_i64(self.section_schema.doc_id, id),
            IndexRecordOption::Basic,
        ));

        let terms = q
            .split(|c: char| c.is_whitespace() || "./-{}[]()?-_".contains(c))
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>();

        // for each term, build up a trigram query
        let trigram_queries = Box::new(BooleanQuery::union(
            terms
                .iter()
                .map(|term| build_trigram_query(term, self.section_schema.text))
                .collect::<Vec<_>>(),
        )) as Box<dyn Query>;

        let header_trigram_queries = Box::new(BooleanQuery::union(
            terms
                .iter()
                .map(|term| build_trigram_query(term, self.section_schema.header))
                .collect::<Vec<_>>(),
        )) as Box<dyn Query>;

        let matcher = fuzzy_matcher::skim::SkimMatcherV2::default();

        let tantivy_results = searcher
            .search(
                &BooleanQuery::intersection(vec![
                    // trigram_queries,
                    Box::new(BooleanQuery::union(vec![
                        header_trigram_queries,
                        trigram_queries,
                        // ancestry_trigram_queries,
                        // rel_url_trigram_queries,
                    ])) as Box<dyn Query>,
                    doc_id_query as Box<dyn Query>,
                ]),
                &TopDocs::with_limit(1000),
            )
            .expect("failed to search index");

        let mut results = tantivy_results
            .into_par_iter()
            .filter_map(move |(_, addr)| {
                let retrieved_doc = searcher
                    .doc(addr)
                    .expect("failed to get document by address");
                Section::from_tantivy_document(retrieved_doc, &self.section_schema)
            })
            .filter_map(|search_result| {
                let term_distances =
                    terms
                        .iter()
                        .fold(Vec::new(), |mut acc: Vec<(&&str, usize)>, x| {
                            let next = if let Some((term, dist)) = acc.last() {
                                (x, dist + term.len())
                            } else {
                                (x, 0)
                            };
                            acc.push(next);
                            acc
                        });

                let dq = term_distances
                    .windows(2)
                    .map(|window| {
                        let d1 = window[0].1;
                        let d2 = window[1].1;
                        d2.abs_diff(d1).pow(2)
                    })
                    .sum::<usize>();

                let dt = |positions: &[Option<usize>], max: usize| {
                    positions
                        .windows(2)
                        .map(|window| {
                            let d1 = window[0].unwrap_or(max);
                            let d2 = window[1].unwrap_or(max);
                            d2.abs_diff(d1).pow(2)
                        })
                        .sum::<usize>()
                };

                // utility closure to calculate proximity penalty
                let distance_penalty = |dq, dt, terms: &[&str]| {
                    let total_len = terms.iter().map(|s| s.len()).sum::<usize>();
                    if terms.is_empty() || dt == 0 {
                        1.
                    } else {
                        (dt as f32 / dq as f32) * (total_len as f32)
                    }
                };

                let (mut header_score, mut header_positions) = terms
                    .iter()
                    .map(|t| matcher.fuzzy(&search_result.header, t, true))
                    .map(|t| {
                        if let Some((s, pos)) = t {
                            (s, pos.first().cloned())
                        } else {
                            (0, None)
                        }
                    })
                    .fold((0, Vec::new()), |mut acc, (s, pos)| {
                        acc.1.push(pos);
                        (acc.0 + s, acc.1)
                    });

                header_positions.sort();
                header_positions.reverse();
                let header_hit_distance = dt(header_positions.as_slice(), 9999);

                let header_distance_penalty = distance_penalty(dq, header_hit_distance, &terms);

                // boost header score based on the "level" of this header, i.e., h1 gets a boost of
                // 60, h2 gets a boost of 50, etc.
                header_score += 10 * (6 - search_result.ancestry.len()) as i64;
                header_score -= header_distance_penalty as i64;

                let (mut text_score, mut text_positions) = terms
                    .iter()
                    .map(|t| matcher.fuzzy(&search_result.header, t, true))
                    .map(|t| {
                        if let Some((s, pos)) = t {
                            (s, pos.first().cloned())
                        } else {
                            (0, None)
                        }
                    })
                    .fold((0, Vec::new()), |mut acc, (s, pos)| {
                        acc.1.push(pos);
                        (acc.0 + s, acc.1)
                    });

                text_positions.sort();
                text_positions.reverse();

                let text_hit_distance = dt(text_positions.as_slice(), search_result.text.len());

                let text_distance_penalty = distance_penalty(dq, text_hit_distance, &terms);

                text_score -= text_distance_penalty as i64;

                Some((
                    search_result,
                    text_score as f32 + (header_score as f32) * 2.0,
                ))
            })
            .collect::<Vec<_>>();

        results.par_sort_by(|(_, a_score), (_, b_score)| {
            b_score
                .partial_cmp(a_score)
                .unwrap_or(std::cmp::Ordering::Less)
        });

        Ok(results
            .into_iter()
            .map(|(doc, _)| doc)
            .take(limit)
            .collect::<Vec<_>>())
    }

    pub async fn list_sections(&self, limit: usize, id: i64) -> Result<Vec<Section>, Error> {
        let reader = self.index_reader()?;
        let searcher = reader.searcher();
        let doc_id_query = Box::new(TermQuery::new(
            Term::from_field_i64(self.section_schema.doc_id, id),
            IndexRecordOption::Basic,
        )) as Box<dyn Query>;
        let collector = TopDocs::with_limit(limit);
        Ok(searcher
            .search(&doc_id_query, &collector)?
            .into_iter()
            .map(|(_score, addr)| {
                let retrieved_doc = searcher.doc(addr).expect("failed to fetch doc");
                Section::from_tantivy_document(retrieved_doc, &self.section_schema).unwrap()
            })
            .collect())
    }

    /// Scroll pages in a doc
    pub async fn list_pages(&self, limit: usize, id: i64) -> Result<Vec<Page>, Error> {
        let reader = self.index_reader()?;
        let searcher = reader.searcher();
        let doc_id_query = Box::new(TermQuery::new(
            Term::from_field_i64(self.section_schema.doc_id, id),
            IndexRecordOption::Basic,
        )) as Box<dyn Query>;
        let collector =
            crate::collector::GroupCollector::with_field(self.section_schema.raw_relative_url)
                .with_group_size(1)
                .with_limit(limit);
        Ok(searcher
            .search(&doc_id_query, &collector)?
            .into_iter()
            .flat_map(|groups| groups.items.into_values())
            .flat_map(|group| group.items.into_iter())
            .filter_map(|addr| {
                let retrieved_doc = searcher.doc(addr).expect("failed to fetch doc");
                Page::from_tantivy_document(retrieved_doc, &self.section_schema)
            })
            .collect())
    }

    /// Fetch all sections of a page, in order
    pub async fn fetch<S: AsRef<str>>(
        &self,
        id: i64,
        relative_url: S,
    ) -> Result<Vec<Section>, Error> {
        let reader = self.index_reader()?;
        let searcher = reader.searcher();
        let doc_id_query = Box::new(TermQuery::new(
            Term::from_field_i64(self.section_schema.doc_id, id),
            IndexRecordOption::Basic,
        )) as Box<dyn Query>;
        let relative_url_query = Box::new(TermQuery::new(
            Term::from_field_text(self.section_schema.relative_url, relative_url.as_ref()),
            IndexRecordOption::Basic,
        )) as Box<dyn Query>;
        let query = Box::new(BooleanQuery::intersection(vec![
            doc_id_query,
            relative_url_query,
        ])) as Box<dyn Query>;
        let collector = TopDocs::with_limit(9999);
        let results = searcher.search(&query, &collector)?;

        if results.is_empty() {
            return Err(Error::InvalidDocId(id));
        }

        let mut results = results
            .into_iter()
            .filter_map(|(_score, addr)| {
                let retrieved_doc = searcher.doc(addr).expect("failed to fetch doc");
                Section::from_tantivy_document(retrieved_doc, &self.section_schema)
            })
            .collect::<Vec<_>>();

        results.sort_by_key(|s| s.section_range.start);

        Ok(results)
    }

    pub fn contains_url(&self, url: &url::Url) -> bool {
        let Ok(reader) = self.index_reader() else {
            return false;
        };

        let searcher = reader.searcher();
        let query = Box::new(TermQuery::new(
            Term::from_field_text(self.section_schema.absolute_url, url.as_str()),
            IndexRecordOption::Basic,
        )) as Box<dyn Query>;
        let collector = TopDocs::with_limit(1);

        let Ok(results) = searcher.search(&query, &collector) else {
            return false;
        };

        !results.is_empty()
    }

    /// Scrape & insert a doc source into tantivy and return doc metadata if available
    fn insert_into_tantivy(
        self,
        id: i64,
        doc_source: url::Url,
        index_writer: Arc<Mutex<tantivy::IndexWriter>>,
    ) -> impl Stream<Item = Progress> {
        stream! {
            let mut scraper = Scraper::with_config(Config::new(doc_source.clone()));
            let mut stream = Box::pin(scraper.complete());
            let mut handles = Vec::new();
            let mut discovered_count = 0;
            let point_ids = Arc::new(Mutex::new(HashSet::<uuid::Uuid>::new()));
            while let Some(doc) = stream.next().await {
                discovered_count += 1;
                let progress = Progress::Update(Update {
                    url: doc.url.clone(),
                    discovered_count,
                    metadata: doc.meta.clone(),
                });
                yield progress;
                if doc.is_empty() {
                    continue;
                }
                let doc_source = doc_source.clone();
                let section_schema = self.section_schema.clone();
                let index_writer = Arc::clone(&index_writer);
                let cache = Arc::clone(&point_ids);
                handles.push(tokio::task::spawn(async move {
                    let (section_ids, tantivy_docs_to_insert) = doc.sections(id, &doc_source, &section_schema);
                    let mut cache_lock = cache.lock().await;
                    if !section_ids.iter().any(|u| cache_lock.contains(u)) {
                        cache_lock.extend(section_ids.iter());
                        let lock = index_writer.lock().await;
                        for d in tantivy_docs_to_insert {
                            let _ = lock.add_document(d);
                        }
                    }
                }));
            }
            futures::future::join_all(handles).await;

            trace!(%id, url = doc_source.as_str(), "commiting doc-provider to index");
            match index_writer.lock().await.commit() {
                Ok(_) => info!(%id, url = doc_source.as_str(), "index complete"),
                Err(e) => error!(%id, url = doc_source.as_str(), %e, "tantivy commit failed"),
            }

            yield Progress::Done(id);
        }
    }

    pub async fn verify(&self, url: url::Url) -> Result<reqwest::StatusCode, Error> {
        if self.contains_url(&url) {
            return Err(Error::DuplicateUrl(url));
        }
        reqwest::get(url)
            .await
            .map(|r| r.status())
            .map_err(Error::Network)
    }
}

impl scraper::Document {
    // break down this `Document` into sections and build `tantivy::Document` of out of each section
    fn sections(
        &self,
        id: i64,
        doc_source: &url::Url,
        schema: &schema::Section,
    ) -> (Vec<uuid::Uuid>, Vec<tantivy::Document>) {
        info!(
            url = %(self.url.as_str()),
            doc_id = %id,
            "indexing doc",
        );
        scraper::chunk::by_section(self.content.as_deref().unwrap_or_default()) // this is an infallible unwrap however
            .into_par_iter()
            .filter_map(|section| {
                let point_id = {
                    let mut bytes = [0; 16];
                    let mut hasher = blake3::Hasher::new();
                    hasher.update(&id.to_le_bytes()); // doc id
                    hasher.update(self.meta.title.as_deref().unwrap_or("").as_bytes()); // title of this page
                    hasher.update(section.data.as_bytes()); // section data
                    hasher.update(&section.section_range.start.byte.to_le_bytes()); // section start location
                    hasher.update(&section.section_range.end.byte.to_le_bytes()); // section end location
                    bytes.copy_from_slice(&hasher.finalize().as_bytes()[16..32]);
                    uuid::Uuid::from_bytes(bytes)
                };

                let Some(relative_url) = self.relative_url(doc_source) else {
                    error!(
                        "`{}` is not relative to `{}`",
                        self.url.as_str(),
                        doc_source.as_str()
                    );
                    return None;
                };

                use tantivy::doc;
                Some((point_id, doc!(
                            schema.doc_id => id,
                            schema.point_id => point_id.to_string().as_str(),
                            schema.doc_source => doc_source.as_str(),
                            schema.doc_title => self.meta.title.as_deref().unwrap_or_default(),
                            schema.doc_description => self.meta.description.as_deref().unwrap_or_default(),
                            schema.absolute_url => self.url.as_str(),
                            schema.relative_url => relative_url.as_str(),
                            schema.raw_relative_url => relative_url.as_str().as_bytes(),
                            schema.header => section.header.unwrap_or_default(),
                            schema.ancestry => section.ancestry_str().as_str(),
                            schema.text => section.data,
                            schema.start_byte => section.section_range.start.byte as u64,
                            schema.end_byte => section.section_range.end.byte as u64,
                            schema.section_depth => section.ancestry.len() as u64,
                )))
            })
            .unzip()
    }
}

#[derive(serde::Serialize)]
pub struct Section {
    pub doc_id: i64,
    pub doc_title: Option<String>,
    pub point_id: uuid::Uuid,
    pub doc_source: url::Url,
    pub relative_url: String,
    pub absolute_url: url::Url,
    pub header: String,
    pub ancestry: Vec<String>,
    pub text: String,
    pub section_range: std::ops::Range<usize>,
}

impl Section {
    pub fn from_tantivy_document(
        doc: tantivy::schema::Document,
        schema: &schema::Section,
    ) -> Option<Self> {
        Some(Section {
            doc_id: doc.get_first(schema.doc_id)?.as_i64()?,
            doc_title: doc
                .get_first(schema.doc_title)?
                .as_text()
                .map(ToOwned::to_owned),
            doc_source: doc
                .get_first(schema.doc_source)?
                .as_text()?
                .parse::<url::Url>()
                .unwrap(),
            point_id: doc
                .get_first(schema.point_id)?
                .as_text()?
                .parse::<uuid::Uuid>()
                .unwrap(),
            ancestry: doc.get_first(schema.ancestry)?.as_text().map(|t| {
                scraper::chunk::Section::ancestry_from_str(t)
                    .into_iter()
                    .map(ToOwned::to_owned)
                    .collect()
            })?,
            header: doc.get_first(schema.header)?.as_text()?.to_owned(),
            relative_url: doc.get_first(schema.relative_url)?.as_text()?.to_owned(),
            absolute_url: doc
                .get_first(schema.absolute_url)?
                .as_text()?
                .parse::<url::Url>()
                .unwrap(),
            section_range: doc.get_first(schema.start_byte)?.as_u64()? as usize
                ..doc.get_first(schema.end_byte)?.as_u64()? as usize,
            text: doc.get_first(schema.text)?.as_text()?.to_owned(),
        })
    }
}

#[derive(serde::Serialize)]
pub struct Page {
    pub doc_id: i64,
    pub doc_source: url::Url,
    pub doc_title: Option<String>,
    pub doc_description: Option<String>,
    pub doc_favicon: Option<String>,
    pub relative_url: String,
    pub absolute_url: url::Url,
}

impl Page {
    pub fn from_tantivy_document(
        doc: tantivy::schema::Document,
        schema: &schema::Section,
    ) -> Option<Self> {
        Some(Page {
            doc_id: doc.get_first(schema.doc_id)?.as_i64()?,
            doc_title: doc
                .get_first(schema.doc_title)?
                .as_text()
                .map(ToOwned::to_owned),
            doc_description: doc
                .get_first(schema.doc_title)?
                .as_text()
                .map(ToOwned::to_owned),
            doc_favicon: doc
                .get_first(schema.doc_title)?
                .as_text()
                .map(ToOwned::to_owned),
            doc_source: doc
                .get_first(schema.doc_source)?
                .as_text()?
                .parse::<url::Url>()
                .unwrap(),
            relative_url: doc.get_first(schema.relative_url)?.as_text()?.to_owned(),
            absolute_url: doc
                .get_first(schema.absolute_url)?
                .as_text()?
                .parse::<url::Url>()
                .unwrap(),
        })
    }
}

fn normalize_absolute_url(base_url: &url::Url, absolute_url: &str) -> url::Url {
    let mut root = base_url.clone();
    root.set_path(absolute_url);
    root
}

fn build_trigram_query(query: &str, field: Field) -> Box<dyn Query> {
    Box::new(BooleanQuery::union(
        case_permutations(query)
            .map(|q| {
                BooleanQuery::intersection(
                    trigrams(q.as_str())
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
    ))
}
