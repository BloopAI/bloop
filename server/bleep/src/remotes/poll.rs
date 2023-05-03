use std::{
    ops::Not,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use chrono::Utc;
use notify_debouncer_mini::{
    new_debouncer_opt,
    notify::{Config, RecommendedWatcher, RecursiveMode},
    DebounceEventResult, Debouncer,
};
use rand::{distributions, thread_rng, Rng};
use tokio::{task::JoinHandle, time::sleep};
use tracing::{debug, error, info, warn};

use crate::{
    env::Feature,
    remotes,
    repo::{Backend, RepoRef, SyncStatus},
    Application,
};

const POLL_INTERVAL_MINUTE: &[Duration] = &[
    Duration::from_secs(60),
    Duration::from_secs(3 * 60),
    Duration::from_secs(10 * 60),
    Duration::from_secs(20 * 60),
    Duration::from_secs(30 * 60),
];

pub(crate) async fn sync_github_status(app: Application) {
    const POLL_PERIOD: Duration = POLL_INTERVAL_MINUTE[1];
    const LIVENESS: Duration = Duration::from_secs(1);

    let timeout = || async {
        sleep(LIVENESS).await;
    };

    let timeout_or_update = |last_poll: SystemTime, handle: flume::Receiver<()>| async move {
        loop {
            tokio::select! {
                _ = sleep(POLL_PERIOD) => {
                    debug!("timeout expired; refreshing repositories");
                    return SystemTime::now();
                },
                result = handle.recv_async() => {
                    let now = SystemTime::now();
                    match result {
                        Ok(_) if now.duration_since(last_poll).unwrap() > POLL_PERIOD => {
                            debug!("github credentials changed; refreshing repositories");
                            return now;
                        }
                        Ok(_) => {
                            continue;
                        }
                        Err(flume::RecvError::Disconnected) => {
                            return SystemTime::now();
                        }
                    };
                }
            }
        }
    };

    let mut last_poll = UNIX_EPOCH;
    loop {
        let Some(github) = app.credentials.github() else {
            timeout().await;
            continue;
	};
        debug!("credentials exist");

        let Ok(repos) = github.current_repo_list().await else {
            timeout().await;
            continue;
	};
        debug!("repo list updated");

        let updated = app.credentials.github_updated().unwrap();
        let new = github.update_repositories(repos);

        // store the updated credentials here
        app.credentials.set_github(new);

        // then retrieve username & other maintenance
        update_credentials(&app).await;

        // swallow the event that's generated from this update
        _ = updated.recv_async().await;
        last_poll = timeout_or_update(last_poll, updated).await;
    }
}

async fn update_credentials(app: &Application) {
    if app.env.allow(Feature::GithubInstallation) {
        match app.credentials.github().and_then(|c| c.expiry()) {
            // If we have a valid token, do nothing.
            Some(expiry) if expiry > Utc::now() + chrono::Duration::minutes(10) => {}

            _ => {
                if let Err(e) = remotes::github::refresh_github_installation_token(app).await {
                    error!(?e, "failed to get GitHub token");
                }
            }
        }
    }

    if app.env.allow(Feature::GithubDeviceFlow) {
        let expired = if let Some(github) = app.credentials.github() {
            let username = github.validate().await;
            if let Ok(Some(ref user)) = username {
                debug!(?user, "updated user");
                app.credentials.set_user(user.into()).await;
            }

            username.is_err()
        } else {
            true
        };

        if expired && app.credentials.remove(&Backend::Github).is_some() {
            app.config
                .source
                .save_credentials(&app.credentials.serialize().await)
                .unwrap();
            debug!("github oauth is invalid; credentials removed");
        }
    }
}

pub(crate) async fn check_repo_updates(app: Application) {
    let handles: Arc<scc::HashMap<RepoRef, JoinHandle<_>>> = Arc::default();
    loop {
        app.repo_pool
            .scan_async(|reporef, repo| match handles.entry(reporef.to_owned()) {
                scc::hash_map::Entry::Occupied(value) => {
                    if value.get().is_finished() {
                        _ = value.remove_entry();
                    }
                }
                scc::hash_map::Entry::Vacant(vacant) => {
                    if repo.sync_status.indexable() {
                        vacant.insert_entry(tokio::spawn(periodic_repo_poll(
                            app.clone(),
                            reporef.to_owned(),
                        )));
                    }
                }
            })
            .await;

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
        if status.indexable().not() {
            warn!(?status, "skipping indexing of repo");
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
        if status.indexable().not() {
            warn!(?status, ?reporef, "terminating monitoring for repo");
            return None;
        }

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
                .read(reporef, |_, v| v.disk_path.join(".git"))?;

            let mut debouncer = debounced_events(tx);
            debouncer
                .watcher()
                .watch(&git_path, RecursiveMode::Recursive)
                .map_err(|e| {
                    let d = git_path.display();
                    error!(error = %e, path = %d, "path does not exist anymore");
                })
                .ok()?;
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
    app.repo_pool.read(reporef, |_, repo| {
        (repo.last_commit_unix_secs, repo.sync_status.clone())
    })
}

fn debounced_events(tx: flume::Sender<()>) -> Debouncer<RecommendedWatcher> {
    new_debouncer_opt(
        Duration::from_secs(5),
        None,
        move |event: DebounceEventResult| match event {
            Ok(events) if events.is_empty().not() => {
                if let Err(e) = tx.send(()) {
                    error!("{e}");
                }
            }
            Ok(_) => debug!("no events received from debouncer"),
            Err(err) => {
                error!(?err, "repository monitoring");
            }
        },
        Config::default().with_compare_contents(true),
    )
    .unwrap()
}
