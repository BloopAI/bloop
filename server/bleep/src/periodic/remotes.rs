use std::{
    ops::Not,
    sync::Arc,
    time::{Duration, SystemTime},
};

use anyhow::Context;
use chrono::{DateTime, Utc};
use notify_debouncer_mini::{
    new_debouncer_opt,
    notify::{Config, RecommendedWatcher, RecursiveMode},
    DebounceEventResult, Debouncer,
};
use rand::{distributions, thread_rng, Rng};
use tokio::task::JoinHandle;
use tracing::{debug, error, info, warn};

use crate::{
    env::Feature,
    remotes::{
        self,
        github::{self, Auth},
        CognitoGithubTokenBundle,
    },
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

/// Like `tokio::time::sleep`, but sleeps based on wall clock time rather than uptime.
///
/// This internally sleeps in uptime increments of 2 seconds, checking whether the wall clock
/// duration has passed. We do this to support better updates when a system goes into a suspended
/// state, because `tokio::time::sleep` does not sleep according to wall clock time on some
/// systems.
///
/// For short sleep durations, this will simply call `tokio::time::sleep`, as drift due to suspend
/// is not usually relevant here.
async fn sleep_systime(duration: Duration) {
    if duration <= Duration::from_secs(2) {
        return tokio::time::sleep(duration).await;
    }

    let start = SystemTime::now();

    loop {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let Ok(elapsed) = start.elapsed() else {
            // There was a drift in system time probably because of
            // sleep.
            return;
        };
        if elapsed >= duration {
            return;
        }
    }
}

pub(crate) async fn sync_github_status(app: Application) {
    const POLL_PERIOD: Duration = POLL_INTERVAL_MINUTE[0];

    // In case this is a GitHub App installation, we get the
    // credentials from CLI/config
    loop {
        // then retrieve username & other maintenance
        update_credentials(&app).await;
        update_repo_list(&app).await;
        sleep_systime(POLL_PERIOD).await;
    }
}

pub(crate) async fn update_repo_list(app: &Application) {
    if let Some(gh) = app.credentials.github() {
        let repos = match gh.current_repo_list().await {
            Ok(repos) => {
                debug!("fetched new repo list");
                repos
            }
            Err(err) => {
                debug!(?err, "failed to update repo list");
                return;
            }
        };

        let new = gh.update_repositories(repos);
        app.credentials.set_github(new);
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
struct RefreshedAccessToken {
    access_token: String,
}

pub(crate) async fn update_credentials(app: &Application) {
    if app.env.allow(Feature::CloudUserAuth) {
        match app.credentials.github().and_then(|c| c.expiry()) {
            // If we have a valid token, do nothing.
            Some(expiry) if expiry > Utc::now() + chrono::Duration::minutes(10) => {}

            _ => {
                if let Err(e) = remotes::github::refresh_github_installation_token(app).await {
                    error!(?e, "failed to get GitHub token");
                }
                if app.credentials.github().is_none() {
                    error!("Error in the matrix");
                }
                info!("Github installation token refreshed!")
            }
        }
    }

    if app.env.allow(Feature::DesktopUserAuth) {
        let Some(github::State {
            auth: github::Auth::OAuth(ref creds),
            repositories,
        }) = app.credentials.github()
        else {
            return;
        };

        let verifier = crate::webserver::aaa::get_authorizer(app).await;
        let rotate_access_key = match verifier.check_auth(&creds.access_token).await {
            Ok(jsonwebtoken::TokenData { claims, .. }) => {
                DateTime::<Utc>::from(claims.exp) - Duration::from_secs(600) < Utc::now()
            }
            Err(err) => {
                warn!(?err, "failed to validate access token; rotating");
                true
            }
        };

        if !rotate_access_key {
            return;
        }

        let query_url = format!(
            "{url_base}/refresh_token?refresh_token={token}",
            url_base = app
                .config
                .cognito_mgmt_url
                .as_ref()
                .expect("auth not configured"),
            token = creds.refresh_token
        );

        let response = match reqwest::get(&query_url).await {
            Ok(res) => res.text().await,
            Err(err) => {
                warn!(?err, "refreshing bloop token failed");
                return;
            }
        }
        .context("body");

        let tokens: RefreshedAccessToken =
            match response.and_then(|r| serde_json::from_str(&r).context(format!("json: {r}"))) {
                Ok(tokens) => tokens,
                Err(err) => {
                    // This is sort-of a wild assumption here, BUT hear me out.
                    //
                    // Refresh tokens are encrypted by Cognito, so
                    // this process can't check expiry.
                    //
                    // Assuming there's a successful HTTP response
                    // (`reqwest::get` above),
                    //
                    // AND the received body can't be decoded,
                    // THEN the server sent a payload that is either:
                    //
                    //  a) unintelligible (eg. "Internal Server Error")
                    //  b) there's some weird network issue at play
                    //     that means we can only partially decode the payload
                    //
                    // IF we ignore b) as something unlikely,
                    // AND we consider all a) events to correspond to
                    // refresh token expiration.
                    //
                    // THEN we log the user out.
                    //
                    error!(?err, "failed to refresh access token. forcing re-login");

                    if app.credentials.remove(&Backend::Github).is_some() {
                        app.credentials.store().unwrap();
                    }

                    return;
                }
            };

        app.credentials.set_github(github::State {
            repositories,
            auth: Auth::OAuth(CognitoGithubTokenBundle {
                access_token: tokens.access_token,
                refresh_token: creds.refresh_token.clone(),
                github_access_token: creds.github_access_token.clone(),
            }),
        });

        app.credentials.store().unwrap();
        info!("new bloop access keys saved");

        validate_github_credentials(app).await;
    }
}

pub(crate) async fn validate_github_credentials(app: &Application) {
    let github_expired = if let Some(github) = app.credentials.github() {
        let username = github.validate().await;
        if let Ok(Some(ref user)) = username {
            debug!(?user, "updated user");
            app.credentials.set_user(user.into()).await;
            if let Err(err) = app.credentials.store() {
                error!(?err, "failed to save user credentials");
            }
        }

        username.is_err()
    } else {
        error!("failed to create github client?");
        true
    };

    if github_expired && app.credentials.remove(&Backend::Github).is_some() {
        app.credentials.store().unwrap();
        debug!("github oauth is invalid; credentials removed");
    }
}

pub(crate) async fn check_repo_updates(app: Application) {
    while app.credentials.github().is_none() {
        sleep_systime(Duration::from_millis(100)).await
    }

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

        sleep_systime(Duration::from_secs(5)).await
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
        match tokio::time::timeout(poller.jittery_interval(), poller.git_change()).await {
            Ok(_) => debug!(?reporef, "git changes triggered reindexing"),
            Err(_) => debug!(?reporef, "timeout; reindexing"),
        }

        use SyncStatus::*;
        let (last_updated, status) = check_repo(&app, &reporef)?;
        if status.indexable().not() {
            warn!(?status, "skipping indexing of repo");
            return None;
        }

        debug!("starting sync");
        if let Err(err) = app.write_index().block_until_synced(reporef.clone()).await {
            error!(?err, ?reporef, "failed to sync & index repo");
            return None;
        }

        debug!("sync done");
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
        let mut poll_interval_index = 2;
        let mut minimum_interval_index = 0;

        let (tx, rx) = flume::bounded(10);

        let mut _debouncer = None;
        if !app.config.disable_fsevents && reporef.backend() == Backend::Local {
            let disk_path = app.repo_pool.read(reporef, |_, v| v.disk_path.clone())?;

            let mut debouncer = debounced_events(tx);
            debouncer
                .watcher()
                .watch(&disk_path, RecursiveMode::Recursive)
                .map_err(|e| {
                    let d = disk_path.display();
                    error!(error = %e, path = %d, "path does not exist anymore");
                })
                .ok()?;
            _debouncer = Some(debouncer);

            info!(?reporef, ?disk_path, "will reindex repo on file changes");

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

fn check_repo(app: &Application, reporef: &RepoRef) -> Option<(i64, SyncStatus)> {
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
