use std::{collections::HashSet, hash::Hash, time::Duration};

use crate::{
    repo::{Backend, BranchFilter, RepoRef, Repository, SyncStatus},
    state::RepositoryPool,
    Application,
};
use axum::{
    extract::Query,
    http::StatusCode,
    response::{sse, IntoResponse, Sse},
    Extension, Json,
};
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};

use super::prelude::*;

#[derive(Serialize, Debug, Eq)]
pub(super) struct Repo {
    pub(super) provider: Backend,
    pub(super) name: String,
    #[serde(rename = "ref")]
    pub(super) repo_ref: RepoRef,
    pub(super) local_duplicates: Vec<RepoRef>,
    pub(super) sync_status: SyncStatus,
    pub(super) last_update: DateTime<Utc>,
    pub(super) last_index: Option<DateTime<Utc>>,
    pub(super) most_common_lang: Option<String>,
    pub(super) branch_filter: Option<BranchFilter>,
    pub(super) branches: Vec<String>,
}

impl From<(&RepoRef, &Repository)> for Repo {
    fn from((key, repo): (&RepoRef, &Repository)) -> Self {
        Repo {
            provider: key.backend(),
            name: key.display_name(),
            repo_ref: key.clone(),
            sync_status: repo.sync_status.clone(),
            local_duplicates: vec![],
            last_update: NaiveDateTime::from_timestamp_opt(repo.last_commit_unix_secs as i64, 0)
                .unwrap()
                .and_local_timezone(Utc)
                .unwrap(),
            last_index: match repo.last_index_unix_secs {
                0 => None,
                other => Some(
                    NaiveDateTime::from_timestamp_opt(other as i64, 0)
                        .unwrap()
                        .and_local_timezone(Utc)
                        .unwrap(),
                ),
            },
            most_common_lang: repo.most_common_lang.clone(),
            branch_filter: repo.branch_filter.clone(),
            branches: 'branch_list: {
                let Ok(git) = gix::open(&repo.disk_path)
		else {
		    break 'branch_list vec![];
		};

                let Ok(refs) = git.references()
		else {
		    break 'branch_list vec![];
		};

                let Ok(refs) = refs.all()
		else {
		    break 'branch_list vec![];
		};

                use gix::bstr::ByteSlice;
                refs.filter_map(Result::ok)
                    .map(|r| r.name().shorten().to_str_lossy().to_string())
                    .collect()
            },
        }
    }
}

impl Repo {
    pub(crate) fn from_github(
        local_duplicates: Vec<RepoRef>,
        origin: &octocrab::models::Repository,
    ) -> Self {
        let name = origin.full_name.clone().unwrap();
        Repo {
            provider: Backend::Github,
            repo_ref: RepoRef::new(Backend::Github, &name).unwrap(),
            sync_status: SyncStatus::Uninitialized,
            local_duplicates,
            name,
            last_update: origin.pushed_at.unwrap(),
            last_index: None,
            most_common_lang: None,
            branch_filter: None,
            branches: vec![],
        }
    }
}

impl Hash for Repo {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.repo_ref.hash(state)
    }
}

impl PartialEq for Repo {
    fn eq(&self, other: &Self) -> bool {
        self.repo_ref == other.repo_ref
    }
}

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum ReposResponse {
    List(Vec<Repo>),
    Item(Repo),
    SyncQueued,
    Deleted,
}

impl super::ApiResponse for ReposResponse {}

/// Get a stream of status notifications about the indexing of each repository
/// This endpoint opens an SSE stream
//
pub(super) async fn index_status(Extension(app): Extension<Application>) -> impl IntoResponse {
    let mut receiver = app.sync_queue.subscribe();

    Sse::new(async_stream::stream! {
        while let Ok(event) = receiver.recv().await {
            yield sse::Event::default().json_data(event).map_err(|err| {
                <_ as Into<Box<dyn std::error::Error + Send + Sync>>>::into(err)
            });
        }
    })
    .keep_alive(
        sse::KeepAlive::new()
            .interval(Duration::from_secs(5))
            .event(sse::Event::default().event("heartbeat")),
    )
}

#[derive(Deserialize)]
pub(super) struct IndexedParams {
    repo: Option<RepoRef>,
}

#[derive(Deserialize)]
pub(super) struct RepoParams {
    repo: RepoRef,
}

/// Retrieve all indexed repositories
//
pub(super) async fn indexed(
    Query(IndexedParams { repo }): Query<IndexedParams>,
    app: Extension<Application>,
) -> Result<impl IntoResponse> {
    if let Some(repo) = repo {
        return get_by_id(Query(RepoParams { repo }), app).await;
    }

    let mut repos = vec![];
    app.0
        .repo_pool
        .scan_async(|k, v| repos.push(Repo::from((k, v))))
        .await;

    Ok(json(ReposResponse::List(repos)))
}

/// Get details of an indexed repository based on their id
pub(super) async fn get_by_id(
    Query(RepoParams { repo }): Query<RepoParams>,
    Extension(app): Extension<Application>,
) -> Result<Json<super::Response<'static>>> {
    match app
        .repo_pool
        .read_async(&repo, |k, v| ReposResponse::Item(Repo::from((k, v))))
        .await
    {
        Some(result) => Ok(json(result)),
        None => Err(Error::new(ErrorKind::NotFound, "Can't find repository")),
    }
}

/// Delete a repository from the disk and any indexes
//
pub(super) async fn delete_by_id(
    Query(RepoParams { repo }): Query<RepoParams>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse> {
    match app.write_index().remove(repo).await {
        Some(_) => Ok(json(ReposResponse::Deleted)),
        None => Err(Error::new(ErrorKind::NotFound, "Repo not found")),
    }
}

/// Synchronize a repo by its id
pub(super) async fn sync(
    Query(RepoParams { repo }): Query<RepoParams>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse> {
    app.write_index().sync_and_index(vec![repo]).await;
    Ok(json(ReposResponse::SyncQueued))
}

/// Synchronize a repo by its id
pub(super) async fn delete_sync(
    Query(RepoParams { repo }): Query<RepoParams>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse> {
    app.write_index().cancel(repo).await;
    Ok(json(ReposResponse::SyncQueued))
}

/// List all repositories that are either indexed, or available for indexing
//
pub(super) async fn available(Extension(app): Extension<Application>) -> impl IntoResponse {
    let unknown_github = app
        .credentials
        .github()
        .map(|gh| gh.repositories)
        .unwrap_or_default()
        .iter()
        .map(|repo| {
            let mut local_duplicates = vec![];
            app.repo_pool.scan(|k, v| {
                // either `ssh_url` or `clone_url` should match what we generate.
                //
                // also note that this is quite possibly not the
                // most efficient way of doing this, but the
                // number of repos should be small, so even n^2
                // should be fast.
                //
                // most of the time is spent in the network.
                if [
                    repo.ssh_url.as_deref().unwrap_or_default().to_lowercase(),
                    repo.clone_url
                        .as_ref()
                        .map(|url| url.as_str())
                        .unwrap_or_default()
                        .to_lowercase(),
                ]
                .contains(&v.remote.to_string().to_lowercase())
                {
                    local_duplicates.push(k.clone())
                }
            });

            Repo::from_github(local_duplicates, repo)
        })
        .collect::<HashSet<_>>();

    let repos = list_unique_repos(app.repo_pool.clone(), unknown_github).await;
    (StatusCode::OK, Json(ReposResponse::List(repos)))
}

#[derive(Serialize, Deserialize, Debug)]
pub(super) struct SetIndexed {
    indexed: Vec<RepoRef>,
}

/// Update the list of repositories that are currently being indexed.
/// This will automatically trigger a sync of currently un-indexed repositories.
//
pub(super) async fn set_indexed(
    Extension(app): Extension<Application>,
    Json(new_list): Json<SetIndexed>,
) -> impl IntoResponse {
    let mut repo_list = new_list.indexed.into_iter().collect::<HashSet<_>>();

    app.repo_pool
        .for_each_async(|k, existing| {
            if !repo_list.contains(k) {
                existing.mark_removed();
                repo_list.insert(k.to_owned());
            }
        })
        .await;

    app.write_index()
        .sync_and_index(repo_list.into_iter().collect())
        .await;

    json(ReposResponse::SyncQueued)
}

/// Patch a repository with the given payload
/// This will automatically trigger a sync
//
pub(super) async fn patch_indexed(
    Query(RepoParams { repo }): Query<RepoParams>,
    Extension(app): Extension<Application>,
    Json(patch): Json<RepositoryPatch>,
) -> Result<impl IntoResponse> {
    match app.repo_pool.get_async(&repo).await {
        None => Err(Error::new(ErrorKind::NotFound, "Can't find repository")),
        Some(mut entry) => {
            // this should panic if we can't parse it
            let _ = crate::repo::iterator::BranchFilter::from(&patch.branch_filter);
            entry.get_mut().branch_filter = patch.branch_filter;
            app.write_index().sync_and_index(vec![repo]).await;
            Ok(json(ReposResponse::SyncQueued))
        }
    }
}

#[derive(Deserialize)]
pub(super) struct RepositoryPatch {
    branch_filter: Option<BranchFilter>,
}

#[derive(Deserialize)]
pub(super) struct ScanRequest {
    /// The path to scan
    path: String,
}

/// Gather recognized repository types from the filesystem
///
pub(super) async fn scan_local(
    Query(scan_request): Query<ScanRequest>,
    Extension(app): Extension<Application>,
) -> impl IntoResponse {
    let root = std::path::Path::new(&scan_request.path);

    if app.allow_path(root) {
        Ok(json(ReposResponse::List(
            crate::remotes::gather_repo_roots(root, app.config.source.repo_dir())
                .into_iter()
                .map(|reporef| {
                    let mut repo = Repository::local_from(&reporef);
                    repo.sync_status = SyncStatus::Uninitialized;

                    (&reporef, &repo).into()
                })
                .collect(),
        )))
    } else {
        Err(Error::user("scanning not allowed").with_status(StatusCode::UNAUTHORIZED))
    }
}

async fn list_unique_repos(repo_pool: RepositoryPool, other: HashSet<Repo>) -> Vec<Repo> {
    let mut repos = HashSet::new();
    repo_pool
        .scan_async(|k, v| {
            // this will hash to the same thing as another object due
            // to `Hash` proxying to `repo_ref`, so stay on the safe
            // side and check like good citizens
            let repo = Repo::from((k, v));
            repos.insert(repo);
        })
        .await;

    repos.extend(other);
    repos.into_iter().collect()
}

#[cfg(test)]
mod test {
    use std::collections::HashSet;

    use crate::repo::{GitProtocol, GitRemote, RepoRef, RepoRemote::Git, Repository, SyncStatus};

    use super::{list_unique_repos, Repo, RepositoryPool};

    #[tokio::test]
    async fn unique_repos_only() {
        let repo_pool = RepositoryPool::default();
        repo_pool
            .insert(
                RepoRef::try_from("github.com/test/test").unwrap(),
                Repository {
                    disk_path: "/repo".into(),
                    remote: Git(GitRemote {
                        protocol: GitProtocol::Https,
                        host: "github.com".into(),
                        address: "test/test".into(),
                    }),
                    sync_status: SyncStatus::Done,
                    last_commit_unix_secs: 123456,
                    last_index_unix_secs: 123456,
                    most_common_lang: None,
                },
            )
            .unwrap();
        repo_pool
            .insert(
                RepoRef::try_from("local//code/test2").unwrap(),
                Repository {
                    disk_path: "/repo2".into(),
                    remote: Git(GitRemote {
                        protocol: GitProtocol::Https,
                        host: "github.com".into(),
                        address: "test/test2".into(),
                    }),
                    sync_status: SyncStatus::Done,
                    last_commit_unix_secs: 123456,
                    last_index_unix_secs: 123456,
                    most_common_lang: None,
                },
            )
            .unwrap();

        let mut gh_list = HashSet::new();
        gh_list.insert(
            (
                &RepoRef::try_from("github.com/test/test").unwrap(),
                &Repository {
                    disk_path: "/unused".into(),
                    remote: Git(GitRemote {
                        protocol: GitProtocol::Https,
                        host: "github.com".into(),
                        address: "test/test".into(),
                    }),
                    sync_status: SyncStatus::Uninitialized,
                    last_commit_unix_secs: 123456,
                    last_index_unix_secs: 0,
                    most_common_lang: None,
                },
            )
                .into(),
        );

        let mut ghrepo_2: Repo = (
            &RepoRef::try_from("github.com/test/test2").unwrap(),
            &Repository {
                disk_path: "/unused".into(),
                remote: Git(GitRemote {
                    protocol: GitProtocol::Https,
                    host: "github.com".into(),
                    address: "test/test2".into(),
                }),
                sync_status: SyncStatus::Uninitialized,
                last_commit_unix_secs: 123456,
                last_index_unix_secs: 0,
                most_common_lang: None,
            },
        )
            .into();

        ghrepo_2.local_duplicates = vec![RepoRef::try_from("local//code/test2").unwrap()];
        gh_list.insert(ghrepo_2);

        let unique = list_unique_repos(repo_pool, gh_list)
            .await
            .into_iter()
            .map(|repo| repo.repo_ref)
            .collect::<HashSet<_>>();
        assert_eq!(
            HashSet::from([
                RepoRef::try_from("local//code/test2").unwrap(),
                RepoRef::try_from("github.com/test/test").unwrap(),
                RepoRef::try_from("github.com/test/test2").unwrap(),
            ]),
            unique
        );
    }
}
