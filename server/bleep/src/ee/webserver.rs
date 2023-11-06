use axum::{
    extract::{Query, State},
    Json,
};

use crate::{
    background::SyncConfig,
    repo::FilterUpdate,
    webserver::{
        middleware::User,
        prelude::*,
        repos::{RepoParams, ReposResponse},
    },
    Application,
};

/// Patch a repository with the given payload
/// This will automatically trigger a sync
//
pub(crate) async fn patch_repository(
    Query(RepoParams { repo, shallow }): Query<RepoParams>,
    user: Extension<User>,
    State(app): State<Application>,
    Json(mut patch): Json<FilterUpdate>,
) -> impl IntoResponse {
    if let Some(ref file_filter) = patch.file_filter {
        _ = crate::repo::iterator::FileFilter::from(file_filter);
    }

    if let Some(ref branch_filter) = patch.branch_filter {
        _ = crate::repo::iterator::BranchFilter::from(branch_filter);
    }

    if !user.paid_features(&app).await {
        patch.branch_filter = None;
    }

    if patch.file_filter.is_some() || patch.branch_filter.is_some() {
        app.write_index()
            .enqueue(
                SyncConfig::new(app, repo)
                    .shallow(shallow)
                    .filter_updates(patch.into()),
            )
            .await;
        json(ReposResponse::SyncQueued)
    } else {
        json(ReposResponse::Unchanged)
    }
}
