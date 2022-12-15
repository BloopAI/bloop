use anyhow::bail;
use tracing::{debug, error, info};

use crate::{
    indexes,
    state::{RepoRef, Repository, SyncStatus},
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
                let writer = IndexWriter(app.clone());
                set.spawn(async move {
                    debug!(?reporef, "syncing repo");

                    if let Err(err) = writer.sync_repo(&reporef).await {
                        error!(?err, ?reporef, "failed to sync repository");
                        return Err(err);
                    }

                    if let Err(err) = writer.index_repo(&reporef).await {
                        error!(?err, ?reporef, "failed to index repository");
                        return Err(err);
                    }

                    Ok(())
                });
            }

            while let Some(job) = set.join_next().await {
                job??
            }

            Ok(())
        };

        background.wait_for(job).await
    }

    pub(crate) fn queue_sync_and_index(self, repositories: Vec<RepoRef>) {
        tokio::task::spawn(self.sync_and_index(repositories));
    }

    pub(crate) async fn startup_scan(self) -> anyhow::Result<()> {
        let Self(Application { repo_pool, .. }) = &self;

        let repos = repo_pool.iter().map(|elem| elem.key().clone()).collect();
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
        let (key, repo) = {
            let ptr = repo_pool.get(reporef).unwrap();
            let key = ptr.key().clone();
            let repo = ptr.value().clone();
            (key, repo)
        };

        let (state, indexed) = match repo.sync_status {
            Uninitialized | Syncing | Indexing => return Ok(()),
            Removed => (None, self.delete_repo(&repo, &writers)),
            _ => {
                repo_pool.get_mut(reporef).unwrap().value_mut().sync_status = Indexing;
                let indexed = repo.index(&key, &writers).await;
                let state = match &indexed {
                    Ok(state) => Some(state.clone()),
                    _ => None,
                };

                (state, indexed.map(|_| ()).map_err(|e| e.into()))
            }
        };

        // self is a separate sweep so we don't await while holding locks
        repo_pool.retain(|_k, v| v.sync_status != Removed);

        writers.commit().await?;
        config.source.save_pool(repo_pool.clone())?;

        let mut repo = repo_pool.get_mut(reporef).unwrap();
        match indexed {
            Ok(()) => {
                repo.value_mut().sync_done_with(state.unwrap());
                info!("commit complete; indexing done");
            }
            Err(err) => {
                repo.value_mut().sync_status = Error {
                    message: err.to_string(),
                };
                error!(?err, ?reporef, "failed to index repository");
            }
        }

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
        let creds = match app.credentials.get(&repo.backend()) {
            Some(creds) => creds.clone(),
            None => {
                let Some(path) = repo.local_path() else {
		    bail!("no keys for backend {:?}", backend)
		};

                if !app.path_allowed(path) {
                    bail!("path not authorized {repo:?}")
                }

                self.0
                    .repo_pool
                    .entry(repo.to_owned())
                    .or_insert_with(|| Repository::local_from(&repo));

                // we _never_ touch the git repositories of local repos
                return Ok(());
            }
        };

        creds.sync(app.clone(), repo).await
    }

    fn delete_repo(
        &self,
        repo: &Repository,
        writers: &indexes::GlobalWriteHandleRef<'_>,
    ) -> anyhow::Result<()> {
        let IndexWriter(Application { config, .. }) = self;

        repo.delete_file_cache(&config.index_dir)?;

        for handle in writers {
            handle.delete(repo);
        }

        Ok(())
    }
}
