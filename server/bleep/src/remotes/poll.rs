use std::{collections::HashMap, ops::Not, time::Duration};

use notify_debouncer_mini::{
    new_debouncer_opt,
    notify::{Config, RecommendedWatcher, RecursiveMode},
    DebounceEventResult, Debouncer,
};
use rand::{distributions, thread_rng, Rng};
use tokio::time::sleep;
use tracing::{debug, error, info};

use crate::{
    state::{Backend, RepoRef, SyncStatus},
    Application,
};

const POLL_INTERVAL_MINUTE: &[Duration] = &[
    Duration::from_secs(60),
    Duration::from_secs(3 * 60),
    Duration::from_secs(10 * 60),
    Duration::from_secs(20 * 60),
    Duration::from_secs(30 * 60),
];

pub(crate) async fn check_credentials(app: Application) {
    loop {
        let remove = 'remove: {
            let Some(creds) = app.credentials.get(&Backend::Github) else { break 'remove true };
            let Ok(client) = creds.to_github_client() else { break 'remove true };

            client.current().user().await.is_err()
        };

        if remove && app.credentials.remove(&Backend::Github).is_some() {
            app.config
                .source
                .save_credentials(app.credentials.clone())
                .unwrap();
            debug!("github oauth is invalid; credentials removed");
        }

        sleep(POLL_INTERVAL_MINUTE[0]).await;
    }
}

pub(crate) async fn check_repo_updates(app: Application) {
    let mut handles = HashMap::new();
    loop {
        let repos = app
            .repo_pool
            .iter()
            .map(|elem| elem.key().clone())
            .collect::<Vec<_>>();

        for repo in repos {
            let app = app.clone();
            let reporef = repo.clone();

            match handles.get(&repo) {
                None => {
                    handles.insert(repo.clone(), tokio::spawn(periodic_repo_poll(app, reporef)));
                }
                Some(handle) => {
                    if handle.is_finished() {
                        handles.remove(&repo);
                    }
                }
            }
        }

        sleep(Duration::from_secs(10)).await
    }
}

// We only return Option<()> here so we can clean up a bunch of error
// handling code with `?`
//
// In reality this doesn't carry any meaning currently
async fn periodic_repo_poll(app: Application, reporef: RepoRef) -> Option<()> {
    debug!(?reporef, "monitoring repo for changes");
    let mut poller = Poller::start(&app, &reporef)?;

    loop {
        use SyncStatus::*;
        let (last_updated, status) = check_repo(&app, &reporef)?;
        if matches!(status, Queued | Done | Error { .. }).not() {
            return None;
        }

        if let Err(err) = app
            .write_index()
            .sync_and_index(vec![reporef.clone()])
            .await
        {
            error!(?err, ?reporef, "failed to sync & index repo");
            return None;
        }

        let (updated, status) = check_repo(&app, &reporef)?;
        if last_updated == updated && status == Done {
            let poll_interval = poller.increase_interval();

            debug!(
                ?reporef,
                ?poll_interval,
                "repo unchanged, increasing backoff"
            )
        } else {
            let poll_interval = poller.reset_interval();

            debug!(
                ?reporef,
                ?last_updated,
                ?updated,
                ?poll_interval,
                "repo updated"
            )
        }

        let timeout = sleep(poller.jittery_interval());
        tokio::select!(
            _ = timeout => {
                debug!(?reporef, "reindexing");
                continue;
            },
            _ = poller.git_change() => {
                debug!(?reporef, "git changes triggered reindexing");
                continue;
            }
        );
    }
}

struct Poller {
    poll_interval_index: usize,
    minimum_interval_index: usize,
    git_events: flume::Receiver<()>,
    debouncer: Option<Debouncer<RecommendedWatcher>>,
}

impl Poller {
    fn start(app: &Application, reporef: &RepoRef) -> Option<Self> {
        let mut poll_interval_index = 0;
        let mut minimum_interval_index = 0;

        let (tx, rx) = flume::bounded(10);

        let mut _debouncer = None;
        if app.config.disable_fsevents.not() && reporef.backend() == Backend::Local {
            let git_path = app
                .repo_pool
                .get(reporef)
                .map(|repo| repo.value().disk_path.join(".git"))?;

            let mut debouncer = debounced_events(tx);
            debouncer
                .watcher()
                .watch(&git_path, RecursiveMode::Recursive)
                .unwrap();
            _debouncer = Some(debouncer);

            info!(?reporef, ?git_path, "will reindex repo on git changes");

            poll_interval_index = POLL_INTERVAL_MINUTE.len() - 1;
            minimum_interval_index = POLL_INTERVAL_MINUTE.len() - 1;
        }

        Some(Self {
            poll_interval_index,
            minimum_interval_index,
            debouncer: _debouncer,
            git_events: rx,
        })
    }

    fn increase_interval(&mut self) -> Duration {
        self.poll_interval_index =
            (self.poll_interval_index + 1).min(POLL_INTERVAL_MINUTE.len() - 1);
        self.interval()
    }

    fn reset_interval(&mut self) -> Duration {
        self.poll_interval_index = self.minimum_interval_index;
        self.interval()
    }

    fn interval(&self) -> Duration {
        POLL_INTERVAL_MINUTE[self.poll_interval_index]
    }

    fn jittery_interval(&self) -> Duration {
        let poll_interval = self.interval();

        // add random jitter to avoid contention when jobs start at the same time
        let jitter = thread_rng().sample(distributions::Uniform::new(
            10,
            30 + poll_interval.as_secs() / 2,
        ));
        poll_interval + Duration::from_secs(jitter)
    }

    async fn git_change(&mut self) {
        if self.debouncer.is_some() {
            _ = self.git_events.recv_async().await;
            _ = self.git_events.drain().collect::<Vec<_>>();
        } else {
            loop {
                futures::pending!()
            }
        }
    }
}

fn check_repo(app: &Application, reporef: &RepoRef) -> Option<(u64, SyncStatus)> {
    app.repo_pool.get(reporef).map(|elem| {
        let repo = elem.value();
        (repo.last_commit_unix_secs, repo.sync_status.clone())
    })
}

fn debounced_events(tx: flume::Sender<()>) -> Debouncer<RecommendedWatcher> {
    new_debouncer_opt(
        Duration::from_secs(5),
        None,
        move |event: DebounceEventResult| match event {
            Ok(events) if events.is_empty().not() => tx.send(()).unwrap(),
            Ok(_) => debug!("no events received from debouncer"),
            Err(err) => {
                error!(?err, "repository monitoring");
            }
        },
        Config::default().with_compare_contents(true),
    )
    .unwrap()
}
