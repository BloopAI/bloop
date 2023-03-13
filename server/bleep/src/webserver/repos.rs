use std::collections::HashSet;

use crate::{
    remotes::BackendCredential,
    repo::{Backend, RepoRef, Repository, SyncStatus},
    Application,
};
use axum::{
    extract::{Path, Query},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use super::prelude::*;

#[derive(Serialize, ToSchema, Debug)]
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
            last_index: Some(
                NaiveDateTime::from_timestamp_opt(repo.last_index_unix_secs as i64, 0)
                    .unwrap()
                    .and_local_timezone(Utc)
                    .unwrap(),
            ),
            most_common_lang: repo.most_common_lang.clone(),
        }
    }
}

impl Repo {
    pub(crate) fn from_github(
        local_duplicates: Vec<RepoRef>,
        origin: octocrab::models::Repository,
    ) -> Self {
        let name = origin.full_name.unwrap();
        Repo {
            provider: Backend::Github,
            repo_ref: RepoRef::new(Backend::Github, &name).unwrap(),
            sync_status: SyncStatus::Uninitialized,
            local_duplicates,
            name,
            last_update: origin.pushed_at.unwrap(),
            last_index: None,
            most_common_lang: None,
        }
    }
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub(super) enum ReposResponse {
    List(Vec<Repo>),
    Item(Repo),
    SyncQueued,
    Deleted,
}

/// Retrieve all indexed repositories
//
#[utoipa::path(get, path = "/repos/indexed",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn indexed(Extension(app): Extension<Application>) -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(ReposResponse::List(
            app.repo_pool
                .iter()
                .map(|elem| Repo::from((elem.key(), elem.value())))
                .collect(),
        ))
        .into_response(),
    )
}

/// Get details of an indexed repository based on their id
#[utoipa::path(get, path = "/repos/indexed/:ref",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn get_by_id(
    Path(path): Path<Vec<String>>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse> {
    let Ok(reporef) = RepoRef::from_components(&app.config.source.directory(), path) else {
        return Err(Error::new(ErrorKind::NotFound, "Can't find repository"));
    };

    match app.repo_pool.get(&reporef) {
        Some(result) => Ok(json(ReposResponse::Item(Repo::from((
            result.key(),
            result.value(),
        ))))),
        None => Err(Error::new(ErrorKind::NotFound, "Can't find repository")),
    }
}

/// Delete a repository from the disk and any indexes
//
#[utoipa::path(delete, path = "/repos/indexed/:ref",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn delete_by_id(
    Path(path): Path<Vec<String>>,
    Extension(app): Extension<Application>,
) -> impl IntoResponse {
    let Ok(reporef) = RepoRef::from_components(&app.config.source.directory(), path) else {
        return Err(Error::new(ErrorKind::NotFound, "Can't find repository"));
    };

    let deleted = match app.repo_pool.get_mut(&reporef) {
        Some(mut result) => {
            result.value_mut().mark_removed();
            app.write_index().queue_sync_and_index(vec![reporef]);
            Ok(())
        }
        None => Err(Error::new(ErrorKind::NotFound, "Repo not found")),
    };

    Ok(deleted.map(|_| json(ReposResponse::Deleted)))
}

/// Synchronize a repo by its id
#[utoipa::path(get, path = "/repos/sync/:ref",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn sync(
    Path(path): Path<Vec<String>>,
    Extension(app): Extension<Application>,
) -> impl IntoResponse {
    let Ok(reporef) = RepoRef::from_components(&app.config.source.directory(), path) else {
        return Err(Error::new(ErrorKind::NotFound, "Can't find repository"));
    };

    app.write_index().queue_sync_and_index(vec![reporef]);
    Ok(json(ReposResponse::SyncQueued))
}

/// List all repositories that are either indexed, or available for indexing
//
#[utoipa::path(get, path = "/repos",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn available(Extension(app): Extension<Application>) -> impl IntoResponse {
    let unknown_github = app
        .credentials
        .get(&Backend::Github)
        .map(|r| {
            let BackendCredential::Github(gh) = r.value();
            gh.repositories.clone()
        })
        .unwrap_or_default()
        .into_iter()
        .map(|repo| {
            let local_duplicates = app
                .repo_pool
                .iter()
                .filter(|elem| {
                    // either `ssh_url` or `clone_url` should match what we generate.
                    //
                    // also note that this is quite possibly not the
                    // most efficient way of doing this, but the
                    // number of repos should be small, so even n^2
                    // should be fast.
                    //
                    // most of the time is spent in the network.
                    [
                        repo.ssh_url.as_deref().unwrap_or_default().to_lowercase(),
                        repo.clone_url
                            .as_ref()
                            .map(|url| url.as_str())
                            .unwrap_or_default()
                            .to_lowercase(),
                    ]
                    .contains(&elem.remote.to_string().to_lowercase())
                })
                .map(|elem| elem.key().clone())
                .collect();

            Repo::from_github(local_duplicates, repo)
        });

    (
        StatusCode::OK,
        Json(ReposResponse::List(
            app.repo_pool
                .iter()
                .map(|elem| Repo::from((elem.key(), elem.value())))
                .chain(unknown_github)
                .collect(),
        )),
    )
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub(super) struct SetIndexed {
    indexed: Vec<RepoRef>,
}

/// Update the list of repositories that are currently being indexed.
/// This will automatically trigger a sync of currently un-indexed repositories.
//
#[utoipa::path(put, path = "/repos", request_body = SetIndexed,
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn set_indexed(
    Extension(app): Extension<Application>,
    Json(new_list): Json<SetIndexed>,
) -> impl IntoResponse {
    let mut repo_list = new_list.indexed.into_iter().collect::<HashSet<_>>();

    for mut existing in app.repo_pool.iter_mut() {
        if !repo_list.contains(existing.key()) {
            existing.value_mut().mark_removed();
            repo_list.insert(existing.key().to_owned());
        }
    }

    app.write_index()
        .queue_sync_and_index(repo_list.into_iter().collect());

    json(ReposResponse::SyncQueued)
}

#[derive(Deserialize, IntoParams)]
pub(super) struct ScanRequest {
    /// The path to scan
    path: String,
}

/// Gather recognized repository types from the filesystem
///
#[utoipa::path(get, path = "/repos/scan",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn scan_local(
    Query(scan_request): Query<ScanRequest>,
    Extension(app): Extension<Application>,
) -> impl IntoResponse {
    let root = std::path::Path::new(&scan_request.path);

    if app.allow_path(root) {
        Ok(json(ReposResponse::List(
            crate::remotes::gather_repo_roots(&root, app.config.source.repo_dir())
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
