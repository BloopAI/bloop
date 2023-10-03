use async_stream::try_stream;
use axum::{
    extract::{Json, Path, Query, State},
    response::{sse::Event, Sse},
};
use futures::stream::{Stream, StreamExt};

use crate::{
    indexes::doc,
    webserver::{Error, Result},
    Application,
};

use std::{convert::Infallible, pin::Pin};

// schema
#[derive(serde::Deserialize)]
pub struct Sync {
    url: url::Url,
}

#[derive(serde::Deserialize)]
pub struct Search {
    pub q: Option<String>,
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

pub async fn sync(
    State(app): State<Application>,
    Query(params): Query<Sync>,
) -> Sse<Pin<Box<dyn Stream<Item = Result<Event, Infallible>> + Send>>> {
    let s = try_stream! {
        let mut sync = Box::pin(app.indexes.doc.sync(params.url));
        while let Some(result) = sync.next().await {
            yield Event::default()
                .json_data(result.as_ref().map_err(ToString::to_string))
                .unwrap();
        }
    };
    Sse::new(Box::pin(s))
}

pub async fn resync(
    State(app): State<Application>,
    Path(id): Path<i64>,
) -> Sse<Pin<Box<dyn Stream<Item = Result<Event, Infallible>> + Send>>> {
    let s = try_stream! {
        let mut sync = Box::pin(app.indexes.doc.resync(id));
        while let Some(result) = sync.next().await {
            yield Event::default()
                .json_data(result.as_ref().map_err(ToString::to_string))
                .unwrap();
            }
    };
    Sse::new(Box::pin(s))
}

pub async fn search(
    State(app): State<Application>,
    Query(params): Query<Search>,
) -> Result<Json<Vec<doc::Record>>> {
    Ok(Json(match params.q {
        Some(q) => app.indexes.doc.search(q, params.limit).await?,
        None => app.indexes.doc.list().await?,
    }))
}

pub async fn search_with_id(
    State(app): State<Application>,
    Path(id): Path<i64>,
    Query(params): Query<Search>,
) -> Result<Json<Vec<doc::SearchResult>>> {
    Ok(Json(match params.q {
        Some(query) => {
            app.indexes
                .doc
                .search_with_id(query, params.limit, id)
                .await?
        }
        None => {
            app.indexes
                .doc
                .list_with_id(params.limit as u32, id)
                .await?
        }
    }))
}

pub async fn fetch(
    State(app): State<Application>,
    Path(id): Path<i64>,
    Query(params): Query<Fetch>,
) -> Result<Json<Vec<doc::SearchResult>>> {
    Ok(Json(app.indexes.doc.fetch(id, params.relative_url).await?))
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
