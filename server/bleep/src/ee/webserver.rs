use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;

use crate::{
    repo::BranchFilter,
    webserver::{
        prelude::*,
        repos::{RepoParams, ReposResponse},
    },
    Application,
};

#[derive(Deserialize)]
pub(crate) struct RepositoryPatch {
    branch_filter: BranchFilter,
}

/// Patch a repository with the given payload
/// This will automatically trigger a sync
//
pub(crate) async fn patch_with_branch(
    Query(RepoParams { repo }): Query<RepoParams>,
    State(app): State<Application>,
    Json(patch): Json<RepositoryPatch>,
) -> impl IntoResponse {
    let _parsed = crate::repo::iterator::BranchFilter::from(&patch.branch_filter);

    app.write_index()
        .add_branches_for_repo(repo, patch.branch_filter)
        .await;

    json(ReposResponse::SyncQueued)
}
