use crate::Application;

use axum::{response::IntoResponse, Extension};

pub(super) async fn handle(Extension(app): Extension<Application>) -> impl IntoResponse {
    tokio::task::spawn(app.write_index().startup_scan());
}
