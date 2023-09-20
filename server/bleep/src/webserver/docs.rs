use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
};

use super::prelude::*;
use crate::{indexes::doc, Application};

#[derive(serde::Serialize)]
pub struct ListResponse(Vec<doc::DocRecord>);
impl super::ApiResponse for ListResponse {}
pub async fn list(State(app): State<Application>) -> Result<impl IntoResponse> {
    app.indexes
        .doc
        .list()
        .await
        .map(ListResponse)
        .map(json)
        .map_err(Error::internal)
}

#[derive(serde::Serialize)]
pub struct ListOneResponse(doc::DocRecord);
impl super::ApiResponse for ListOneResponse {}
pub async fn list_one(
    State(app): State<Application>,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse> {
    app.indexes
        .doc
        .list_one(id)
        .await
        .map(ListOneResponse)
        .map(json)
        .map_err(Error::internal)
}

#[derive(serde::Serialize)]
pub struct DeleteResponse(i64);
impl super::ApiResponse for DeleteResponse {}
pub async fn delete(
    State(app): State<Application>,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse> {
    app.indexes
        .doc
        .delete(id)
        .await
        .map(DeleteResponse)
        .map(json)
        .map_err(Error::internal)
}

#[derive(serde::Serialize)]
struct ResyncResponse(i64);
impl super::ApiResponse for ResyncResponse {}
pub async fn resync(
    State(app): State<Application>,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse> {
    app.indexes
        .doc
        .resync(id)
        .await
        .map(ResyncResponse)
        .map(json)
        .map_err(Error::internal)
}

#[derive(serde::Deserialize)]
pub struct Search {
    /// Search terms
    pub q: String,
    /// Number of points to limit to
    pub limit: u64,
}
#[derive(serde::Serialize)]
struct SearchResponse(Vec<doc::SearchResult>);
impl super::ApiResponse for SearchResponse {}
pub async fn search(
    State(app): State<Application>,
    Path(id): Path<i64>,
    Query(Search { q, limit }): Query<Search>,
) -> Result<impl IntoResponse> {
    app.indexes
        .doc
        .search(q, limit, id)
        .await
        .map(SearchResponse)
        .map(json)
        .map_err(Error::internal)
}

#[derive(serde::Deserialize)]
pub struct Fetch {
    /// Search terms
    pub relative_url: String,
}
#[derive(serde::Serialize)]
struct FetchResponse(Vec<doc::SearchResult>);
impl super::ApiResponse for FetchResponse {}
pub async fn fetch(
    State(app): State<Application>,
    Path(id): Path<i64>,
    Query(Fetch { relative_url }): Query<Fetch>,
) -> Result<impl IntoResponse> {
    app.indexes
        .doc
        .fetch(id, relative_url)
        .await
        .map(SearchResponse)
        .map(json)
        .map_err(Error::internal)
}

#[derive(serde::Deserialize)]
pub struct SyncRequest {
    url: url::Url,
}
#[derive(serde::Serialize)]
pub struct SyncResponse(i64);
impl super::ApiResponse for SyncResponse {}
pub async fn sync(
    State(app): State<Application>,
    Query(SyncRequest { url }): Query<SyncRequest>,
) -> Result<impl IntoResponse> {
    app.indexes
        .doc
        .sync(url)
        .await
        .map(SyncResponse)
        .map(json)
        .map_err(Error::internal)
}
