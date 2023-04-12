use axum::extract::State;

use super::{middleware::User, prelude::*};
use crate::{remotes, Application};

#[derive(Serialize, Debug)]
pub(super) struct ConfigResponse {
    analytics_data_plane: Option<String>,
    analytics_key_fe: Option<String>,
    sentry_dsn_fe: Option<String>,
    user_login: Option<String>,
    org_name: Option<String>,
    tracking_id: String,
    device_id: String,
}

impl super::ApiResponse for ConfigResponse {}

pub(super) async fn handle(
    State(app): State<Application>,
    Extension(User(user)): Extension<User>,
) -> impl IntoResponse {
    let tracking_id = match user {
        Some(ref username) => {
            let id = app
                .user_store
                .entry(username.clone())
                .or_default()
                .get()
                .tracking_id();
            _ = app.user_store.store();
            id
        }
        None => app.tracking_seed.to_string(),
    };

    let org_name = {
        let cred = app.credentials.github().unwrap();
        match cred.auth {
            remotes::github::Auth::App { org, .. } => Some(org),
            _ => None,
        }
    };

    json(ConfigResponse {
        analytics_data_plane: app.config.analytics_data_plane.clone(),
        analytics_key_fe: app.config.analytics_key_fe.clone(),
        sentry_dsn_fe: app.config.sentry_dsn_fe.clone(),
        device_id: app.tracking_seed.to_string(),
        user_login: user,
        org_name,
        tracking_id,
    })
}
