use anyhow::bail;
use tokio::sync::{OwnedSemaphorePermit, RwLock, Semaphore};
use tracing::{debug, error, info};

use crate::{
    indexes,
    remotes::RemoteError,
    repo::{RepoMetadata, RepoRef, Repository, SyncStatus},
    Application, Configuration,
};

use std::{collections::VecDeque, future::Future, pin::Pin, sync::Arc, thread};

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

enum ControlEvent {
    Cancel,
}

struct SyncHandle {
    reporef: RepoRef,
    app: Application,
    control_rx: flume::Receiver<ControlEvent>,
    control_tx: flume::Sender<ControlEvent>,
    exited: flume::Sender<SyncStatus>,
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
    fn new(app: Application, reporef: RepoRef) -> (Arc<Self>, flume::Receiver<SyncStatus>) {
        let (control_tx, control_rx) = flume::bounded(1);
        let (exited, exit_signal) = flume::bounded(1);

        (
            Self {
                app,
                reporef,
                control_tx,
                control_rx,
                exited,
            }
            .into(),
            exit_signal,
        )
    }

    /// The permit that's taken here is exclusively for parallelism control.
    async fn run(&self, _permit: OwnedSemaphorePermit) -> anyhow::Result<SyncStatus> {
        debug!(?self.reporef, "syncing repo");
        let Application { ref repo_pool, .. } = self.app;

        // skip indexing if the repo has been marked as removed
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

        writers.commit().await?;
        config.source.save_pool(repo_pool.clone())?;

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

pub struct BoundSyncQueue(Application, SyncQueue);

struct NotifyQueue {
    queue: RwLock<VecDeque<Arc<SyncHandle>>>,
    available: Semaphore,
}

impl Default for NotifyQueue {
    fn default() -> Self {
        Self {
            queue: Default::default(),
            available: Semaphore::new(0),
        }
    }
}

impl NotifyQueue {
    async fn push(&self, item: Arc<SyncHandle>) {
        let mut q = self.queue.write().await;

        self.available.add_permits(1);

        q.push_back(item);
    }

    async fn pop(&self) -> Arc<SyncHandle> {
        let permit = self.available.acquire().await.expect("fatal");
        let mut q = self.queue.write().await;

        permit.forget();

        q.pop_front().expect("the semaphore should guard this")
    }

    async fn get_list(&self) -> Vec<Arc<SyncHandle>> {
        self.queue.read().await.iter().cloned().collect()
    }

    async fn remove(&self, reporef: RepoRef) {
        let mut q = self.queue.write().await;
        self.available.acquire().await.expect("fatal").forget();
        q.retain(|item| item.reporef != reporef);
    }
}

#[derive(Clone)]
pub struct SyncQueue {
    runner: BackgroundExecutor,
    active: Arc<scc::HashMap<RepoRef, Arc<SyncHandle>>>,
    tickets: Arc<Semaphore>,
    queue: Arc<NotifyQueue>,
}

impl SyncQueue {
    pub fn start(config: Arc<Configuration>) -> Self {
        let instance = Self {
            tickets: Arc::new(Semaphore::new(config.max_threads)),
            runner: BackgroundExecutor::start(config.clone()),
            active: Default::default(),
            queue: Default::default(),
        };

        {
            let instance = instance.clone();
            instance.runner.clone().spawn(async move {
                while let (Ok(permit), next) = tokio::join!(
                    instance.tickets.clone().acquire_owned(),
                    instance.queue.pop()
                ) {
                    let active = Arc::clone(&instance.active);
                    tokio::task::spawn(async move {
                        info!(?next.reporef, "indexing");
                        active
                            .upsert_async(
                                next.reporef.clone(),
                                || next.clone(),
                                |_, v| *v = next.clone(),
                            )
                            .await;

                        let result = next.run(permit).await;
                        _ = active.remove(&next.reporef);

                        debug!(?result, "sync finished");
                    });
                }
            });
        }

        instance
    }

    pub fn bind(&self, app: Application) -> BoundSyncQueue {
        BoundSyncQueue(app, self.clone())
    }
}

impl BoundSyncQueue {
    /// Pull or clone an existing, or new repo, respectively.
    pub(crate) async fn sync_and_index(self, repositories: Vec<RepoRef>) -> anyhow::Result<()> {
        for reporef in repositories.into_iter() {
            info!(%reporef, "queueing for sync");
            let (handle, _) = SyncHandle::new(self.0.clone(), reporef);
            self.1.queue.push(handle).await;
        }

        Ok(())
    }

    /// Pull or clone an existing, or new repo, respectively.
    pub(crate) async fn wait_for_sync_and_index(
        self,
        reporef: RepoRef,
    ) -> anyhow::Result<SyncStatus> {
        let (handle, signal) = SyncHandle::new(self.0.clone(), reporef);
        self.1.queue.push(handle).await;
        Ok(signal.recv_async().await?)
    }

    pub(crate) async fn startup_scan(self) -> anyhow::Result<()> {
        let Self(Application { repo_pool, .. }, _) = &self;

        let mut repos = vec![];
        repo_pool.scan_async(|k, _| repos.push(k.clone())).await;

        self.sync_and_index(repos).await
    }
}
