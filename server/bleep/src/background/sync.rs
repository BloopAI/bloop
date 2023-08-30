use either::Either;
use tokio::sync::OwnedSemaphorePermit;
use tracing::{debug, error, info, warn};

use crate::{
    cache::FileCache,
    indexes,
    remotes::RemoteError,
    repo::{Backend, FilterUpdate, RepoError, RepoMetadata, RepoRef, Repository, SyncStatus},
    Application,
};

use std::{path::PathBuf, sync::Arc};

use super::control::SyncPipes;

pub(crate) struct SyncHandle {
    pub(crate) reporef: RepoRef,
    pub(crate) filter_updates: FilterUpdate,
    pub(super) pipes: SyncPipes,
    app: Application,
    exited: flume::Sender<SyncStatus>,
    exit_signal: flume::Receiver<SyncStatus>,
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

    #[error("folder cleanup failed: path: {0:?}, error: {1}")]
    RemoveLocal(PathBuf, std::io::Error),

    #[error("tantivy: {0:?}")]
    Tantivy(anyhow::Error),

    #[error("sql: {0:?}")]
    Sql(anyhow::Error),

    #[error("syncing in progress")]
    SyncInProgress,

    #[error("cancelled by user")]
    Cancelled,
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
                Cancelling => Cancelled,
                other => other.clone(),
            }
        });

        _ = self.app.config.source.save_pool(self.app.repo_pool.clone());

        debug!(?status, %self.reporef, "normalized status after sync");
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
    pub(crate) async fn new(
        app: Application,
        reporef: RepoRef,
        status: super::ProgressStream,
        filter_updates: Option<FilterUpdate>,
    ) -> Arc<Self> {
        // Going through an extra hoop here to ensure the outward
        // facing interface communicates intent.
        //
        // How filter updates work specifically should not have to
        // trickle down to all callers.
        let filter_updates = filter_updates.unwrap_or_default();
        let (exited, exit_signal) = flume::bounded(1);
        let pipes = SyncPipes::new(reporef.clone(), filter_updates.clone(), status);
        let current = app
            .repo_pool
            .entry_async(reporef.clone())
            .await
            .or_insert_with(|| {
                if reporef.is_local() {
                    Repository::local_from(&reporef)
                } else {
                    let name = reporef.to_string();
                    let remote = reporef.as_ref().into();
                    let disk_path = app
                        .config
                        .source
                        .repo_path_for_name(&name.replace('/', "_"));

                    Repository {
                        disk_path,
                        remote,
                        sync_status: SyncStatus::Queued,
                        last_index_unix_secs: 0,
                        last_commit_unix_secs: 0,
                        most_common_lang: None,
                        branch_filter: None,
                        file_filter: Default::default(),
                    }
                }
            });

        let sh = Self {
            app: app.clone(),
            reporef: reporef.clone(),
            pipes,
            filter_updates,
            exited,
            exit_signal,
        };

        sh.pipes.status(current.get().sync_status.clone());
        sh.into()
    }

    pub(super) fn notify_done(&self) -> flume::Receiver<SyncStatus> {
        self.exit_signal.clone()
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
            match self.git_sync().await {
                Ok(status) => {
                    if let SyncStatus::Done = self.set_status(|_| status).unwrap() {
                        return Ok(SyncStatus::Done);
                    }
                }
                Err(err) => {
                    error!(?err, ?self.reporef, "failed to sync repository");
                    self.set_status(|_| SyncStatus::Error {
                        message: err.to_string(),
                    })
                    .unwrap();
                    return Err(err);
                }
            }
        }

        if self.pipes.is_cancelled() && !self.pipes.is_removed() {
            self.set_status(|_| SyncStatus::Cancelled);
            debug!(?self.reporef, "cancelled while cloning");
            return Err(SyncError::Cancelled);
        }

        let indexed = self.index().await;
        let status = match indexed {
            Ok(Either::Left(status)) => Some(status),
            Ok(Either::Right(state)) => {
                info!("commit complete; indexing done");
                self.app.repo_pool.update(&self.reporef, |_k, repo| {
                    repo.sync_done_with(&self.filter_updates, state)
                });

                // technically `sync_done_with` does this, but we want to send notifications
                self.set_status(|_| SyncStatus::Done)
            }
            Err(SyncError::Cancelled) => self.set_status(|_| SyncStatus::Cancelled),
            Err(err) => {
                error!(?err, ?self.reporef, "failed to index repository");
                self.set_status(|_| SyncStatus::Error {
                    message: err.to_string(),
                })
            }
        };

        Ok(status.expect("failed to update repo status"))
    }

    async fn index(&self) -> Result<Either<SyncStatus, Arc<RepoMetadata>>> {
        use SyncStatus::*;
        let Application {
            ref indexes,
            ref repo_pool,
            ..
        } = self.app;

        let writers = indexes.writers().await.map_err(SyncError::Tantivy)?;
        let repo = {
            let mut orig = repo_pool
                .read_async(&self.reporef, |_k, v| v.clone())
                .await
                .unwrap();

            if let Some(ref bf) = self.filter_updates.branch_filter {
                orig.branch_filter = bf.patch(orig.branch_filter.as_ref());
            }

            if let Some(ref ff) = self.filter_updates.file_filter {
                orig.file_filter = ff.clone();
            }
            orig
        };

        let indexed = match repo.sync_status {
            current @ (Uninitialized | Syncing | Indexing) => return Ok(Either::Left(current)),
            Removed => return self.delete_repo(&repo, writers).await,
            RemoteRemoved => {
                // Note we don't clean up here, leave the
                // barebones behind.
                //
                // This is to be able to report to the user that
                // something happened, and let them clean up in a
                // subsequent action.
                return Ok(Either::Left(RemoteRemoved));
            }
            _ => {
                self.set_status(|_| Indexing).unwrap();
                writers.index(self, &repo).await.map(Either::Right)
            }
        };

        match indexed {
            Ok(_) => {
                writers.commit().await.map_err(SyncError::Tantivy)?;
                indexed.map_err(SyncError::Indexing)
            }
            Err(_) if self.pipes.is_removed() => self.delete_repo(&repo, writers).await,
            Err(_) if self.pipes.is_cancelled() => {
                writers.rollback().map_err(SyncError::Tantivy)?;
                debug!(?self.reporef, "index cancelled by user");
                Err(SyncError::Cancelled)
            }
            Err(err) => {
                writers.rollback().map_err(SyncError::Tantivy)?;
                Err(SyncError::Indexing(err))
            }
        }
    }

    async fn delete_repo(
        &self,
        repo: &Repository,
        writers: indexes::GlobalWriteHandle<'_>,
    ) -> Result<Either<SyncStatus, Arc<RepoMetadata>>> {
        self.app.repo_pool.remove(&self.reporef);

        let deleted = self.delete_repo_indexes(repo, &writers).await;
        if deleted.is_ok() {
            writers.commit().await.map_err(SyncError::Tantivy)?;
            self.app
                .config
                .source
                .save_pool(self.app.repo_pool.clone())
                .map_err(SyncError::State)?;
        }

        deleted.map(|_| Either::Left(SyncStatus::Removed))
    }

    async fn git_sync(&self) -> Result<SyncStatus> {
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

                // we _never_ touch the git repositories of local repos
                return Ok(SyncStatus::Queued);
            }
        };

        let repo = self.sync_lock().await?;

        // This reads really badly, but essentially we need a way to
        // retry after cleaning things up, and duplicating _too much_
        // code.
        let mut loop_counter = 0;
        let loop_max = 1;
        let git_err = loop {
            match creds.git_sync(&self.reporef, repo.clone()).await {
                Err(
                    err @ RemoteError::GitCloneFetch(gix::clone::fetch::Error::PrepareFetch(
                        gix::remote::fetch::prepare::Error::RefMap(
                            gix::remote::ref_map::Error::Handshake(
                                gix::protocol::handshake::Error::InvalidCredentials { .. },
                            ),
                        ),
                    )),
                ) => {
                    error!(?err, ?self.reporef, "invalid credentials for accessing git repo");
                    return Err(SyncError::Sync(err));
                }
                Err(
                    err @ RemoteError::GitOpen(_)
                    | err @ RemoteError::GitFetch(_)
                    | err @ RemoteError::GitPrepareFetch(_)
                    | err @ RemoteError::GitClone(_)
                    | err @ RemoteError::GitCloneFetch(_)
                    | err @ RemoteError::GitConnect(_)
                    | err @ RemoteError::GitFindRemote(_),
                ) => {
                    _ = tokio::fs::remove_dir_all(&repo.disk_path).await;

                    if loop_counter == loop_max {
                        break err;
                    }

                    loop_counter += 1;
                }
                Err(RemoteError::RemoteNotFound) => {
                    error!(?repo, "remote repository removed; disabling local syncing");

                    // we want indexing to pick this up later and handle the new state
                    // all local cleanups are done, so everything should be consistent
                    return Ok(SyncStatus::RemoteRemoved);
                }
                Err(RemoteError::GitHub(
                    octocrab::Error::Service { .. }
                    | octocrab::Error::Hyper { .. }
                    | octocrab::Error::Http { .. },
                )) => {
                    warn!("likely network error, skipping further syncing");
                    return Ok(SyncStatus::Done);
                }
                Err(err) => {
                    error!(?err, ?self.reporef, "failed to sync repository");
                    return Err(SyncError::Sync(err));
                }
                Ok(status) => {
                    self.app
                        .config
                        .source
                        .save_pool(self.app.repo_pool.clone())
                        .expect("filesystem error");

                    return Ok(status);
                }
            }
        };

        Err(SyncError::Sync(git_err))
    }

    async fn delete_repo_indexes(
        &self,
        repo: &Repository,
        writers: &indexes::GlobalWriteHandleRef<'_>,
    ) -> Result<()> {
        let Application {
            ref semantic,
            ref sql,
            ..
        } = self.app;

        if let Some(semantic) = semantic {
            semantic
                .delete_points_for_hash(&self.reporef.to_string(), std::iter::empty())
                .await;
        }

        FileCache::for_repo(sql, semantic.as_ref(), &self.reporef)
            .delete()
            .await
            .map_err(SyncError::Sql)?;

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

    pub(crate) fn set_status(
        &self,
        updater: impl FnOnce(&Repository) -> SyncStatus,
    ) -> Option<SyncStatus> {
        let new_status = self.app.repo_pool.update(&self.reporef, move |_k, repo| {
            repo.sync_status = (updater)(repo);
            repo.sync_status.clone()
        })?;

        debug!(?self.reporef, ?new_status, "new status");
        self.pipes.status(new_status.clone());
        Some(new_status)
    }

    async fn sync_lock(&self) -> std::result::Result<Repository, SyncError> {
        let repo = self
            .app
            .repo_pool
            .update_async(&self.reporef, |_k, repo| {
                if repo.sync_status == SyncStatus::Syncing {
                    Err(SyncError::SyncInProgress)
                } else {
                    repo.sync_status = SyncStatus::Syncing;
                    Ok(repo.clone())
                }
            })
            .await;

        if let Some(Ok(repo)) = repo {
            let new_status = repo.sync_status.clone();
            debug!(?self.reporef, ?new_status, "new status");
            self.pipes.status(new_status);
            Ok(repo)
        } else {
            repo.expect("repo was already deleted")
        }
    }
}
