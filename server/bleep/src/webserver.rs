use crate::{env::Feature, Application};

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Extension, Json,
};
use std::{borrow::Cow, fmt, net::SocketAddr};
use tower::Service;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::{catch_panic::CatchPanicLayer, cors::CorsLayer};
use tracing::info;

pub mod answer;
mod autocomplete;
mod commits;
mod config;
pub mod conversation;
mod docs;
mod file;
pub mod hoverable;
mod index;
pub mod intelligence;
pub mod middleware;
mod project;
mod query;
pub mod repos;
mod search;
mod studio;
mod template;

pub type Router<S = Application> = axum::Router<S>;

#[allow(unused)]
pub(crate) mod prelude {
    pub(crate) use super::{json, EndpointError, Error, ErrorKind, Result, Router};
    pub(crate) use crate::indexes::Indexes;
    pub(crate) use axum::{extract::Query, http::StatusCode, response::IntoResponse, Extension};
    pub(crate) use serde::{Deserialize, Serialize};
    pub(crate) use std::sync::Arc;
}

pub async fn start(app: Application) -> anyhow::Result<()> {
    let bind = SocketAddr::new(app.config.host.parse()?, app.config.port);

    let mut api = Router::new()
        .route("/config", get(config::get).put(config::put))
        // indexing
        .route("/index", get(index::handle))
        // repo management
        .nest("/repos", repos::router())
        // docs management
        .nest(
            "/docs",
            Router::new()
                .route("/", get(docs::list)) // list all doc providers
                .route("/search", get(docs::search)) // text search over doc providers
                .route("/enqueue", get(docs::enqueue)) // enqueue a new url to begin syncing
                .route("/verify", get(docs::verify)) // verify if a doc url is valid
                .route("/:id", get(docs::list_one)) // list a doc provider by id
                .route("/:id", delete(docs::delete)) // delete a doc provider by id
                .route("/:id/resync", get(docs::resync)) // resync a doc provider by id
                .route("/:id/status", get(docs::status)) // query sync status of an existing doc source
                .route("/:id/cancel", get(docs::cancel)) // cancel an index job
                .route("/:id/search", get(docs::search_with_id)) // search/list sections of a doc provider
                .route("/:id/list", get(docs::list_with_id)) // list pages of a doc provider
                .route("/:id/fetch", get(docs::fetch)), // fetch all sections of a page of a doc provider
        )
        // intelligence
        .route("/tutorial-questions", get(commits::tutorial_questions))
        .route("/hoverable", get(hoverable::handle))
        .route("/token-info", get(intelligence::handle))
        .route("/related-files", get(intelligence::related_files))
        .route(
            "/related-files-with-ranges",
            get(intelligence::related_file_with_ranges),
        )
        .route("/token-value", get(intelligence::token_value))
        // misc
        .route("/search/code", get(search::semantic_code))
        .route("/file", get(file::handle))
        .route("/folder", get(file::folder))
        .route("/projects", get(project::list).post(project::create))
        .route(
            "/projects/:project_id",
            get(project::get)
                .put(project::update)
                .delete(project::delete),
        )
        .route(
            "/projects/:project_id/repos",
            get(project::repo::list).post(project::repo::add),
        )
        .route(
            "/projects/:project_id/repos/",
            delete(project::repo::delete).put(project::repo::put),
        )
        .route(
            "/projects/:project_id/docs",
            get(project::doc::list).post(project::doc::add),
        )
        .route(
            "/projects/:project_id/docs/:doc_id",
            delete(project::doc::delete),
        )
        .route(
            "/projects/:project_id/conversations",
            get(conversation::list),
        )
        .route(
            "/projects/:project_id/conversations/:conversation_id",
            get(conversation::get).delete(conversation::delete),
        )
        .route("/projects/:project_id/q", get(query::handle))
        .route(
            "/projects/:project_id/autocomplete",
            get(autocomplete::handle),
        )
        .route("/projects/:project_id/search/path", get(search::fuzzy_path))
        .route("/projects/:project_id/answer", get(answer::answer))
        .route("/projects/:project_id/answer/explain", get(answer::explain))
        .route("/projects/:project_id/studios", post(studio::create))
        .route("/projects/:project_id/studios", get(studio::list))
        .route(
            "/projects/:project_id/studios/:studio_id",
            get(studio::get).patch(studio::patch).delete(studio::delete),
        )
        .route("/projects/:project_id/studios/import", post(studio::import))
        .route(
            "/projects/:project_id/studios/:studio_id/generate",
            get(studio::generate),
        )
        .route(
            "/projects/:project_id/studios/:studio_id/diff",
            get(studio::diff),
        )
        .route(
            "/projects/:project_id/studios/:studio_id/diff/apply",
            post(studio::diff_apply),
        )
        .route(
            "/projects/:project_id/studios/:studio_id/snapshots",
            get(studio::list_snapshots),
        )
        .route(
            "/projects/:project_id/studios/:studio_id/snapshots/:snapshot_id",
            delete(studio::delete_snapshot),
        )
        .route(
            "/projects/:project_id/studios/file-token-count",
            post(studio::get_file_token_count),
        )
        .route(
            "/projects/:project_id/studios/doc-file-token-count",
            post(studio::get_doc_file_token_count),
        )
        .route("/template", post(template::create))
        .route("/template", get(template::list))
        .route(
            "/template/:id",
            get(template::get)
                .patch(template::patch)
                .delete(template::delete),
        );

    if app.env.allow(Feature::AnyPathScan) {
        api = api.route("/repos/scan", get(repos::scan_local));
    }

    api = api.route("/panic", get(|| async { panic!("dead") }));

    api = middleware::local_user(api, app.clone());
    api = api.route("/health", get(health));

    let api = api
        .layer(Extension(app.indexes.clone()))
        .layer(Extension(app.semantic.clone()))
        .layer(Extension(app.clone()))
        .with_state(app.clone())
        .layer(CorsLayer::permissive())
        .layer(CatchPanicLayer::new());

    let mut router = Router::new().nest("/api", api);

    if let Some(frontend_dist) = app.config.frontend_dist.clone() {
        router = router.nest_service(
            "/",
            tower::service_fn(move |req| {
                let frontend_dist = frontend_dist.clone();
                async move {
                    Ok(ServeDir::new(&frontend_dist)
                        .fallback(ServeFile::new(frontend_dist.join("index.html")))
                        .call(req)
                        .await
                        .unwrap())
                }
            }),
        );
    }

    info!(%bind, "starting webserver");
    axum::Server::bind(&bind)
        .serve(router.into_make_service())
        .await?;

    Ok(())
}

pub(crate) fn json<'a, T>(val: T) -> Json<Response<'a>>
where
    Response<'a>: From<T>,
{
    Json(Response::from(val))
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

#[derive(Debug)]
pub struct Error {
    status: StatusCode,
    body: EndpointError<'static>,
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.body.message)
    }
}

impl Error {
    fn new(kind: ErrorKind, message: impl Into<Cow<'static, str>>) -> Error {
        let status = match kind {
            ErrorKind::Configuration
            | ErrorKind::Unknown
            | ErrorKind::UpstreamService
            | ErrorKind::Internal
            | ErrorKind::Custom => StatusCode::INTERNAL_SERVER_ERROR,
            ErrorKind::User => StatusCode::BAD_REQUEST,
            ErrorKind::NotFound => StatusCode::NOT_FOUND,
        };

        let body = EndpointError {
            kind,
            message: message.into(),
        };

        Error { status, body }
    }

    fn with_status(mut self, status_code: StatusCode) -> Self {
        self.status = status_code;
        self
    }

    fn internal<S: std::fmt::Display>(message: S) -> Self {
        Error {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            body: EndpointError {
                kind: ErrorKind::Internal,
                message: message.to_string().into(),
            },
        }
    }

    fn user<S: std::fmt::Display>(message: S) -> Self {
        Error {
            status: StatusCode::BAD_REQUEST,
            body: EndpointError {
                kind: ErrorKind::User,
                message: message.to_string().into(),
            },
        }
    }

    fn not_found<S: std::fmt::Display>(message: S) -> Self {
        Error {
            status: StatusCode::NOT_FOUND,
            body: EndpointError {
                kind: ErrorKind::NotFound,
                message: message.to_string().into(),
            },
        }
    }
}

impl From<anyhow::Error> for Error {
    fn from(value: anyhow::Error) -> Self {
        Error::internal(value)
    }
}

impl From<sqlx::Error> for Error {
    fn from(value: sqlx::Error) -> Self {
        Error::internal(value)
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> axum::response::Response {
        (self.status, Json(Response::from(self.body))).into_response()
    }
}

/// The response upon encountering an error
#[derive(serde::Serialize, PartialEq, Eq, Debug)]
pub struct EndpointError<'a> {
    /// The kind of this error
    kind: ErrorKind,

    /// A context aware message describing the error
    message: Cow<'a, str>,
}

/// The kind of an error
#[allow(unused)]
#[derive(serde::Serialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
#[non_exhaustive]
pub enum ErrorKind {
    User,
    Unknown,
    NotFound,
    Configuration,
    UpstreamService,
    Internal,

    // TODO: allow construction of detailed custom kinds
    #[doc(hidden)]
    Custom,
}

pub(crate) trait ApiResponse: erased_serde::Serialize {}
erased_serde::serialize_trait_object!(ApiResponse);

/// Every endpoint exposes a Response type
#[derive(serde::Serialize)]
#[serde(untagged)]
#[non_exhaustive]
pub(crate) enum Response<'a> {
    Ok(Box<dyn erased_serde::Serialize + Send + Sync + 'static>),
    Error(EndpointError<'a>),
}

impl<T: ApiResponse + Send + Sync + 'static> From<T> for Response<'static> {
    fn from(value: T) -> Self {
        Self::Ok(Box::new(value))
    }
}

impl<'a> From<EndpointError<'a>> for Response<'a> {
    fn from(value: EndpointError<'a>) -> Self {
        Self::Error(value)
    }
}

async fn health(State(app): State<Application>) {
    // panic is fine here, we don't need exact reporting of
    // subsystem checks at this stage
    app.semantic.health_check().await.unwrap()
}

fn no_user_id() -> Error {
    Error::user("didn't have user ID")
}
