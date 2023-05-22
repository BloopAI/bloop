use anyhow::Result;
use async_trait::async_trait;
use tantivy::{
    doc,
    schema::{
        Field, IndexRecordOption, Schema, SchemaBuilder, TextFieldIndexing, TextOptions, FAST,
        STRING,
    },
    IndexWriter, Term,
};
use tracing::info;

use super::Indexable;
use crate::repo::{RepoMetadata, RepoRef, Repository};

pub struct Repo {
    schema: Schema,
    // Path to the root of the repo on disk
    pub disk_path: Field,
    // Name of the org
    pub org: Field,

    // Indexed repo name, of the form:
    //  local: repo
    // github: github.com/org/repo
    pub name: Field,
    pub raw_name: Field,

    // Unique repo identifier, of the form:
    //  local: local//path/to/repo
    // github: github.com/org/repo
    pub repo_ref: Field,
}

impl Default for Repo {
    fn default() -> Self {
        Self::new()
    }
}

impl Repo {
    pub fn new() -> Self {
        let mut builder = SchemaBuilder::new();
        let trigram = TextOptions::default().set_stored().set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("default")
                .set_index_option(IndexRecordOption::WithFreqsAndPositions),
        );

        let disk_path = builder.add_text_field("disk_path", STRING);
        let org = builder.add_text_field("org", trigram.clone());
        let name = builder.add_text_field("name", trigram.clone());
        let raw_name = builder.add_bytes_field("raw_name", FAST);
        let repo_ref = builder.add_text_field("repo_ref", trigram);

        Self {
            disk_path,
            org,
            name,
            raw_name,
            repo_ref,
            schema: builder.build(),
        }
    }
}

#[async_trait]
impl Indexable for Repo {
    fn index_repository(
        &self,
        repo_ref: &RepoRef,
        repo: &Repository,
        _metadata: &RepoMetadata,
        writer: &IndexWriter,
        progress: &(dyn Fn(u8) + Sync),
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

        progress(100);

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
