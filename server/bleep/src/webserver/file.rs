use std::sync::Arc;

use axum::{
    extract::{Path, Query},
    response::{IntoResponse, Result},
    Extension,
};
use reqwest::StatusCode;

use super::{json, prelude::Indexes, EndpointError, ErrorKind};

#[derive(Debug, serde::Deserialize)]
pub struct Params {
    pub rev: Option<String>,
}

#[derive(serde::Serialize)]
pub struct FileResponse {
    contents: String,
}

pub async fn handle(
    Path(path): Path<String>,
    Query(params): Query<Params>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> impl IntoResponse {
    // Strip leading slash, always present.
    let file_disk_path = &path[1..];

    match fetch(&indexes, file_disk_path, &params).await {
        Ok(r) => (StatusCode::OK, json(r)),
        Err(e) if e.kind == ErrorKind::User => (StatusCode::BAD_REQUEST, json(e)),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, json(e)),
    }
}

async fn fetch(
    indexes: &Indexes,
    file_disk_path: &str,
    params: &Params,
) -> Result<FileResponse, EndpointError<'static>> {
    if params.rev.is_some() {
        return Err(EndpointError {
            kind: ErrorKind::Internal,
            message: "the `rev` parameter is not yet supported".into(),
        });
    }

    let contents = indexes
        .file
        .file_body(file_disk_path)
        .await
        .map_err(|e| EndpointError {
            kind: ErrorKind::Internal,
            message: e.to_string().into(),
        })?;

    Ok(FileResponse { contents })
}
