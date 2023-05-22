use tokio::sync::OwnedSemaphorePermit;
use tracing::{debug, error, info};

use crate::{
    indexes,
    remotes::RemoteError,
    repo::{Backend, RepoError, RepoMetadata, RepoRef, Repository, SyncStatus},
    Application,
};

use std::{path::PathBuf, sync::Arc};

use super::control::SyncPipes;

pub(crate) struct SyncHandle {
    pub(crate) reporef: RepoRef,
    pub(crate) app: Application,
    pipes: Arc<SyncPipes>,
    exited: flume::Sender<SyncStatus>,
}

type Result<T> = std::result::Result<T, SyncError>;
#[derive(thiserror::Error, Debug)]
pub(super) enum SyncError {
    #[error("no keys for backend: {0:?}")]
    NoKeysForBackend(Backend),

    #[error("path not allowed: {0:?}")]
    PathNotAllowed(PathBuf),

    #[error("indexing failed: {0:?}")]
    Indexing(RepoError),

    #[error("sync failed: {0:?}")]
    Sync(RemoteError),

    #[error("file cache cleanup failed: {0:?}")]
    State(RepoError),

    #[error("file cache cleanup failed: {0:?}")]
    FileCache(RepoError),

    #[error("folder cleanup failed: path: {0:?}, error: {1}")]
    RemoveLocal(PathBuf, std::io::Error),

    #[error("tantivy: {0:?}")]
    Tantivy(anyhow::Error),
}

impl PartialEq for SyncHandle {
    fn eq(&self, other: &Self) -> bool {
        self.reporef == other.reporef
    }
}

impl Drop for SyncHandle {
    fn drop(&mut self) {
        let status = self.set_status(|v| {
            use SyncStatus::*;
            match &v.sync_status {
                Indexing | Syncing => Error {
                    message: "unknown".into(),
                },
                other => other.clone(),
            }
        });

        _ = self.app.config.source.save_pool(self.app.repo_pool.clone());

        info!(?status, %self.reporef, "normalized status after sync");
        if self
            .exited
            .send(status.unwrap_or(SyncStatus::Removed))
            .is_err()
        {
            debug!("notification failed, repo probably deleted");
        }
    }
}

impl SyncHandle {
    pub(super) fn new(
        app: Application,
        reporef: RepoRef,
        status: super::ProgressStream,
    ) -> (Arc<Self>, flume::Receiver<SyncStatus>) {
        let (exited, exit_signal) = flume::bounded(1);
        let pipes = SyncPipes::new(reporef.clone(), status).into();

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
    pub(super) async fn run(&self, _permit: OwnedSemaphorePermit) -> Result<SyncStatus> {
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
        let status = match indexed {
            Ok(Some(state)) => {
                info!("commit complete; indexing done");
                self.app
                    .repo_pool
                    .update(&self.reporef, |_k, repo| repo.sync_done_with(state));

                // technically `sync_done_with` does this, but we want to send notifications
                self.set_status(|_| SyncStatus::Done)
            }
            Ok(None) => self.set_status(|_| SyncStatus::Done),
            Err(err) => {
                error!(?err, ?self.reporef, "failed to index repository");
                self.set_status(|_| SyncStatus::Error {
                    message: err.to_string(),
                })
            }
        };

        Ok(status.expect("failed to update repo status"))
    }

    async fn index(&self) -> Result<Option<Arc<RepoMetadata>>> {
        use SyncStatus::*;
        let Application {
            ref config,
            ref indexes,
            ref repo_pool,
            ..
        } = self.app;

        let writers = indexes.writers().await.map_err(SyncError::Tantivy)?;
        let repo = repo_pool
            .read_async(&self.reporef, |_k, v| v.clone())
            .await
            .unwrap();

        let indexed = match repo.sync_status {
            Uninitialized | Syncing | Indexing => return Ok(None),
            Removed => {
                repo_pool.remove(&self.reporef);
                let deleted = self.delete_repo_indexes(&repo, &writers).await;
                if deleted.is_ok() {
                    writers.commit().await.map_err(SyncError::Tantivy)?;
                    config
                        .source
                        .save_pool(repo_pool.clone())
                        .map_err(SyncError::State)?;
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
                self.set_status(|_| Indexing).unwrap();
                writers.index(self, &repo).await
            }
        };

        if indexed.is_ok() {
            writers.commit().await.map_err(SyncError::Tantivy)?;
        } else {
            writers.rollback().map_err(SyncError::Tantivy)?;
        }

        indexed.map_err(SyncError::Indexing).map(Some)
    }

    async fn sync(&self) -> Result<()> {
        let repo = self.reporef.clone();
        let backend = repo.backend();
        let creds = match self.app.credentials.for_repo(&repo) {
            Some(creds) => creds,
            None => {
                let Some(path) = repo.local_path() else {
		    return Err(SyncError::NoKeysForBackend(backend));
		};

                if !self.app.allow_path(&path) {
                    return Err(SyncError::PathNotAllowed(path));
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

        let synced = creds.sync(self).await;
        if let Err(RemoteError::RemoteNotFound) = synced {
            self.set_status(|_| SyncStatus::RemoteRemoved).unwrap();
            error!(?repo, "remote repository removed; disabling local syncing");

            // we want indexing to pick this up later and handle the new state
            // all local cleanups are done, so everything should be consistent
            return Ok(());
        }

        synced.map_err(SyncError::Sync)
    }

    async fn delete_repo_indexes(
        &self,
        repo: &Repository,
        writers: &indexes::GlobalWriteHandleRef<'_>,
    ) -> Result<()> {
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

        repo.delete_file_cache(&config.index_dir)
            .map_err(SyncError::FileCache)?;

        if !self.reporef.is_local() {
            tokio::fs::remove_dir_all(&repo.disk_path)
                .await
                .map_err(|e| SyncError::RemoveLocal(repo.disk_path.clone(), e))?;
        }

        for handle in writers {
            handle.delete(repo);
        }

        Ok(())
    }

    pub(crate) fn pipes(&self) -> &SyncPipes {
        &self.pipes
    }

    pub(crate) fn repo(&self) -> Option<Repository> {
        self.app
            .repo_pool
            .read(&self.reporef, |_k, repo| repo.clone())
    }

    pub(crate) fn set_status(
        &self,
        updater: impl FnOnce(&Repository) -> SyncStatus,
    ) -> Option<SyncStatus> {
        let new_status = self.app.repo_pool.update(&self.reporef, move |_k, repo| {
            repo.sync_status = (updater)(repo);
            repo.sync_status.clone()
        })?;

        self.pipes.status(new_status.clone());
        Some(new_status)
    }

    /// Will return the current Repository, inserting a new one if none
    pub(crate) async fn create_new(&self, repo: impl FnOnce() -> Repository) -> Repository {
        let current = self
            .app
            .repo_pool
            .entry_async(self.reporef.clone())
            .await
            .or_insert_with(repo)
            .get()
            .clone();

        self.pipes.status(current.sync_status.clone());
        current
    }

    pub(crate) async fn sync_lock(&self) -> Option<std::result::Result<(), RemoteError>> {
        let new = self
            .app
            .repo_pool
            .update_async(&self.reporef, |_k, repo| {
                if repo.sync_status == SyncStatus::Syncing {
                    Err(RemoteError::SyncInProgress)
                } else {
                    repo.sync_status = SyncStatus::Syncing;
                    Ok(repo.sync_status.clone())
                }
            })
            .await;

        if let Some(Ok(new)) = new {
            self.pipes.status(new);
            Some(Ok(()))
        } else {
            new.map(|inner| inner.map(|_| ()))
        }
    }
}
