use axum::extract::State;

use super::{middleware::User, prelude::*};
use crate::Application;

#[derive(Serialize, Debug)]
pub(super) struct ConfigResponse {
    analytics_data_plane: Option<String>,
    analytics_key_fe: Option<String>,
    sentry_dsn_fe: Option<String>,
    tracking_id: Option<String>,
}

impl super::ApiResponse for ConfigResponse {}

pub(super) async fn handle(
    State(app): State<Application>,
    Extension(User(user)): Extension<User>,
) -> impl IntoResponse {
    let tracking_id = match user {
        Some(username) => {
            let id = app
                .user_store
                .entry(username)
                .or_default()
                .get()
                .tracking_id();
            _ = app.user_store.store();
            Some(id)
        }
        None => Some(app.tracking_seed.to_string()),
    };

    json(ConfigResponse {
        analytics_data_plane: app.config.analytics_data_plane.clone(),
        analytics_key_fe: app.config.analytics_key_fe.clone(),
        sentry_dsn_fe: app.config.sentry_dsn_fe.clone(),
        tracking_id,
    })
}
