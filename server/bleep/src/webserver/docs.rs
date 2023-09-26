use axum::extract::{Json, Path, Query, State};

use crate::{
    indexes::doc,
    webserver::{Error, Result},
    Application,
};

// schema
#[derive(serde::Deserialize)]
pub struct Sync {
    url: url::Url,
}

#[derive(serde::Deserialize)]
pub struct Search {
    pub q: String,
    pub limit: u64,
}

#[derive(serde::Deserialize)]
pub struct Fetch {
    pub relative_url: String,
}

#[derive(serde::Deserialize)]
pub struct Verify {
    url: url::Url,
}

// handlers
pub async fn list(State(app): State<Application>) -> Result<Json<Vec<doc::Record>>> {
    Ok(Json(app.indexes.doc.list().await?))
}

pub async fn list_one(
    State(app): State<Application>,
    Path(id): Path<i64>,
) -> Result<Json<doc::Record>> {
    Ok(Json(app.indexes.doc.list_one(id).await?))
}

pub async fn delete(State(app): State<Application>, Path(id): Path<i64>) -> Result<Json<i64>> {
    Ok(Json(app.indexes.doc.delete(id).await?))
}

pub async fn resync(State(app): State<Application>, Path(id): Path<i64>) -> Result<Json<i64>> {
    Ok(Json(app.indexes.doc.resync(id).await?))
}

pub async fn search(
    State(app): State<Application>,
    Query(params): Query<Search>,
) -> Result<Json<Vec<doc::Record>>> {
    Ok(Json(app.indexes.doc.search(params.q, params.limit).await?))
}

pub async fn search_with_id(
    State(app): State<Application>,
    Path(id): Path<i64>,
    Query(params): Query<Search>,
) -> Result<Json<Vec<doc::SearchResult>>> {
    Ok(Json(
        app.indexes
            .doc
            .search_with_id(params.q, params.limit, id)
            .await?,
    ))
}

pub async fn fetch(
    State(app): State<Application>,
    Path(id): Path<i64>,
    Query(params): Query<Fetch>,
) -> Result<Json<Vec<doc::SearchResult>>> {
    Ok(Json(app.indexes.doc.fetch(id, params.relative_url).await?))
}

pub async fn sync(State(app): State<Application>, Query(params): Query<Sync>) -> Result<Json<i64>> {
    Ok(Json(app.indexes.doc.sync(params.url).await?))
}

pub async fn verify(Query(params): Query<Verify>) -> Result<reqwest::StatusCode> {
    reqwest::get(params.url)
        .await
        .map(|r| r.status())
        .map_err(|e| Error::user(e))
}

impl From<doc::Error> for Error {
    fn from(value: doc::Error) -> Self {
        match value {
            doc::Error::Sql(_)
            | doc::Error::Embed(_)
            | doc::Error::Qdrant(_)
            | doc::Error::UrlParse(..)
            | doc::Error::Initialize(_) => Self::internal(value),
            doc::Error::InvalidUrl(..) => Self::user(value),
            doc::Error::InvalidDocId(_) => Self::not_found(value),
        }
    }
}
