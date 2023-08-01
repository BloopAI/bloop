use axum::{extract::State, Json};

use super::{middleware::User, prelude::*};
use crate::{remotes, user::UserProfile, Application};

#[derive(Serialize, Debug)]
pub(super) struct ConfigResponse {
    analytics_data_plane: Option<String>,
    analytics_key_fe: Option<String>,
    sentry_dsn_fe: Option<String>,
    user_login: Option<String>,
    org_name: Option<String>,
    schema_version: String,
    tracking_id: String,
    device_id: String,
    github_user: Option<octocrab::models::Author>,
    bloop_user_profile: UserProfile,
    bloop_version: String,
    bloop_commit: String,
}

impl super::ApiResponse for ConfigResponse {}

pub(super) async fn get(
    State(app): State<Application>,
    Extension(user): Extension<User>,
) -> impl IntoResponse {
    let tracking_id = app
        .analytics
        .as_ref()
        .map(|a| a.tracking_id(user.login()))
        .unwrap_or_default();

    let device_id = app
        .analytics
        .as_ref()
        .map(|a| a.device_id())
        .unwrap_or_default();

    let org_name = app.credentials.github().and_then(|cred| match cred.auth {
        remotes::github::Auth::App { org, .. } => Some(org),
        _ => None,
    });

    let github_user = 'user: {
        let Some(crab) = user.github()
	else {
            break 'user None;
        };
        crab.current().user().await.ok()
    };

    let user_profile = user
        .login()
        .and_then(|login| app.user_profiles.read(login, |_, v| v.clone()))
        .unwrap_or_default();

    json(ConfigResponse {
        analytics_data_plane: app.config.analytics_data_plane.clone(),
        analytics_key_fe: app.config.analytics_key_fe.clone(),
        sentry_dsn_fe: app.config.sentry_dsn_fe.clone(),
        user_login: user.login().map(str::to_owned),
        schema_version: crate::state::SCHEMA_VERSION.into(),
        bloop_version: env!("CARGO_PKG_VERSION").into(),
        bloop_commit: git_version::git_version!(fallback = "unknown").into(),
        bloop_user_profile: user_profile,
        github_user,
        device_id,
        org_name,
        tracking_id,
    })
}

#[derive(Serialize, Deserialize)]
pub(super) struct ConfigUpdate {
    bloop_user_profile: UserProfile,
}

pub(super) async fn put(
    State(app): State<Application>,
    Extension(user): Extension<User>,
    Json(update): Json<ConfigUpdate>,
) -> impl IntoResponse {
    let user = user.login().expect("authentication required").to_owned();
    app.user_profiles
        .entry_async(user)
        .await
        .or_default()
        .insert(update.bloop_user_profile);
    app.user_profiles.store().expect("failed to persist");
}
