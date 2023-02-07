use anyhow::bail;
use async_trait::async_trait;
use rayon::prelude::{IntoParallelIterator, ParallelIterator};
use tantivy::{
    doc,
    schema::{Field, Schema, STRING},
    Term,
};
use tokio::runtime::Handle;
use tracing::{debug, info, warn};

use super::Indexable;
use crate::{
    remotes::github::fetch_issues,
    semantic::Semantic,
    state::{Backend, GitRemote, RepoRemote},
};

pub struct Issues {
    schema: Schema,
    semantic: Option<Semantic>,
    repo_field: Field,
    title_field: Field,
    content_field: Field,
}

impl Issues {
    pub fn new(semantic: Option<Semantic>) -> Self {
        let mut b = Schema::builder();
        let repo_field = b.add_text_field("repo", STRING);
        let title_field = b.add_text_field("title", STRING);
        let content_field = b.add_text_field("content", STRING);
        let schema = b.build();
        Issues {
            schema,
            semantic,
            repo_field,
            title_field,
            content_field,
        }
    }
}

#[async_trait]
impl Indexable for Issues {
    fn index_repository(
        &self,
        repo_ref: &crate::state::RepoRef,
        repo: &crate::state::Repository,
        _info: &crate::state::RepoHeadInfo,
        writer: &tantivy::IndexWriter,
    ) -> anyhow::Result<()> {
        // if repo_ref.backend() != Backend::Github {
        //     warn!("Issues are only implemented for GitHub, got {repo_ref:?}");
        //     return Ok(());
        // }
        self.delete_by_repo(writer, repo);

        let RepoRemote::Git(GitRemote {
            ref address, ..
        }) = repo.remote else {
            bail!("github without git backend");
        };

        let Some((owner, name)) = address.split_once('/')
        else { bail!("need owner/repo pair, got {address}") };

        info!("getting issues for {address}");
        let issues =
            tokio::task::block_in_place(|| Handle::current().block_on(fetch_issues(owner, name)))?;
        issues.into_par_iter().try_for_each(|issue| {
            debug!("indexing issue {n}", n = issue.number);
            let mut content = issue.text.clone();
            content.extend(
                issue
                    .comments
                    .iter()
                    .map(|s| String::from("\n\n----\n\n") + s),
            );
            if let Some(semantic) = &self.semantic {
                tokio::task::block_in_place(|| {
                    Handle::current().block_on(semantic.insert_points_for_buffer(
                        name,
                        &repo_ref.to_string(),
                        &issue.title,
                        &content,
                        "md",
                    ))
                })
            }
            writer.add_document(doc!(
                self.title_field => issue.title.clone(),
                self.repo_field => name,
                self.content_field => content,
            ))?;
            Ok::<(), anyhow::Error>(())
        })?;
        Ok(())
    }

    fn delete_by_repo(&self, writer: &tantivy::IndexWriter, repo: &crate::state::Repository) {
        writer.delete_term(Term::from_field_text(
            self.repo_field,
            &repo.disk_path.to_string_lossy(),
        ));
    }

    fn schema(&self) -> Schema {
        self.schema.clone()
    }
}
