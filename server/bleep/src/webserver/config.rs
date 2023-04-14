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
    schema_version: String,
    tracking_id: String,
    device_id: String,
}

impl super::ApiResponse for ConfigResponse {}

pub(super) async fn handle(
    State(app): State<Application>,
    Extension(user): Extension<User>,
) -> impl IntoResponse {
    let tracking_id = app
        .analytics
        .as_ref()
        .map(|a| a.tracking_id(&user))
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

    json(ConfigResponse {
        analytics_data_plane: app.config.analytics_data_plane.clone(),
        analytics_key_fe: app.config.analytics_key_fe.clone(),
        sentry_dsn_fe: app.config.sentry_dsn_fe.clone(),
        user_login: user.0,
        schema_version: crate::state::SCHEMA_VERSION.into(),
        device_id,
        org_name,
        tracking_id,
    })
}
