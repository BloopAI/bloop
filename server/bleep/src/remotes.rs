#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    borrow::Borrow,
    collections::HashMap,
    path::{Path, PathBuf},
    process::Command,
    sync::Arc,
};

use git2::{Cred, CredentialType, RemoteCallbacks};
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use tracing::{error, warn};

use crate::{
    remotes,
    repo::{Backend, RepoError, RepoRef, Repository, SyncStatus},
    Application,
};

pub mod github;

mod poll;
pub(crate) use poll::*;

type GitCreds = Box<
    dyn FnMut(&str, Option<&str>, CredentialType) -> std::result::Result<Cred, git2::Error>
        + Send
        + 'static,
>;

pub(crate) type Result<T> = std::result::Result<T, RemoteError>;
#[derive(thiserror::Error, Debug)]
pub(crate) enum RemoteError {
    #[error("remote not found")]
    RemoteNotFound,

    #[error("permission denied")]
    PermissionDenied,

    #[error("invalid checkout state")]
    InvalidLocalState,

    #[error("syncing in progress")]
    SyncInProgress,

    #[error("invalid configuration; missing: {0}")]
    Configuration(&'static str),

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

    #[error("underlying thread died: {0:?}")]
    JoinError(#[from] tokio::task::JoinError),

    #[error("low-level code: {0:?}")]
    UnspecifiedGit(git2::Error),
}

impl From<git2::Error> for RemoteError {
    fn from(value: git2::Error) -> Self {
        use git2::ErrorCode::*;

        match value.code() {
            Auth => RemoteError::PermissionDenied,
            NotFound => RemoteError::RemoteNotFound,
            _ => RemoteError::UnspecifiedGit(value),
        }
    }
}

async fn git_clone(auth: GitCreds, url: &str, target: &Path) -> Result<()> {
    let url = url.to_owned();
    let target = target.to_owned();

    tokio::task::spawn_blocking(move || {
        let options = {
            let mut callbacks = RemoteCallbacks::new();
            callbacks.credentials(auth);

            let mut fo = git2::FetchOptions::new();
            fo.remote_callbacks(callbacks);
            fo
        };

        let mut builder = git2::build::RepoBuilder::new();
        builder.fetch_options(options);
        builder.clone(&url, &target)
    })
    .await??;

    Ok(())
}

async fn git_pull(auth: GitCreds, repo: &Repository) -> Result<()> {
    let disk_path = repo.disk_path.to_owned();

    tokio::task::spawn_blocking(move || {
        let git = git2::Repository::open(&disk_path)?;
        let head = git.head()?;
        let branch = head
            .name()
            .ok_or(RemoteError::InvalidLocalState)?
            .split('/')
            .last()
            .ok_or(RemoteError::InvalidLocalState)?;

        let mut options = {
            let mut callbacks = RemoteCallbacks::new();
            callbacks.credentials(auth);

            let mut fo = git2::FetchOptions::new();
            fo.remote_callbacks(callbacks);
            fo
        };

        let mut remote = git.find_remote("origin")?;
        remote.fetch(&[&branch], Some(&mut options), None)?;

        let fetch_head = git.find_reference("FETCH_HEAD")?;
        let new_head = fetch_head.peel(git2::ObjectType::Commit)?;

        Ok::<_, RemoteError>(git.reset(
            &new_head,
            git2::ResetType::Hard,
            Some(git2::build::CheckoutBuilder::new().force()),
        )?)
    })
    .await??;

    let mut git_gc = Command::new("git");

    git_gc.arg("gc");
    git_gc.current_dir(&repo.disk_path);

    #[cfg(windows)]
    git_gc.creation_flags(0x08000000); // add a CREATE_NO_WINDOW flag to prevent window focus change

    match tokio::process::Command::from(git_gc).spawn() {
        Ok(_) => {
            // don't actually want to wait for this to finish, as `git` may
            // not even be available as a command.
        }
        Err(err) => {
            warn!(?err, "failed to invoke git-gc");
        }
    }

    Ok(())
}

pub(crate) fn gather_repo_roots(
    path: impl AsRef<Path>,
    exclude: Option<PathBuf>,
) -> impl Iterator<Item = RepoRef> {
    const RECOGNIZED_VCS_DIRS: &[&str] = &[".git"];

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
        .build()
        .filter_map(|entry| {
            entry.ok().and_then(|de| match de.file_type() {
                Some(ft)
                    if ft.is_dir()
                        && RECOGNIZED_VCS_DIRS
                            .contains(&de.file_name().to_string_lossy().as_ref()) =>
                {
                    Some(RepoRef::from(
                        &crate::canonicalize(
                            de.path().parent().expect("/ shouldn't be a git repo"),
                        )
                        .expect("repo root is both a dir and exists"),
                    ))
                }
                _ => None,
            })
        })
}

struct BackendEntry {
    inner: BackendCredential,
    updated: flume::Receiver<()>,
    updated_tx: flume::Sender<()>,
}

impl From<BackendCredential> for BackendEntry {
    fn from(inner: BackendCredential) -> Self {
        let (updated_tx, updated) = flume::unbounded();
        BackendEntry {
            inner,
            updated_tx,
            updated,
        }
    }
}

#[derive(Clone)]
pub struct Backends {
    /// If the environment is a Tauri app, or auth is instance-wide,
    /// This will refresh the correct user.
    authenticated_user: Arc<tokio::sync::RwLock<Option<String>>>,
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

    pub(crate) fn set_github(&self, gh: github::State) {
        self.backends
            .entry(Backend::Github)
            .and_modify(|existing| {
                existing.inner = BackendCredential::Github(gh.clone());
                existing.updated_tx.send(()).unwrap();
            })
            .or_insert_with(|| BackendCredential::Github(gh).into());
    }

    pub(crate) fn github_updated(&self) -> Option<flume::Receiver<()>> {
        self.backends
            .read(&Backend::Github, |_, v| v.updated.clone())
    }

    pub(crate) async fn serialize(&self) -> impl Serialize + Send + Sync {
        let mut output = HashMap::new();
        self.backends
            .scan_async(|k, v| {
                output.insert(k.clone(), v.inner.clone());
            })
            .await;

        output
    }

    pub(crate) async fn set_user(&self, user: String) {
        self.authenticated_user.write().await.replace(user);
    }

    pub(crate) async fn user(&self) -> Option<String> {
        self.authenticated_user.read().await.clone()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) enum BackendCredential {
    Github(github::State),
}

impl BackendCredential {
    pub(crate) async fn sync(self, app: Application, repo_ref: RepoRef) -> Result<()> {
        use BackendCredential::*;

        let existing = app
            .repo_pool
            .update_async(&repo_ref, |_k, repo| {
                if repo.sync_status == SyncStatus::Syncing {
                    Err(RemoteError::SyncInProgress)
                } else {
                    repo.sync_status = SyncStatus::Syncing;
                    Ok(())
                }
            })
            .await;

        let Github(gh) = self;
        let synced = match existing {
            Some(Err(err)) => return Err(err),
            Some(Ok(_)) => {
                let repo = app
                    .repo_pool
                    .read_async(&repo_ref, |_k, repo| repo.clone())
                    .await
                    .unwrap();
                gh.auth.pull_repo(repo).await
            }
            None => {
                create_repository(&app, &repo_ref).await;
                let repo = app
                    .repo_pool
                    .read_async(&repo_ref, |_k, repo| repo.clone())
                    .await
                    .unwrap();
                gh.auth.clone_repo(repo.clone()).await
            }
        };

        let new_status = match synced {
            Ok(_) => SyncStatus::Queued,
            Err(ref err) => SyncStatus::Error {
                message: err.to_string(),
            },
        };

        app.repo_pool
            .update_async(&repo_ref, |_k, v| v.sync_status = new_status)
            .await
            .unwrap();

        app.config.source.save_pool(app.repo_pool.clone())?;
        synced
    }
}

async fn create_repository<'a>(app: &'a Application, reporef: &RepoRef) {
    let name = reporef.to_string();
    let disk_path = app
        .config
        .source
        .repo_path_for_name(&name.replace('/', "_"));

    let remote = reporef.as_ref().into();

    app.repo_pool
        .entry_async(reporef.clone())
        .await
        .or_insert_with(|| Repository {
            disk_path,
            remote,
            sync_status: SyncStatus::Syncing,
            last_index_unix_secs: 0,
            last_commit_unix_secs: 0,
            most_common_lang: None,
        });
}
