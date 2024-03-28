use axum::{extract::State, Json};

use super::{middleware::User, prelude::*};
use crate::{remotes, user::UserProfile, Application};

#[derive(Serialize, Debug)]
pub(super) struct ConfigResponse {
    user_login: Option<String>,
    org_name: Option<String>,
    schema_version: String,
    github_user: Option<octocrab::models::Author>,
    bloop_user_profile: UserProfile,
    bloop_version: String,
    bloop_commit: String,
    credentials_upgrade: bool,
}

impl super::ApiResponse for ConfigResponse {}

pub(super) async fn get(
    State(app): State<Application>,
    Extension(user): Extension<User>,
) -> impl IntoResponse {
    let user_profile = user
        .username()
        .and_then(|login| app.user_profiles.read(login, |_, v| v.clone()))
        .unwrap_or_default();

    let user_login = user.username().map(str::to_owned);

    let org_name = app.credentials.github().and_then(|cred| match cred.auth {
        remotes::github::Auth::App { org, .. } => Some(org),
        _ => None,
    });

    let github_user = 'user: {
        let (Some(login), Some(crab)) = (&user_login, user.github_client()) else {
            break 'user None;
        };

        crab.get(format!("/users/{login}"), None::<&()>).await.ok()
    };

    json(ConfigResponse {
        schema_version: crate::state::SCHEMA_VERSION.into(),
        bloop_version: env!("CARGO_PKG_VERSION").into(),
        bloop_commit: git_version::git_version!(fallback = "unknown").into(),
        bloop_user_profile: user_profile,
        credentials_upgrade: app.config.source.exists("credentials.json"),
        user_login,
        github_user,
        org_name,
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
    let user = user.username().expect("authentication required").to_owned();
    app.user_profiles
        .entry_async(user)
        .await
        .or_default()
        .insert(update.bloop_user_profile);
    app.user_profiles.store().expect("failed to persist");
}
