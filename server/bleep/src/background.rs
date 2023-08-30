use thread_priority::ThreadBuilderExt;
use tokio::sync::Semaphore;
use tracing::{debug, info};

use crate::{
    repo::{BranchFilterConfig, RepoRef, SyncStatus},
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
    #[serde(rename = "b")]
    branch_filter: Option<BranchFilterConfig>,
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
    pub(crate) queue: Arc<NotifyQueue>,

    /// Report progress from indexing runs
    pub(crate) progress: ProgressStream,
}

#[derive(Clone)]
pub struct BackgroundExecutor {
    sender: flume::Sender<Task>,
}

pub struct BoundSyncQueue(pub(crate) Application, pub(crate) SyncQueue);
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

                let thread_priority = if cfg!(feature = "ee") {
                    // 0-100 low-high
                    // pick mid-range for worker threads so we don't starve other threads
                    thread_priority::ThreadPriority::Crossplatform(49u8.try_into().unwrap())
                } else {
                    // on the desktop it's full throttle, as number of cores is limited
                    thread_priority::ThreadPriority::Max
                };

                std::thread::Builder::new()
                    .name("index-worker".to_owned())
                    .spawn_with_priority(thread_priority, move |_| {
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
                    instance
                        .queue
                        .pop_if(|h| !instance.active.contains(&h.reporef))
                ) {
                    let active = Arc::clone(&instance.active);
                    match active
                        .insert_async(next.reporef.clone(), next.clone())
                        .await
                    {
                        Ok(_) => {
                            tokio::task::spawn(async move {
                                info!(?next.reporef, "indexing");

                                let result = next.run(permit).await;
                                _ = active.remove(&next.reporef);

                                debug!(?result, "sync finished");
                            });
                        }
                        Err((_, next)) => {
                            // this shouldn't happen, but we can handle it gracefully
                            instance.queue.push(next).await
                        }
                    };
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

    pub(crate) async fn read_queue(&self) -> Vec<QueuedRepoStatus> {
        let mut output = vec![];
        self.active
            .scan_async(|_, handle| {
                output.push(QueuedRepoStatus {
                    reporef: handle.reporef.clone(),
                    branch_filter: handle.filter_updates.branch_filter.clone(),
                    state: QueueState::Active,
                });
            })
            .await;

        for handle in self.queue.get_list().await {
            output.push(QueuedRepoStatus {
                reporef: handle.reporef.clone(),
                branch_filter: handle.filter_updates.branch_filter.clone(),
                state: QueueState::Queued,
            });
        }

        output
    }
}

#[derive(serde::Serialize, Debug)]
pub(crate) struct QueuedRepoStatus {
    reporef: RepoRef,
    branch_filter: Option<BranchFilterConfig>,
    state: QueueState,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "snake_case")]
pub(crate) enum QueueState {
    Active,
    Queued,
}

impl BoundSyncQueue {
    /// Enqueue repos for syncing with the current configuration.
    ///
    /// Skips any repositories in the list which are already queued or being synced.
    /// Returns the number of new repositories queued for syncing.
    pub(crate) async fn enqueue_sync(self, repositories: Vec<RepoRef>) -> usize {
        let mut num_queued = 0;

        for reporef in repositories {
            if self.1.queue.contains(&reporef).await || self.1.active.contains(&reporef) {
                continue;
            }

            info!(%reporef, "queueing for sync");
            let handle =
                SyncHandle::new(self.0.clone(), reporef, self.1.progress.clone(), None).await;
            self.1.queue.push(handle).await;
            num_queued += 1;
        }

        num_queued
    }

    /// Block until the repository sync & index process is complete.
    ///
    /// Returns the new status.
    pub(crate) async fn block_until_synced(self, reporef: RepoRef) -> anyhow::Result<SyncStatus> {
        let handle = SyncHandle::new(self.0.clone(), reporef, self.1.progress.clone(), None).await;
        let finished = handle.notify_done();
        self.1.queue.push(handle).await;
        Ok(finished.recv_async().await?)
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

            self.enqueue_sync(vec![reporef]).await;
        }

        Some(())
    }

    pub(crate) async fn cancel(&self, reporef: RepoRef) {
        self.1
            .active
            .update_async(&reporef, |_, v| {
                v.set_status(|_| SyncStatus::Cancelling);
                v.pipes.cancel();
            })
            .await;
    }

    pub(crate) async fn startup_scan(self) -> anyhow::Result<()> {
        let Self(Application { repo_pool, .. }, _) = &self;

        let mut repos = vec![];
        repo_pool.scan_async(|k, _| repos.push(k.clone())).await;

        self.enqueue_sync(repos).await;

        Ok(())
    }
}
