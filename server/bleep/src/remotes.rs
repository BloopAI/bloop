#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    fmt::{self, Display},
    path::{Path, PathBuf},
    process::Command,
    str::FromStr,
};

use chrono::{DateTime, Utc};
use dashmap::mapref::one::Ref;
use git2::{Cred, CredentialType, RemoteCallbacks};
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use tracing::warn;
use utoipa::ToSchema;

use crate::{
    remotes,
    repo::{Backend, RepoRef, Repository, SyncStatus},
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

#[derive(Serialize, Deserialize, ToSchema, PartialEq, Eq, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct GitRemote {
    /// protocol to use during git operations
    pub protocol: GitProtocol,
    /// Hostname of provider
    pub host: String,
    /// any kind of `protocol` and [`Backend`]-dependent address
    pub address: String,
}

#[derive(Serialize, Deserialize, ToSchema, PartialEq, Eq, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum GitProtocol {
    Https,
    Ssh,
}

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

    #[error("IO error: {0}")]
    IO(#[from] std::io::Error),

    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("github access error: {0}")]
    GitHub(#[from] octocrab::Error),

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

#[derive(Serialize, Deserialize, ToSchema, PartialEq, Eq, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum RepoRemote {
    Git(GitRemote),
    None,
}

impl<T: AsRef<RepoRef>> From<T> for RepoRemote {
    fn from(reporef: T) -> Self {
        match reporef.as_ref() {
            RepoRef {
                backend: Backend::Github,
                name,
            } => RepoRemote::Git(GitRemote {
                protocol: GitProtocol::Https,
                host: "github.com".to_owned(),
                address: name.to_owned(),
            }),
            RepoRef {
                backend: Backend::Local,
                name: _name,
            } => RepoRemote::None,
        }
    }
}

impl Display for RepoRemote {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RepoRemote::Git(GitRemote {
                protocol,
                host,
                address,
            }) => match protocol {
                GitProtocol::Https => write!(f, "https://{host}/{address}.git"),
                GitProtocol::Ssh => write!(f, "git@{host}:{address}.git"),
            },
            RepoRemote::None => write!(f, "none"),
        }
    }
}

impl FromStr for RepoRemote {
    type Err = ();

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        if let Some(stripped) = value.strip_prefix("https://github.com/") {
            return Ok(RepoRemote::Git(GitRemote {
                protocol: GitProtocol::Https,
                host: "github.com".to_owned(),
                address: stripped
                    .trim_end_matches('/')
                    .trim_end_matches(".git")
                    .to_owned(),
            }));
        }

        if let Some(stripped) = value.strip_prefix("git@github.com:") {
            return Ok(RepoRemote::Git(GitRemote {
                protocol: GitProtocol::Ssh,
                host: "github.com".to_owned(),
                address: stripped
                    .trim_start_matches('/')
                    .trim_end_matches('/')
                    .trim_end_matches(".git")
                    .to_owned(),
            }));
        }

        Err(())
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
    .await
    .expect("git failed")?;

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
    .await
    .expect("git failed")?;

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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) enum BackendCredential {
    Github(github::Auth),
}

impl BackendCredential {
    pub(crate) async fn validate(&self) -> Result<()> {
        let BackendCredential::Github(auth) = self;

        let client = auth.client()?;
        client.current().user().await?;
        Ok(())
    }

    pub(crate) async fn sync(self, app: Application, repo_ref: RepoRef) -> Result<()> {
        use BackendCredential::*;

        let existing = app.repo_pool.get_mut(&repo_ref);
        let synced = match existing {
            // if there's a parallel process already syncing, just return
            Some(repo) if repo.sync_status == SyncStatus::Syncing => {
                return Err(RemoteError::SyncInProgress)
            }
            Some(mut repo) => {
                repo.value_mut().sync_status = SyncStatus::Syncing;
                let repo = repo.downgrade();

                match self {
                    Github(gh) => gh.pull_repo(&repo).await,
                }
            }
            None => {
                let repo = create_repository(&app, &repo_ref);

                match self {
                    Github(gh) => gh.clone_repo(&repo, &repo.disk_path.clone()).await,
                }
            }
        };

        let new_status = match synced {
            Ok(_) => SyncStatus::Queued,
            Err(ref err) => SyncStatus::Error {
                message: err.to_string(),
            },
        };

        app.repo_pool
            .get_mut(&repo_ref)
            .unwrap()
            .value_mut()
            .sync_status = new_status;

        synced
    }

    pub(crate) fn expiry(&self) -> Option<DateTime<Utc>> {
        match self {
            Self::Github(remotes::github::Auth::App { expiry, .. }) => Some(*expiry),
            _ => None,
        }
    }
}

fn create_repository<'a>(app: &'a Application, reporef: &RepoRef) -> Ref<'a, RepoRef, Repository> {
    let name = reporef.to_string();
    let disk_path = app
        .config
        .source
        .repo_path_for_name(&name.replace('/', "_"));

    let remote = reporef.as_ref().into();

    app.repo_pool
        .entry(reporef.clone())
        .or_insert_with(|| Repository {
            disk_path,
            remote,
            sync_status: SyncStatus::Syncing,
            last_index_unix_secs: 0,
            last_commit_unix_secs: 0,
            most_common_lang: None,
        })
        .downgrade()
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn parse_reporemote() {
        let https = RepoRemote::Git(GitRemote {
            host: "github.com".into(),
            address: "org/repo".into(),
            protocol: GitProtocol::Https,
        });

        let ssh = RepoRemote::Git(GitRemote {
            host: "github.com".into(),
            address: "org/repo".into(),
            protocol: GitProtocol::Ssh,
        });

        assert_eq!(https, "https://github.com/org/repo".parse().unwrap());
        assert_eq!(https, "https://github.com/org/repo.git".parse().unwrap());
        assert_eq!(ssh, "git@github.com:/org/repo.git".parse().unwrap());
        assert_eq!(ssh, "git@github.com:/org/repo".parse().unwrap());
        assert_eq!(ssh, "git@github.com:org/repo".parse().unwrap());
        assert_eq!(ssh, "git@github.com:org/repo.git".parse().unwrap());
        assert_eq!(ssh, "git@github.com:org/repo.git/".parse().unwrap());
        assert_eq!(ssh, "git@github.com:/org/repo.git/".parse().unwrap());
    }
}
