use anyhow::bail;
use tracing::{debug, error, info};

use crate::{
    indexes,
    remotes::RemoteError,
    repo::{RepoRef, Repository, SyncStatus},
    Application, Configuration,
};

use std::{future::Future, pin::Pin, sync::Arc, thread};

type Task = Pin<Box<dyn Future<Output = ()> + Send + Sync>>;

#[derive(Clone)]
pub struct BackgroundExecutor {
    sender: flume::Sender<Task>,
}

impl BackgroundExecutor {
    pub fn start(config: Arc<Configuration>) -> Self {
        let (sender, receiver) = flume::unbounded();

        let tokio: Arc<_> = tokio::runtime::Builder::new_multi_thread()
            .thread_name("background-jobs")
            .worker_threads(config.max_threads)
            .max_blocking_threads(config.max_threads)
            .enable_time()
            .enable_io()
            .build()
            .unwrap()
            .into();

        let tokio_ref = tokio.clone();
        // test can re-initialize the app, and we shouldn't fail
        _ = rayon::ThreadPoolBuilder::new()
            .spawn_handler(move |thread| {
                let tokio_ref = tokio_ref.clone();
                std::thread::spawn(move || {
                    let _tokio = tokio_ref.enter();
                    thread.run()
                });
                Ok(())
            })
            .num_threads(config.max_threads)
            .build_global();

        thread::spawn(move || {
            while let Ok(task) = receiver.recv() {
                tokio.spawn(task);
            }
        });

        Self { sender }
    }

    fn spawn<T>(&self, job: impl Future<Output = T> + Send + Sync + 'static) {
        self.sender
            .send(Box::pin(async move {
                job.await;
            }))
            .unwrap();
    }

    pub async fn wait_for<T: Send + Sync + 'static>(
        &self,
        job: impl Future<Output = T> + Send + Sync + 'static,
    ) -> T {
        let (s, r) = flume::bounded(1);
        self.spawn(async move { s.send_async(job.await).await.unwrap() });
        r.recv_async().await.unwrap()
    }
}

pub struct IndexWriter(pub(super) Application);
impl IndexWriter {
    /// Pull or clone an existing, or new repo, respectively.
    pub(crate) async fn sync_and_index(self, repositories: Vec<RepoRef>) -> anyhow::Result<()> {
        let Self(app) = self;
        let background = app.background.clone();

        let job = async move {
            let mut set = tokio::task::JoinSet::new();

            for reporef in repositories {
                set.spawn(IndexWriter(app.clone()).sync_and_index_call(reporef));
            }

            while let Some(job) = set.join_next().await {
                job??
            }

            Ok(())
        };

        background.wait_for(job).await
    }

    async fn sync_and_index_call(self, reporef: RepoRef) -> anyhow::Result<()> {
        debug!(?reporef, "syncing repo");
        let Self(Application { ref repo_pool, .. }) = self;

        // skip indexing if the repo has been marked as removed
        // if the ref is non-existent, sync it and add it to the pool
        let removed = repo_pool
            .read_async(&reporef, |_k, v| v.sync_status == SyncStatus::Removed)
            .await
            .unwrap_or(false);

        if !removed {
            if let Err(err) = self.sync_repo(&reporef).await {
                error!(?err, ?reporef, "failed to sync repository");
                return Err(err);
            }
        }

        if let Err(err) = self.index_repo(&reporef).await {
            error!(?err, ?reporef, "failed to index repository");
            return Err(err);
        }

        Ok(())
    }

    pub(crate) fn queue_sync_and_index(self, repositories: Vec<RepoRef>) {
        tokio::task::spawn(self.sync_and_index(repositories));
    }

    pub(crate) async fn startup_scan(self) -> anyhow::Result<()> {
        let Self(Application { repo_pool, .. }) = &self;

        let mut repos = vec![];
        repo_pool.scan_async(|k, _| repos.push(k.clone())).await;

        self.sync_and_index(repos).await
    }

    async fn index_repo(&self, reporef: &RepoRef) -> anyhow::Result<()> {
        use SyncStatus::*;

        let Self(Application {
            config,
            indexes,
            repo_pool,
            ..
        }) = &self;

        let writers = indexes.writers().await?;
        let (key, repo) = repo_pool
            .read_async(reporef, |k, v| (k.clone(), v.clone()))
            .await
            .unwrap();

        let indexed = match repo.sync_status {
            Uninitialized | Syncing | Indexing => return Ok(()),
            Removed => {
                repo_pool.remove(reporef);
                let deleted = self.delete_repo_indexes(reporef, &repo, &writers).await;
                if deleted.is_ok() {
                    writers.commit().await?;
                    config.source.save_pool(repo_pool.clone())?;
                }
                return deleted;
            }
            RemoteRemoved => {
                // Note we don't clean up here, leave the
                // barebones behind.
                //
                // This is to be able to report to the user that
                // something happened, and let them clean up in a
                // subsequent action.
                return Ok(());
            }
            _ => {
                repo_pool
                    .update_async(reporef, |_, v| v.sync_status = Indexing)
                    .await
                    .unwrap();

                repo.index(&key, &writers).await
            }
        };

        writers.commit().await?;
        config.source.save_pool(repo_pool.clone())?;

        repo_pool
            .update_async(reporef, move |_k, repo| match indexed {
                Ok(state) => {
                    repo.sync_done_with(state);
                    info!("commit complete; indexing done");
                }
                Err(err) => {
                    repo.sync_status = Error {
                        message: err.to_string(),
                    };
                    error!(?err, ?reporef, "failed to index repository");
                }
            })
            .await
            .unwrap();

        Ok(())
    }

    //
    //
    // Helper functions
    //
    //
    async fn sync_repo(&self, repo: &RepoRef) -> anyhow::Result<()> {
        let IndexWriter(app) = self;

        let repo = repo.clone();
        let backend = repo.backend();
        let creds = match app.credentials.for_repo(&repo) {
            Some(creds) => creds,
            None => {
                let Some(path) = repo.local_path() else {
		    bail!("no keys for backend {:?}", backend)
		};

                if !app.allow_path(path) {
                    bail!("path not authorized {repo:?}")
                }

                self.0
                    .repo_pool
                    .entry_async(repo.to_owned())
                    .await
                    .or_insert_with(|| Repository::local_from(&repo));

                // we _never_ touch the git repositories of local repos
                return Ok(());
            }
        };

        let synced = creds.sync(app.clone(), repo.clone()).await;
        if let Err(RemoteError::RemoteNotFound) = synced {
            self.0
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
        reporef: &RepoRef,
        repo: &Repository,
        writers: &indexes::GlobalWriteHandleRef<'_>,
    ) -> anyhow::Result<()> {
        let IndexWriter(Application {
            config, semantic, ..
        }) = self;

        if let Some(semantic) = semantic {
            semantic
                .delete_points_by_path(&reporef.to_string(), std::iter::empty())
                .await;
        }

        repo.delete_file_cache(&config.index_dir)?;
        if !reporef.is_local() {
            tokio::fs::remove_dir_all(&repo.disk_path).await?;
        }

        for handle in writers {
            handle.delete(repo);
        }

        Ok(())
    }
}
