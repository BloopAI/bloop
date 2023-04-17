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
use tokio::sync::RwLock;

pub mod file;
pub mod reader;
pub mod repo;

pub use file::File;
pub use repo::Repo;
use tracing::debug;

use crate::{
    query::parser::Query,
    repo::{RepoMetadata, RepoRef, Repository},
    semantic::Semantic,
    state::RepositoryPool,
    Configuration,
};

pub type Progress = (RepoRef, usize, u8);
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
    pub fn rollback(self) -> Result<()> {
        for mut handle in self.handles {
            handle.rollback()?
        }

        Ok(())
    }
    pub async fn commit(self) -> Result<()> {
        for mut handle in self.handles {
            handle.commit().await?
        }

        Ok(())
    }
}

pub struct Indexes {
    pub repo: Indexer<Repo>,
    pub file: Indexer<File>,
    write_mutex: tokio::sync::Mutex<()>,

    progress: tokio::sync::broadcast::Sender<Progress>,
}

impl Indexes {
    pub fn new(
        repo_pool: RepositoryPool,
        config: Arc<Configuration>,
        semantic: Option<Semantic>,
    ) -> Result<Self> {
        if config.source.index_version_mismatch() {
            // we don't support old schemas, and tantivy will hard
            // error if we try to open a db with a different schema.
            std::fs::remove_dir_all(config.index_path("repo"))?;
            std::fs::remove_dir_all(config.index_path("content"))?;

            // knocking out our current file caches will force re-indexing qdrant
            repo_pool.scan(|_, repo| {
                _ = repo.delete_file_cache(&config.index_dir);
            });
        }
        config.source.save_index_version()?;

        let (progress, _) = tokio::sync::broadcast::channel(16);

        Ok(Self {
            repo: Indexer::create(
                Repo::new(),
                config.index_path("repo").as_ref(),
                config.repo_buffer_size,
                config.max_threads,
            )?,
            file: Indexer::create(
                File::new(config.clone(), semantic),
                config.index_path("content").as_ref(),
                config.buffer_size,
                config.max_threads,
            )?,
            write_mutex: Default::default(),
            progress,
        })
    }

    pub async fn writers(&self) -> Result<GlobalWriteHandle<'_>> {
        let id: u64 = rand::random();
        debug!(id, "waiting for other writers to finish");
        let _write_lock = self.write_mutex.lock().await;
        debug!(id, "lock acquired");

        Ok(GlobalWriteHandle {
            handles: vec![
                self.repo.write_handle(0, self.progress.clone())?,
                self.file.write_handle(1, self.progress.clone())?,
            ],
            _write_lock,
        })
    }

    pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<Progress> {
        self.progress.subscribe()
    }
}

pub trait Indexable: Send + Sync {
    /// This is where files are scanned and indexed.
    fn index_repository(
        &self,
        reporef: &RepoRef,
        repo: &Repository,
        metadata: &RepoMetadata,
        writer: &IndexWriter,
        progress: &(dyn Fn(u8) + Sync),
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
    index: &'a tantivy::Index,
    reader: &'a RwLock<IndexReader>,
    writer: IndexWriter,
    progress: Box<dyn Fn(RepoRef, u8) + Send + Sync>,
}

impl<'a> IndexWriteHandle<'a> {
    pub async fn refresh_reader(&self) -> Result<()> {
        *self.reader.write().await = self.index.reader()?;
        Ok(())
    }

    pub fn delete(&self, repo: &Repository) {
        self.source.delete_by_repo(&self.writer, repo)
    }

    pub fn index(
        &self,
        reporef: &RepoRef,
        repo: &Repository,
        metadata: &RepoMetadata,
    ) -> Result<()> {
        self.source
            .index_repository(reporef, repo, metadata, &self.writer, &|p: u8| {
                (self.progress)(reporef.clone(), p)
            })
    }

    pub async fn commit(&mut self) -> Result<()> {
        self.writer.commit()?;
        self.refresh_reader().await?;

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
    pub reader: RwLock<IndexReader>,
    pub reindex_buffer_size: usize,
    pub reindex_threads: usize,
}

impl<T: Indexable> Indexer<T> {
    fn write_handle(
        &self,
        id: usize,
        progress: tokio::sync::broadcast::Sender<Progress>,
    ) -> Result<IndexWriteHandle<'_>> {
        Ok(IndexWriteHandle {
            source: &self.source,
            index: &self.index,
            reader: &self.reader,
            writer: self
                .index
                .writer_with_num_threads(self.reindex_threads, self.reindex_buffer_size)?,
            progress: Box::new(move |reporef, status| {
                _ = progress.send((reporef, id, status));
            }),
        })
    }

    fn init_index(schema: Schema, path: &Path, threads: usize) -> Result<tantivy::Index> {
        fs::create_dir_all(path).context("failed to create index dir")?;

        let mut index =
            tantivy::Index::open_or_create(tantivy::directory::MmapDirectory::open(path)?, schema)?;

        index.set_default_multithread_executor()?;
        index.set_multithread_executor(threads)?;
        index
            .tokenizers()
            .register("default", NgramTokenizer::new(1, 3, false));

        Ok(index)
    }

    /// Create an index using `source` at the specified path.
    pub fn create(source: T, path: &Path, buffer_size: usize, threads: usize) -> Result<Self> {
        let index = Self::init_index(source.schema(), path, threads)?;
        let reader = index.reader()?.into();
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
        let searcher = self.reader.read().await.searcher();
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
