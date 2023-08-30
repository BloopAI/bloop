use std::{collections::HashSet, hash::Hash, time::Duration};

use crate::{
    background::QueuedRepoStatus,
    repo::{Backend, BranchFilterConfig, RepoRef, Repository, SyncStatus},
    state::RepositoryPool,
    Application,
};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{sse, IntoResponse, Sse},
    Extension, Json,
};
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};

use super::{middleware::User, prelude::*};

#[derive(Serialize, Debug, PartialEq, Eq)]
pub(crate) struct Branch {
    last_commit_unix_secs: u64,
    name: String,
}

#[derive(Serialize, Debug, Eq)]
pub(crate) struct Repo {
    pub(super) provider: Backend,
    pub(super) name: String,
    #[serde(rename = "ref")]
    pub(super) repo_ref: RepoRef,
    pub(super) local_duplicates: Vec<RepoRef>,
    pub(super) sync_status: SyncStatus,
    pub(super) last_update: DateTime<Utc>,
    pub(super) last_index: Option<DateTime<Utc>>,
    pub(super) most_common_lang: Option<String>,
    pub(super) branch_filter: BranchFilterConfig,
    pub(super) branches: Vec<Branch>,
}

impl From<(&RepoRef, &Repository)> for Repo {
    fn from((key, repo): (&RepoRef, &Repository)) -> Self {
        let (head, branches) = 'branch_list: {
            let default = ("HEAD".to_string(), vec![]);
            let Ok(git) = gix::open(&repo.disk_path)
            else {
                break 'branch_list default;
            };

            let head = git
                .head()
                .ok()
                .and_then(|head| head.try_into_referent())
                .map(|r| {
                    if key.is_local() {
                        r.name().shorten().to_string()
                    } else {
                        format!("origin/{}", r.name().shorten())
                    }
                })
                .unwrap_or_else(|| default.0.clone());

            let Ok(refs) = git.references()
            else {
                break 'branch_list default;
            };

            let Ok(refs) = refs.all()
            else {
                break 'branch_list default;
            };

            use gix::bstr::ByteSlice;
            let mut branches = refs
                .filter_map(Result::ok)
                .filter_map(|mut r| {
                    let name = r.name().shorten().to_str_lossy().to_string();
                    let last_commit_unix_secs = r
                        .peel_to_id_in_place()
                        .ok()?
                        .object()
                        .ok()?
                        .try_into_commit()
                        .ok()?
                        .time()
                        .ok()?
                        .seconds;

                    Some(Branch {
                        name,
                        last_commit_unix_secs,
                    })
                })
                .filter(|b| b.name != "origin/HEAD" && b.name.starts_with("origin/"))
                .collect::<Vec<_>>();

            branches.sort_by_key(|b| b.last_commit_unix_secs);
            (head, branches)
        };

        let branch_filter = {
            use BranchFilterConfig::*;
            match repo.branch_filter.clone() {
                Some(All) => Select(vec![".*".to_string()]),
                Some(Head) => Select(vec![head]),
                Some(Select(mut list)) => {
                    if let Some(pos) = list.iter().position(|i| i == &head) {
                        list.remove(pos);
                    }
                    list.insert(0, head);
                    Select(list)
                }
                None => Select(vec![head]),
            }
        };

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
            branch_filter,
            branches,
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
            branch_filter: crate::repo::BranchFilterConfig::Select(vec![]),
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
pub(crate) enum ReposResponse {
    List(Vec<Repo>),
    Item(Repo),
    SyncQueue(Vec<QueuedRepoStatus>),
    SyncQueued,
    Unchanged,
    Deleted,
}

impl super::ApiResponse for ReposResponse {}

#[allow(unused_mut)]
pub(super) fn router() -> Router {
    use axum::routing::*;

    let mut indexed = get(indexed).put(set_indexed).delete(delete_by_id);

    #[cfg(feature = "ee")]
    {
        indexed = indexed.patch(crate::ee::webserver::patch_with_branch);
    }

    Router::new()
        .route("/", get(available))
        .route("/queue", get(queue))
        .route("/status", get(index_status))
        .route("/indexed", indexed)
        .route("/sync", get(sync).delete(delete_sync))
}

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
pub(crate) struct RepoParams {
    pub(crate) repo: RepoRef,
}

/// Live report of the state of the sync queue
//
pub(super) async fn queue(State(app): State<Application>) -> impl IntoResponse {
    json(ReposResponse::SyncQueue(app.sync_queue.read_queue().await))
}

/// Retrieve all indexed repositories
//
pub(super) async fn indexed(
    Query(IndexedParams { repo }): Query<IndexedParams>,
    app: State<Application>,
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
    State(app): State<Application>,
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
    State(app): State<Application>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse> {
    // TODO: We can refactor `repo_pool` to also hold queued repos, instead of doing a calculation
    // like this which is prone to timing issues.
    let num_repos = app.repo_pool.len();
    let found = app.write_index().remove(repo).await.is_some();
    let num_deleted = if found { 1 } else { 0 };

    app.with_analytics(|analytics| {
        analytics.track_synced_repos(num_repos - num_deleted, user.login(), app.org_name());
    });

    if found {
        Ok(json(ReposResponse::Deleted))
    } else {
        Err(Error::new(ErrorKind::NotFound, "Repo not found"))
    }
}

/// Synchronize a repo by its id
pub(super) async fn sync(
    Query(RepoParams { repo }): Query<RepoParams>,
    State(app): State<Application>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse> {
    // TODO: We can refactor `repo_pool` to also hold queued repos, instead of doing a calculation
    // like this which is prone to timing issues.
    let num_repos = app.repo_pool.len();
    let num_queued = app.write_index().enqueue_sync(vec![repo]).await;

    app.with_analytics(|analytics| {
        analytics.track_synced_repos(num_repos + num_queued, user.login(), app.org_name());
    });

    Ok(json(ReposResponse::SyncQueued))
}

/// Synchronize a repo by its id
pub(super) async fn delete_sync(
    Query(RepoParams { repo }): Query<RepoParams>,
    State(app): State<Application>,
) -> Result<impl IntoResponse> {
    app.write_index().cancel(repo).await;
    Ok(json(ReposResponse::SyncQueued))
}

/// List all repositories that are either indexed, or available for indexing
//
pub(super) async fn available(State(app): State<Application>) -> impl IntoResponse {
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
    State(app): State<Application>,
    Extension(user): Extension<User>,
    Json(new_list): Json<SetIndexed>,
) -> impl IntoResponse {
    let mut repo_list = new_list.indexed.into_iter().collect::<HashSet<_>>();

    app.with_analytics(|analytics| {
        analytics.track_synced_repos(repo_list.len(), user.login(), app.org_name());
    });

    app.repo_pool
        .for_each_async(|k, existing| {
            if !repo_list.contains(k) {
                existing.mark_removed();
                repo_list.insert(k.to_owned());
            }
        })
        .await;

    app.write_index()
        .enqueue_sync(repo_list.into_iter().collect())
        .await;

    json(ReposResponse::SyncQueued)
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
    State(app): State<Application>,
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
                    branch_filter: Default::default(),
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
                    branch_filter: Default::default(),
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
                    branch_filter: Default::default(),
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
                branch_filter: Default::default(),
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
