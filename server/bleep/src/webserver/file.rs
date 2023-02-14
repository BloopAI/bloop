use std::sync::Arc;

use axum::{
    extract::{Path, Query},
    response::IntoResponse,
    Extension,
};

use super::{json, prelude::Indexes, Error};

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

    if params.rev.is_some() {
        return Err(Error::internal("the `rev` parameter is not yet supported"));
    }

    let contents = indexes
        .file
        .file_body(file_disk_path)
        .await
        .map_err(Error::internal)?;

    Ok(json(FileResponse { contents }))
}
