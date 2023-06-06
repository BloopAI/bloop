use thread_priority::ThreadBuilderExt;
use tokio::sync::Semaphore;
use tracing::{debug, info};

use crate::{
    repo::{RepoRef, SyncStatus},
    Application, Configuration,
};

use std::{future::Future, pin::Pin, sync::Arc, thread};

mod sync;
pub(crate) use sync::SyncHandle;

mod control;
pub(crate) use control::SyncPipes;

mod notifyqueue;
use notifyqueue::NotifyQueue;

type ProgressStream = tokio::sync::broadcast::Sender<Progress>;

#[derive(serde::Serialize, Clone)]
pub struct Progress {
    #[serde(rename = "ref")]
    reporef: RepoRef,
    #[serde(rename = "ev")]
    event: ProgressEvent,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ProgressEvent {
    IndexPercent(u8),
    StatusChange(SyncStatus),
}

type Task = Pin<Box<dyn Future<Output = ()> + Send + Sync>>;
#[derive(Clone)]
pub struct SyncQueue {
    runner: BackgroundExecutor,
    active: Arc<scc::HashMap<RepoRef, Arc<SyncHandle>>>,
    tickets: Arc<Semaphore>,
    queue: Arc<NotifyQueue>,

    /// Report progress from indexing runs
    progress: ProgressStream,
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
                std::thread::Builder::new()
                    .name("index-worker".to_owned())
                    .spawn_with_priority(thread_priority::ThreadPriority::Max, move |_| {
                        let _tokio = tokio_ref.enter();
                        thread.run()
                    })
                    .map(|_| ())
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

    #[allow(unused)]
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
        let (progress, _) = tokio::sync::broadcast::channel(config.max_threads * 2);

        let instance = Self {
            tickets: Arc::new(Semaphore::new(config.max_threads)),
            runner: BackgroundExecutor::start(config.clone()),
            active: Default::default(),
            queue: Default::default(),
            progress,
        };

        {
            let instance = instance.clone();

            // We spawn the queue handler on the background executor
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

    pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<Progress> {
        self.progress.subscribe()
    }
}

impl BoundSyncQueue {
    /// Enqueue repos for syncing which aren't already being synced or
    /// in the queue.
    pub(crate) async fn sync_and_index(self, repositories: Vec<RepoRef>) {
        for reporef in repositories {
            if self.1.queue.contains(&reporef).await || self.1.active.contains(&reporef) {
                continue;
            }

            info!(%reporef, "queueing for sync");
            let handle = SyncHandle::new(self.0.clone(), reporef, self.1.progress.clone());
            self.1.queue.push(handle).await;
        }
    }

    pub(crate) async fn remove(self, reporef: RepoRef) -> Option<()> {
        let active = self
            .1
            .active
            .update_async(&reporef, |_, v| {
                v.pipes.remove();
                v.set_status(|_| SyncStatus::Removed);
            })
            .await;

        if active.is_none() {
            self.0
                .repo_pool
                .update_async(&reporef, |_k, v| v.mark_removed())
                .await?;

            self.sync_and_index(vec![reporef]).await;
        }

        Some(())
    }

    pub(crate) async fn cancel(&self, reporef: RepoRef) {
        if let Some(active) = self.1.active.get_async(&reporef).await {
            active.get().pipes.cancel();
            active.get().set_status(|_| SyncStatus::Cancelled);
        }
    }

    /// Pull or clone an existing, or new repo, respectively.
    pub(crate) async fn wait_for_sync_and_index(
        self,
        reporef: RepoRef,
    ) -> anyhow::Result<SyncStatus> {
        let handle = SyncHandle::new(self.0.clone(), reporef, self.1.progress.clone());
        let finished = handle.notify_done();
        self.1.queue.push(handle).await;
        Ok(finished.recv_async().await?)
    }

    pub(crate) async fn startup_scan(self) -> anyhow::Result<()> {
        let Self(Application { repo_pool, .. }, _) = &self;

        let mut repos = vec![];
        repo_pool.scan_async(|k, _| repos.push(k.clone())).await;

        self.sync_and_index(repos).await;

        Ok(())
    }
}
