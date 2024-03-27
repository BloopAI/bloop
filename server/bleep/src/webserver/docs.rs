use axum::{
    extract::{Json, Path, Query, State},
    response::{
        sse::{Event, KeepAlive},
        Sse,
    },
};
use futures::stream::{Stream, StreamExt};
use tracing::error;

use crate::{
    indexes::doc,
    webserver::{Error, Result},
    Application,
};

use std::convert::Infallible;

// schema
#[derive(serde::Deserialize)]
pub struct Enqueue {
    url: url::Url,
}

#[derive(serde::Deserialize)]
pub struct List {
    limit: usize,
}

#[derive(serde::Deserialize)]
pub struct Search {
    pub q: Option<String>,
    pub limit: usize,
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
pub async fn list(State(app): State<Application>) -> Result<Json<Vec<doc::SqlRecord>>> {
    Ok(Json(app.indexes.doc.list().await?))
}

pub async fn list_one(
    State(app): State<Application>,
    Path(id): Path<i64>,
) -> Result<Json<doc::SqlRecord>> {
    Ok(Json(app.indexes.doc.list_one(id).await?))
}

pub async fn delete(State(app): State<Application>, Path(id): Path<i64>) -> Result<Json<i64>> {
    Ok(Json(app.indexes.doc.delete(id).await?))
}

pub async fn enqueue(
    State(app): State<Application>,
    Query(params): Query<Enqueue>,
) -> Result<Json<i64>> {
    Ok(Json(app.indexes.doc.clone().enqueue(params.url).await?))
}

pub async fn status(
    State(app): State<Application>,
    Path(id): Path<i64>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    Sse::new(Box::pin(app.indexes.doc.clone().status(id).await.map(
        |result| {
            Ok(Event::default()
                .json_data(result.as_ref().map_err(ToString::to_string))
                .unwrap())
        },
    )))
    .keep_alive(KeepAlive::default())
}

pub async fn cancel(State(app): State<Application>, Path(id): Path<i64>) -> Result<Json<i64>> {
    Ok(Json(app.indexes.doc.clone().cancel(id).await?))
}

pub async fn resync(State(app): State<Application>, Path(id): Path<i64>) -> Result<Json<i64>> {
    Ok(Json(app.indexes.doc.clone().resync(id).await?))
}

pub async fn search(
    State(app): State<Application>,
    Query(params): Query<Search>,
) -> Result<Json<Vec<doc::SqlRecord>>> {
    Ok(Json(match params.q {
        Some(q) => app.indexes.doc.search(q, params.limit).await?,
        None => app.indexes.doc.list().await?,
    }))
}

pub async fn search_with_id(
    State(app): State<Application>,
    Path(id): Path<i64>,
    Query(params): Query<Search>,
) -> Result<Json<Vec<doc::Section>>> {
    Ok(Json(match params.q {
        Some(query) => {
            app.indexes
                .doc
                .search_sections(query, params.limit, id)
                .await?
        }
        None => app.indexes.doc.list_sections(params.limit, id).await?,
    }))
}

pub async fn list_with_id(
    State(app): State<Application>,
    Path(id): Path<i64>,
    Query(params): Query<List>,
) -> Result<Json<Vec<doc::Page>>> {
    Ok(Json(app.indexes.doc.list_pages(params.limit, id).await?))
}

pub async fn fetch(
    State(app): State<Application>,
    Path(id): Path<i64>,
    Query(params): Query<Fetch>,
) -> Result<Json<Vec<doc::Section>>> {
    Ok(Json(app.indexes.doc.fetch(id, params.relative_url).await?))
}

pub async fn verify(
    State(app): State<Application>,
    Query(params): Query<Verify>,
) -> Result<reqwest::StatusCode> {
    Ok(app.indexes.doc.verify(params.url).await?)
}

impl From<doc::Error> for Error {
    fn from(value: doc::Error) -> Self {
        match value {
            doc::Error::Sql(_)
            | doc::Error::UrlParse(..)
            | doc::Error::Io(..)
            | doc::Error::Tantivy(..)
            | doc::Error::Network(..)
            | doc::Error::Initialize(_) => {
                error!(%value, "internal docs error");
                Self::internal(value)
            } // TODO: log these to sentry
            doc::Error::InvalidUrl(..)
            | doc::Error::DuplicateUrl(..)
            | doc::Error::EmptyDocs(..) => Self::user(value),
            doc::Error::InvalidDocId(_) => Self::not_found(value),
        }
    }
}
