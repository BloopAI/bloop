#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    borrow::Borrow,
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
};

use anyhow::Context;
use gix::{remote::fetch::Shallow, sec::identity::Account};
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use tracing::{error, warn};

use crate::{
    background::{SyncHandle, SyncPipes},
    remotes,
    repo::{Backend, RepoError, RepoRef, Repository, SyncStatus},
    Application,
};

pub mod github;

type GitCreds = Account;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct CognitoGithubTokenBundle {
    pub(crate) access_token: String,
    pub(crate) refresh_token: String,
    pub(crate) github_access_token: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(untagged)]
pub(crate) enum AuthResponse {
    Backoff { backoff_secs: u64 },
    Success(CognitoGithubTokenBundle),
    Error { error: String },
}

pub(crate) type Result<T> = std::result::Result<T, RemoteError>;
#[derive(thiserror::Error, Debug)]
pub(crate) enum RemoteError {
    #[error("remote not found")]
    RemoteNotFound,

    #[error("permission denied")]
    PermissionDenied,

    #[error("failed to refresh JWT token: {0}")]
    RefreshToken(reqwest::Error),

    #[error("operation not supported: {0}")]
    NotSupported(&'static str),

    #[error("persistence error: {0}")]
    Repo(#[from] RepoError),

    #[error("IO error: {0}")]
    IO(#[from] std::io::Error),

    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("github access error: {0}")]
    GitHub(#[from] octocrab::Error),

    #[error("anyhow: {0:?}")]
    Anyhow(#[from] anyhow::Error),

    #[error("underlying thread died: {0:?}")]
    JoinError(#[from] tokio::task::JoinError),

    #[error("git open: {0:?}")]
    GitOpen(#[from] gix::open::Error),

    #[error("git prepare fetch: {0:?}")]
    GitPrepareFetch(#[from] gix::remote::fetch::prepare::Error),

    #[error("git fetch: {0:?}")]
    GitFetch(#[from] gix::remote::fetch::Error),

    #[error("git find remote: {0:?}")]
    GitFindRemote(#[from] gix::remote::find::existing::Error),

    #[error("git find remote: {0:?}")]
    GitConnect(#[from] gix::remote::connect::Error),

    #[error("git clone: {0:?}")]
    GitClone(#[from] gix::clone::Error),

    #[error("git clone fetch: {0:?}")]
    GitCloneFetch(#[from] gix::clone::fetch::Error),

    #[error("interrupted")]
    Interrupted,
}

impl From<&RemoteError> for SyncStatus {
    fn from(value: &RemoteError) -> Self {
        SyncStatus::Error {
            message: value.to_string(),
        }
    }
}

impl From<Result<SyncStatus>> for SyncStatus {
    fn from(value: Result<SyncStatus>) -> Self {
        match value {
            Ok(status) => status,
            Err(err) => (&err).into(),
        }
    }
}

macro_rules! creds_callback(($auth:ident) => {{
    use gix::{
	credentials::{
            helper::{Action, NextAction},
            protocol::Outcome,
	}};

    let auth = $auth.clone();
    move |action| match action {
        Action::Get(ctx) => Ok(Some(Outcome {
            identity: auth.clone(),
            next: NextAction::from(ctx),
        })),
        Action::Store(_) => Ok(None),
        Action::Erase(_) => Ok(None),
    }
}});

async fn git_clone(
    auth: &Option<GitCreds>,
    url: &str,
    target: &Path,
    pipes: &SyncPipes,
    shallow: Shallow,
) -> Result<()> {
    let url = url.to_owned();
    let target = target.to_owned();
    let auth = auth.clone();

    let git_status = pipes.git_sync_progress();
    let interrupt = pipes.is_interrupted();

    tokio::task::spawn_blocking(move || {
        let mut clone = {
            let c = gix::prepare_clone_bare(url, target)?.with_shallow(shallow);
            match auth {
                Some(auth) => c.configure_connection(move |con| {
                    con.set_credentials(creds_callback!(auth));
                    Ok(())
                }),
                None => c,
            }
        };

        let (_repo, _outcome) = clone.fetch_only(git_status, &interrupt)?;
        Ok(())
    })
    .await?
}

async fn git_pull(
    auth: &Option<GitCreds>,
    repo: &Repository,
    pipes: &SyncPipes,
    shallow: Shallow,
) -> Result<()> {
    use gix::remote::Direction;

    let auth = auth.clone();
    let disk_path = repo.disk_path.to_owned();

    let interrupt = pipes.is_interrupted();

    tokio::task::spawn_blocking(move || {
        let repo = gix::open(disk_path)?;
        let remote = repo
            .find_default_remote(Direction::Fetch)
            .context("no remote found")??;

        let connection = {
            let c = remote.connect(Direction::Fetch)?;
            match auth {
                Some(auth) => c.with_credentials(creds_callback!(auth)),
                None => c,
            }
        };

        connection
            .prepare_fetch(gix::progress::Discard, Default::default())?
            .with_shallow(shallow)
            .receive(gix::progress::Discard, &interrupt)?;

        Ok(())
    })
    .await?
}

pub(crate) fn gather_repo_roots(
    path: impl AsRef<Path>,
    exclude: Option<PathBuf>,
) -> std::collections::HashSet<RepoRef> {
    const RECOGNIZED_VCS_DIRS: &[&str] = &[".git"];

    let repos = Arc::new(scc::HashSet::new());

    WalkBuilder::new(path)
        .ignore(true)
        .hidden(false)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(false)
        .filter_entry(move |entry| {
            exclude
                .as_ref()
                .and_then(|path| {
                    crate::canonicalize(entry.path())
                        .ok()
                        .map(|canonical_path| !canonical_path.starts_with(path))
                })
                .unwrap_or(true)
        })
        .build_parallel()
        .run(|| {
            let repos = repos.clone();
            Box::new(move |entry| {
                use ignore::WalkState::*;

                let Ok(de) = entry else {
                    return Continue;
                };

                let Some(ft) = de.file_type() else {
                    return Continue;
                };

                if ft.is_dir()
                    && RECOGNIZED_VCS_DIRS.contains(&de.file_name().to_string_lossy().as_ref())
                {
                    _ = repos.insert(RepoRef::from(
                        &crate::canonicalize(
                            de.path().parent().expect("/ shouldn't be a git repo"),
                        )
                        .expect("repo root is both a dir and exists"),
                    ));

                    // we've already taken this repo, do not search subdirectories
                    return Skip;
                }

                Continue
            })
        });

    let mut output = std::collections::HashSet::default();
    repos.scan(|entry| {
        output.insert(entry.clone());
    });

    output
}

struct BackendEntry {
    inner: BackendCredential,
}

impl Serialize for BackendEntry {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        self.inner.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for BackendEntry {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let inner = BackendCredential::deserialize(deserializer)?;
        Ok(inner.into())
    }
}

impl From<BackendCredential> for BackendEntry {
    fn from(inner: BackendCredential) -> Self {
        BackendEntry { inner }
    }
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Backends {
    /// If the environment is a Tauri app, or auth is instance-wide,
    /// This will refresh the correct user.
    authenticated_user: Arc<std::sync::RwLock<Option<String>>>,
    backends: Arc<scc::HashMap<Backend, BackendEntry>>,
}

impl From<HashMap<Backend, BackendCredential>> for Backends {
    fn from(mut value: HashMap<Backend, BackendCredential>) -> Self {
        let backends = Arc::new(scc::HashMap::default());
        for (k, v) in value.drain() {
            _ = backends.insert(k, v.into());
        }

        Self {
            backends,
            authenticated_user: Arc::default(),
        }
    }
}

impl Backends {
    pub(crate) fn for_repo(&self, repo: &RepoRef) -> Option<BackendCredential> {
        self.backends.read(&repo.backend(), |_, v| v.inner.clone())
    }

    pub(crate) fn remove(&self, backend: impl Borrow<Backend>) -> Option<BackendCredential> {
        self.backends.remove(backend.borrow()).map(|(_, v)| v.inner)
    }

    pub(crate) fn github(&self) -> Option<github::State> {
        self.backends.read(&Backend::Github, |_, v| {
            let BackendCredential::Github(ref github) = v.inner;
            github.clone()
        })
    }

    pub(crate) fn set_github(&self, gh: impl Into<github::State>) {
        let gh = gh.into();
        self.backends
            .entry(Backend::Github)
            .and_modify(|existing| {
                existing.inner = BackendCredential::Github(gh.clone());
            })
            .or_insert_with(|| BackendCredential::Github(gh).into());
    }

    pub(crate) async fn remove_user(&self) {
        *self.authenticated_user.write().unwrap() = None;
    }

    pub(crate) async fn set_user(&self, user: String) {
        self.authenticated_user.write().unwrap().replace(user);
    }

    pub(crate) fn user(&self) -> Option<String> {
        self.authenticated_user.read().unwrap().clone()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) enum BackendCredential {
    Github(github::State),
}

impl BackendCredential {
    #[tracing::instrument(fields(repo=%handle.reporef), skip_all)]
    pub(crate) async fn clone_or_pull(
        &self,
        handle: &SyncHandle,
        repo: Repository,
    ) -> Result<SyncStatus> {
        use BackendCredential::*;
        let Github(gh) = self;

        let creds = gh.auth.creds(&repo).await?;
        let clone = || async {
            handle.set_status(|_| SyncStatus::Syncing);
            git_clone(
                &creds,
                &repo.remote.to_string(),
                &repo.disk_path,
                &handle.pipes,
                handle.shallow_config.clone(),
            )
            .await
        };
        let pull = || async {
            git_pull(&creds, &repo, &handle.pipes, handle.shallow_config.clone()).await
        };

        let synced = if repo.last_index_unix_secs == 0 && repo.disk_path.exists() {
            // it is possible syncing was killed, but the repo is
            // intact. pull if the dir exists, then quietly revert
            // to cloning if that fails
            match pull().await {
                Ok(success) => Ok(success),
                Err(_) if handle.pipes.is_cancelled() => Err(RemoteError::Interrupted),
                Err(_) => clone().await,
            }
        } else if repo.last_index_unix_secs == 0 {
            clone().await
        } else {
            let pulled = pull().await;
            if pulled.is_err() && !handle.pipes.is_cancelled() {
                clone().await
            } else {
                pulled
            }
        };

        synced.map(|_| SyncStatus::Queued).map_err(|e| {
            if handle.pipes.is_cancelled() {
                RemoteError::Interrupted
            } else {
                e
            }
        })
    }
}
