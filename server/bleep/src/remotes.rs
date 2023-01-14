#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{path::Path, process::Command};

use anyhow::{bail, Context, Result};
use dashmap::mapref::one::Ref;
use git2::{Cred, RemoteCallbacks};
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use tracing::warn;

use crate::{
    state::{RepoRef, Repository, SyncStatus},
    Application,
};

pub mod github;

mod poll;
pub(crate) use poll::*;

pub(in crate::remotes) fn git_clone(
    auth: Box<git2::Credentials<'static>>,
    url: &str,
    target: &Path,
) -> Result<()> {
    let options = {
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(auth);

        let mut fo = git2::FetchOptions::new();
        fo.remote_callbacks(callbacks);
        fo
    };

    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(options);

    builder.clone(url, target)?;

    Ok(())
}

pub(in crate::remotes) fn git_pull(
    auth: Box<git2::Credentials<'static>>,
    repo: &Repository,
) -> Result<()> {
    let git = git2::Repository::open(&repo.disk_path)?;
    let head = git.head()?;
    let branch = head
        .name()
        .context("invalid checkout")?
        .split('/')
        .last()
        .context("invalid checkout")?;

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

    git.reset(
        &new_head,
        git2::ResetType::Hard,
        Some(git2::build::CheckoutBuilder::new().force()),
    )?;

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

pub(crate) fn gather_repo_roots(path: impl AsRef<Path>) -> impl Iterator<Item = RepoRef> {
    const RECOGNIZED_VCS_DIRS: &[&str] = &[".git"];

    WalkBuilder::new(path)
        .ignore(true)
        .hidden(false)
        .git_ignore(false)
        .git_global(false)
        .git_exclude(false)
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
    pub(crate) async fn sync(self, app: Application, repo_ref: RepoRef) -> Result<()> {
        tokio::task::spawn_blocking(move || {
            use BackendCredential::*;

            let existing = app.repo_pool.get_mut(&repo_ref);
            let synced = match existing {
                // if there's a parallel process already syncing, just return
                Some(repo) if repo.sync_status == SyncStatus::Syncing => bail!("sync in progress"),
                Some(mut repo) => {
                    repo.value_mut().sync_status = SyncStatus::Syncing;
                    let repo = repo.downgrade();

                    match self {
                        Github(gh) => gh.pull_repo(&repo),
                    }
                }
                None => {
                    let (disk_path, address) = {
                        let repo = create_repository(&app, &repo_ref);
                        (repo.disk_path.clone(), repo.remote.to_string())
                    };

                    match self {
                        Github(gh) => gh.clone_repo(&address, &disk_path),
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
        })
        .await?
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
