use std::{fs, ops::Deref, path::Path, sync::Arc};

use anyhow::{Context, Result};
use async_trait::async_trait;
use smallvec::SmallVec;
use tantivy::{
    collector::{Collector, MultiFruit},
    schema::Schema,
    tokenizer::NgramTokenizer,
    DocAddress, Document, IndexReader, IndexWriter, Score,
};

mod analytics;
pub mod doc;
pub mod file;
pub mod reader;
pub mod repo;
mod schema;

pub use doc::Doc;
pub use file::File;
pub use repo::Repo;
use tracing::debug;

use crate::{
    background::SyncHandle,
    query::parser::Query,
    repo::{RepoError, RepoMetadata, Repository},
    Configuration,
};

pub type GlobalWriteHandleRef<'a> = [IndexWriteHandle<'a>];

pub struct GlobalWriteHandle<'a> {
    handles: Vec<IndexWriteHandle<'a>>,
    _write_lock: tokio::sync::MutexGuard<'a, ()>,
}

impl<'a> Deref for GlobalWriteHandle<'a> {
    type Target = GlobalWriteHandleRef<'a>;

    fn deref(&self) -> &Self::Target {
        &self.handles
    }
}

impl<'a> GlobalWriteHandle<'a> {
    pub(crate) fn rollback(self) -> Result<()> {
        for mut handle in self.handles {
            handle.rollback()?
        }

        Ok(())
    }

    pub(crate) fn commit(self) -> Result<()> {
        for mut handle in self.handles {
            handle.commit()?
        }

        Ok(())
    }

    pub(crate) async fn index(
        &self,
        sync_handle: &SyncHandle,
        repo: &Repository,
    ) -> Result<Arc<RepoMetadata>, RepoError> {
        let metadata = repo.get_repo_metadata().await;

        for h in &self.handles {
            h.index(sync_handle, repo, &metadata).await?;
        }

        Ok(metadata)
    }
}

pub struct Indexes {
    pub repo: Indexer<Repo>,
    pub file: Indexer<File>,
    pub doc: Doc,
    was_index_reset: bool,
    write_mutex: tokio::sync::Mutex<()>,
}

impl Indexes {
    pub async fn new(
        config: &Configuration,
        sql: crate::SqlDb,
        was_index_reset: bool,
    ) -> Result<Self> {
        Ok(Self {
            repo: Indexer::create(
                Repo::new(),
                config.index_path("repo").as_ref(),
                config.repo_buffer_size,
                config.max_threads,
            )?,
            file: Indexer::create(
                File::new(),
                config.index_path("content").as_ref(),
                config.buffer_size,
                config.max_threads,
            )?,
            doc: Doc::create(
                sql,
                config.index_path("doc").as_ref(),
                config.buffer_size,
                config.max_threads,
            )?,
            write_mutex: Default::default(),
            was_index_reset,
        })
    }

    pub fn reset_databases(config: &Configuration) -> Result<()> {
        // we don't support old schemas, and tantivy will hard
        // error if we try to open a db with a different schema.
        if config.index_path("repo").as_ref().exists() {
            std::fs::remove_dir_all(config.index_path("repo"))?;
            debug!("removed index repo dir")
        }
        if config.index_path("content").as_ref().exists() {
            std::fs::remove_dir_all(config.index_path("content"))?;
            debug!("removed index content dir")
        }
        Ok(())
    }

    pub async fn writers(&self) -> Result<GlobalWriteHandle<'_>> {
        let id: u64 = rand::random();
        debug!(id, "waiting for other writers to finish");
        let _write_lock = self.write_mutex.lock().await;
        debug!(id, "lock acquired");

        Ok(GlobalWriteHandle {
            handles: vec![self.repo.write_handle()?, self.file.write_handle()?],
            _write_lock,
        })
    }
}

#[async_trait]
pub trait Indexable: Send + Sync {
    /// This is where files are scanned and indexed.
    async fn index_repository(
        &self,
        handle: &SyncHandle,
        repo: &Repository,
        metadata: &RepoMetadata,
        writer: &IndexWriter,
    ) -> Result<()>;

    fn delete_by_repo(&self, writer: &IndexWriter, repo: &Repository);

    /// Return the tantivy `Schema` of the current index
    fn schema(&self) -> Schema;
}

#[async_trait]
pub trait DocumentRead: Send + Sync {
    type Schema;
    type Document;

    /// Return whether this reader can process this query.
    fn query_matches(&self, query: &Query<'_>) -> bool;

    /// Compile a set of parsed queries into a single `tantivy` query.
    fn compile<'a, I>(
        &self,
        schema: &Self::Schema,
        queries: I,
        index: &tantivy::Index,
    ) -> Result<Box<dyn tantivy::query::Query>>
    where
        I: Iterator<Item = &'a Query<'a>>;

    /// Read a tantivy document into the specified output type.
    fn read_document(&self, schema: &Self::Schema, doc: Document) -> Self::Document;
}

pub struct IndexWriteHandle<'a> {
    source: &'a dyn Indexable,
    reader: &'a IndexReader,
    writer: IndexWriter,
}

impl<'a> IndexWriteHandle<'a> {
    pub fn delete(&self, repo: &Repository) {
        self.source.delete_by_repo(&self.writer, repo)
    }

    pub async fn index(
        &self,
        handle: &SyncHandle,
        repo: &Repository,
        metadata: &RepoMetadata,
    ) -> Result<()> {
        self.source
            .index_repository(handle, repo, metadata, &self.writer)
            .await
    }

    pub fn commit(&mut self) -> Result<()> {
        self.writer.commit()?;
        self.reader.reload()?;

        Ok(())
    }

    pub fn rollback(&mut self) -> Result<()> {
        self.writer.rollback()?;
        Ok(())
    }
}

/// A wrapper around `tantivy::IndexReader`.
///
/// This contains the schema, and also additional fields used to enable re-indexing.
pub struct Indexer<T> {
    pub source: T,
    pub index: tantivy::Index,
    pub reader: IndexReader,
    pub reindex_buffer_size: usize,
    pub reindex_threads: usize,
}

impl<T: Indexable> Indexer<T> {
    fn write_handle(&self) -> Result<IndexWriteHandle<'_>> {
        Ok(IndexWriteHandle {
            source: &self.source,
            reader: &self.reader,
            writer: self
                .index
                .writer_with_num_threads(self.reindex_threads, self.reindex_buffer_size)?,
        })
    }

    fn init_index(schema: Schema, path: &Path, threads: usize) -> Result<tantivy::Index> {
        fs::create_dir_all(path).context("failed to create index dir")?;

        let mut index =
            tantivy::Index::open_or_create(tantivy::directory::MmapDirectory::open(path)?, schema)?;

        index.set_multithread_executor(threads)?;
        index
            .tokenizers()
            .register("default", NgramTokenizer::new(1, 3, false)?);

        Ok(index)
    }

    /// Create an index using `source` at the specified path.
    pub fn create(source: T, path: &Path, buffer_size: usize, threads: usize) -> Result<Self> {
        let index = Self::init_index(source.schema(), path, threads)?;
        let reader = index.reader()?;
        let instance = Self {
            reader,
            index,
            source,
            reindex_threads: threads,
            reindex_buffer_size: buffer_size,
        };

        Ok(instance)
    }

    pub async fn query<'a, R, I, C>(
        &'a self,
        queries: I,
        doc_reader: &'a R,
        collector: C,
    ) -> Result<SearchResults<'_, R::Document>>
    where
        I: Iterator<Item = &'a Query<'a>> + Send,
        C: Collector<Fruit = (Vec<(Score, DocAddress)>, MultiFruit)>,
        R: DocumentRead<Schema = T>,
    {
        let searcher = self.reader.searcher();
        let queries = queries
            .filter(|q| doc_reader.query_matches(q))
            .collect::<SmallVec<[_; 2]>>();
        let compiled_query =
            doc_reader.compile(&self.source, queries.iter().copied(), &self.index)?;

        let (top_k, metadata) = searcher
            .search(&compiled_query, &collector)
            .context("failed to execute search query")?;

        let iter = top_k.into_iter().map(move |(_score, addr)| {
            let doc = searcher.doc(addr).unwrap();
            doc_reader.read_document(&self.source, doc)
        });

        Ok(SearchResults {
            docs: Box::new(iter),
            metadata,
        })
    }
}

pub struct SearchResults<'a, T> {
    pub docs: Box<dyn Iterator<Item = T> + Sync + Send + 'a>,
    pub metadata: MultiFruit,
}
