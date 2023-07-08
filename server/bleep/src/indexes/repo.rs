use anyhow::Result;
use async_trait::async_trait;
use tantivy::{doc, schema::Schema, IndexWriter, Term};
use tracing::info;

pub use super::schema::Repo;
use super::Indexable;
use crate::{
    background::SyncPipes,
    repo::{RepoMetadata, RepoRef, Repository},
};

impl Default for Repo {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Indexable for Repo {
    async fn index_repository(
        &self,
        repo_ref: &RepoRef,
        repo: &Repository,
        _metadata: &RepoMetadata,
        writer: &IndexWriter,
        pipes: &SyncPipes,
    ) -> Result<()> {
        // Make sure we delete any stale references to this repository when indexing.
        self.delete_by_repo(writer, repo);

        writer.add_document(doc!(
            // We don't have organization support for now.
            self.org => "",
            self.disk_path => repo.disk_path.to_string_lossy().into_owned(),
            self.name => repo_ref.indexed_name(),
            self.raw_name => repo_ref.indexed_name().as_bytes(),
            self.repo_ref => repo_ref.to_string(),
        ))?;

        pipes.index_percent(100);

        info!(
            ?repo.disk_path,
            "finished indexing repo metadata"
        );

        Ok(())
    }

    fn delete_by_repo(&self, writer: &IndexWriter, repo: &Repository) {
        writer.delete_term(Term::from_field_text(
            self.disk_path,
            &repo.disk_path.to_string_lossy(),
        ));
    }

    fn schema(&self) -> Schema {
        self.schema.clone()
    }
}
