use tokio::sync::Semaphore;
use tracing::{debug, info};

use crate::{
    repo::{RepoRef, SyncStatus},
    Application, Configuration,
};

use std::{future::Future, pin::Pin, sync::Arc, thread};

mod sync;
use sync::SyncHandle;

mod control;
mod notifyqueue;
use notifyqueue::NotifyQueue;

type Task = Pin<Box<dyn Future<Output = ()> + Send + Sync>>;

#[derive(Clone)]
pub struct SyncQueue {
    runner: BackgroundExecutor,
    active: Arc<scc::HashMap<RepoRef, Arc<SyncHandle>>>,
    tickets: Arc<Semaphore>,
    queue: Arc<NotifyQueue>,
}

#[derive(Clone)]
pub struct BackgroundExecutor {
    sender: flume::Sender<Task>,
}

pub struct BoundSyncQueue(Application, SyncQueue);

impl BackgroundExecutor {
    fn start(config: Arc<Configuration>) -> Self {
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
    /// Enqueue repos for syncing which aren't already being synced or
    /// in the queue.
    pub(crate) async fn sync_and_index(self, repositories: Vec<RepoRef>) -> anyhow::Result<()> {
        for reporef in repositories {
            if self.1.queue.contains(&reporef).await || self.1.active.contains(&reporef) {
                continue;
            }

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
