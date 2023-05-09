use anyhow::bail;
use tokio::sync::OwnedSemaphorePermit;
use tracing::{debug, error, info};

use crate::{
    indexes,
    remotes::RemoteError,
    repo::{RepoMetadata, RepoRef, Repository, SyncStatus},
    Application,
};

use std::sync::Arc;

use super::control::SyncPipes;

pub struct SyncHandle {
    pub reporef: RepoRef,
    app: Application,
    pipes: SyncPipes,
    exited: flume::Sender<SyncStatus>,
}

impl PartialEq for SyncHandle {
    fn eq(&self, other: &Self) -> bool {
        self.reporef == other.reporef
    }
}

impl Drop for SyncHandle {
    fn drop(&mut self) {
        let status = self
            .app
            .repo_pool
            .update(&self.reporef, |_k, v| {
                use SyncStatus::*;
                v.sync_status = match &v.sync_status {
                    Indexing | Syncing => Error {
                        message: "unknown".into(),
                    },
                    other => other.clone(),
                };

                v.sync_status.clone()
            })
            .expect("the repo has been deleted from the db?");

        info!(?status, %self.reporef, "normalized status after sync");
        self.exited.send(status).expect("pipe closed prematurely");
    }
}

impl SyncHandle {
    pub fn new(app: Application, reporef: RepoRef) -> (Arc<Self>, flume::Receiver<SyncStatus>) {
        let (exited, exit_signal) = flume::bounded(1);
        let pipes = SyncPipes::default();

        (
            Self {
                app,
                pipes,
                reporef,
                exited,
            }
            .into(),
            exit_signal,
        )
    }

    /// The permit that's taken here is exclusively for parallelism control.
    pub async fn run(&self, _permit: OwnedSemaphorePermit) -> anyhow::Result<SyncStatus> {
        debug!(?self.reporef, "syncing repo");
        let Application { ref repo_pool, .. } = self.app;

        // skip git operations if the repo has been marked as removed
        // if the ref is non-existent, sync it and add it to the pool
        let removed = repo_pool
            .read_async(&self.reporef, |_k, v| v.sync_status == SyncStatus::Removed)
            .await
            .unwrap_or(false);

        if !removed {
            if let Err(err) = self.sync().await {
                error!(?err, ?self.reporef, "failed to sync repository");
                return Err(err);
            }
        }

        let indexed = self.index().await;
        let status = repo_pool
            .update_async(&self.reporef, |_k, repo| match indexed {
                Ok(Some(state)) => {
                    info!("commit complete; indexing done");
                    repo.sync_done_with(state);
                    SyncStatus::Done
                }
                Ok(None) => SyncStatus::Done,
                Err(err) => {
                    repo.sync_status = SyncStatus::Error {
                        message: err.to_string(),
                    };
                    error!(?err, ?self.reporef, "failed to index repository");
                    repo.sync_status.clone()
                }
            })
            .await
            .unwrap();

        Ok(status)
    }

    async fn index(&self) -> anyhow::Result<Option<Arc<RepoMetadata>>> {
        use SyncStatus::*;
        let Application {
            ref config,
            ref indexes,
            ref repo_pool,
            ..
        } = self.app;

        let writers = indexes.writers().await?;
        let (key, repo) = repo_pool
            .read_async(&self.reporef, |k, v| (k.clone(), v.clone()))
            .await
            .unwrap();

        let indexed = match repo.sync_status {
            Uninitialized | Syncing | Indexing => return Ok(None),
            Removed => {
                repo_pool.remove(&self.reporef);
                let deleted = self.delete_repo_indexes(&repo, &writers).await;
                if deleted.is_ok() {
                    writers.commit().await?;
                    config.source.save_pool(repo_pool.clone())?;
                }
                return deleted.map(|_| None);
            }
            RemoteRemoved => {
                // Note we don't clean up here, leave the
                // barebones behind.
                //
                // This is to be able to report to the user that
                // something happened, and let them clean up in a
                // subsequent action.
                return Ok(None);
            }
            _ => {
                repo_pool
                    .update_async(&self.reporef, |_, v| v.sync_status = Indexing)
                    .await
                    .unwrap();

                repo.index(&key, &writers).await
            }
        };

        if !indexed.is_err() {
            writers.commit().await?;
            config.source.save_pool(repo_pool.clone())?;
        }

        Ok(indexed?).map(Some)
    }

    async fn sync(&self) -> anyhow::Result<()> {
        let repo = self.reporef.clone();
        let backend = repo.backend();
        let creds = match self.app.credentials.for_repo(&repo) {
            Some(creds) => creds,
            None => {
                let Some(path) = repo.local_path() else {
		    bail!("no keys for backend {:?}", backend)
		};

                if !self.app.allow_path(path) {
                    bail!("path not authorized {repo:?}")
                }

                self.app
                    .repo_pool
                    .entry_async(repo.to_owned())
                    .await
                    .or_insert_with(|| Repository::local_from(&repo));

                // we _never_ touch the git repositories of local repos
                return Ok(());
            }
        };

        let synced = creds.sync(self.app.clone(), repo.clone()).await;
        if let Err(RemoteError::RemoteNotFound) = synced {
            self.app
                .repo_pool
                .update_async(&repo, |_, v| v.sync_status = SyncStatus::RemoteRemoved)
                .await
                .unwrap();

            error!(?repo, "remote repository removed; disabling local syncing");

            // we want indexing to pick this up later and handle the new state
            // all local cleanups are done, so everything should be consistent
            return Ok(());
        }

        Ok(synced?)
    }

    async fn delete_repo_indexes(
        &self,
        repo: &Repository,
        writers: &indexes::GlobalWriteHandleRef<'_>,
    ) -> anyhow::Result<()> {
        let Application {
            ref config,
            ref semantic,
            ..
        } = self.app;

        if let Some(semantic) = semantic {
            semantic
                .delete_points_by_path(&self.reporef.to_string(), std::iter::empty())
                .await;
        }

        repo.delete_file_cache(&config.index_dir)?;
        if !self.reporef.is_local() {
            tokio::fs::remove_dir_all(&repo.disk_path).await?;
        }

        for handle in writers {
            handle.delete(repo);
        }

        Ok(())
    }
}
