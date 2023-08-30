use axum::{
    extract::{Query, State},
    Json,
};

use crate::{
    repo::FilterUpdate,
    webserver::{
        prelude::*,
        repos::{RepoParams, ReposResponse},
    },
    Application,
};

/// Patch a repository with the given payload
/// This will automatically trigger a sync
//
pub(crate) async fn patch_with_branch(
    Query(RepoParams { repo }): Query<RepoParams>,
    State(app): State<Application>,
    Json(patch): Json<FilterUpdate>,
) -> impl IntoResponse {
    if let Some(ref file_filter) = patch.file_filter {
        _ = crate::repo::iterator::FileFilter::from(file_filter);
    }

    if let Some(ref branch_filter) = patch.branch_filter {
        _ = crate::repo::iterator::BranchFilter::from(branch_filter);
    }

    if patch.file_filter.is_some() || patch.branch_filter.is_some() {
        app.write_index().add_branches_for_repo(repo, patch).await;
        json(ReposResponse::SyncQueued)
    } else {
        json(ReposResponse::Unchanged)
    }
}
