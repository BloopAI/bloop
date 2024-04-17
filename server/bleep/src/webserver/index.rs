use crate::Application;

use axum::{response::IntoResponse, Extension};

pub(super) async fn handle(Extension(app): Extension<Application>) -> impl IntoResponse {
    tokio::task::spawn(async move { app.write_index().startup_scan().await });
}
