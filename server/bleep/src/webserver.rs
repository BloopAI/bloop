use crate::{env::Feature, snippet, state, Application};

use axum::middleware;
use axum::{response::IntoResponse, routing::get, Extension, Json};
use std::{borrow::Cow, net::SocketAddr};
use tower::Service;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::{catch_panic::CatchPanicLayer, cors::CorsLayer};
use tracing::info;
use utoipa::OpenApi;
use utoipa::ToSchema;

mod aaa;
pub mod answer;
mod autocomplete;
mod file;
mod github;
mod hoverable;
mod index;
mod intelligence;
mod query;
mod repos;
mod semantic;

pub type Router<S = Application> = axum::Router<S>;

#[allow(unused)]
pub(in crate::webserver) mod prelude {
    pub(in crate::webserver) use super::{error, json, EndpointError, ErrorKind};
    pub(in crate::webserver) use crate::indexes::Indexes;
    pub(in crate::webserver) use axum::{
        extract::Query, http::StatusCode, response::IntoResponse, Extension,
    };
    pub(in crate::webserver) use serde::{Deserialize, Serialize};
    pub(in crate::webserver) use std::sync::Arc;
    pub(in crate::webserver) use utoipa::{IntoParams, ToSchema};
}

pub async fn start(app: Application) -> anyhow::Result<()> {
    let bind = SocketAddr::new(app.config.host.parse()?, app.config.port);

    let mut api = Router::new()
        // querying
        .route("/q", get(query::handle))
        // autocomplete
        .route("/autocomplete", get(autocomplete::handle))
        // indexing
        .route("/index", get(index::handle))
        // repo management
        .route("/repos", get(repos::available))
        .route(
            "/repos/indexed",
            get(repos::indexed).put(repos::set_indexed),
        )
        .route(
            "/repos/indexed/*path",
            get(repos::get_by_id).delete(repos::delete_by_id),
        )
        .route("/repos/sync/*path", get(repos::sync))
        // intelligence
        .route("/hoverable", get(hoverable::handle))
        .route("/token-info", get(intelligence::handle))
        // misc
        .route("/file/*ref", get(file::handle))
        .route("/semantic/chunks", get(semantic::raw_chunks))
        .route("/answer", get(answer::handle));

    if app.env.allow(Feature::GithubDeviceFlow) {
        api = api
            .route("/remotes/github/login", get(github::login))
            .route("/remotes/github/logout", get(github::logout))
            .route("/remotes/github/status", get(github::status));
    }

    if app.env.allow(Feature::AnyPathScan) {
        api = api.route("/repos/scan", get(repos::scan_local));
    }

    // Note: all routes above this point must be authenticated.
    if app.env.allow(Feature::AuthorizationRequired) {
        api = aaa::router(api, app.clone());
    }

    api = api
        .route("/api-doc/openapi.json", get(openapi_json::handle))
        .route("/api-doc/openapi.yaml", get(openapi_yaml::handle))
        .route("/health", get(health));

    let api: Router<()> = api
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

pub(in crate::webserver) fn json<'a, T>(val: T) -> Json<Response<'a>>
where
    Response<'a>: From<T>,
{
    Json(Response::from(val))
}

pub(in crate::webserver) type Result<T, E = Error> = std::result::Result<T, E>;
pub(in crate::webserver) type Error = Json<Response<'static>>;

pub(in crate::webserver) fn error(kind: ErrorKind, message: impl Into<Cow<'static, str>>) -> Error {
    Json(Response::from(EndpointError {
        kind,
        message: message.into(),
    }))
}

pub(in crate::webserver) fn internal_error<S: std::fmt::Display>(message: S) -> Error {
    Json(Response::from(EndpointError {
        kind: ErrorKind::Internal,
        message: message.to_string().into(),
    }))
}

/// The response upon encountering an error
#[derive(serde::Serialize, PartialEq, Eq, ToSchema, Debug)]
pub(in crate::webserver) struct EndpointError<'a> {
    /// The kind of this error
    pub kind: ErrorKind,

    /// A context aware message describing the error
    pub message: Cow<'a, str>,
}

impl<'a> EndpointError<'a> {
    fn user(message: Cow<'a, str>) -> Self {
        Self {
            kind: ErrorKind::User,
            message,
        }
    }
    fn internal(message: Cow<'a, str>) -> Self {
        Self {
            kind: ErrorKind::Internal,
            message,
        }
    }
}

/// The kind of an error
#[allow(unused)]
#[derive(serde::Serialize, PartialEq, Eq, ToSchema, Debug)]
#[serde(rename_all = "snake_case")]
#[non_exhaustive]
pub(in crate::webserver) enum ErrorKind {
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

/// Every endpoint exposes a Response type
#[derive(serde::Serialize)]
#[serde(untagged)]
#[non_exhaustive]
pub(in crate::webserver) enum Response<'a> {
    Github(github::GithubResponse),
    Repositories(repos::ReposResponse),
    Query(query::QueryResponse),
    Autocomplete(autocomplete::AutocompleteResponse),
    Hoverable(hoverable::HoverableResponse),
    Intelligence(intelligence::TokenInfoResponse),
    File(file::FileResponse),
    Semantic(semantic::SemanticResponse),
    Answer(answer::AnswerResponse),
    /// A blanket error response
    Error(EndpointError<'a>),
}

impl<'a> From<github::GithubResponse> for Response<'a> {
    fn from(r: github::GithubResponse) -> Response<'a> {
        Response::Github(r)
    }
}

impl<'a> From<repos::ReposResponse> for Response<'a> {
    fn from(r: repos::ReposResponse) -> Response<'a> {
        Response::Repositories(r)
    }
}

impl<'a> From<query::QueryResponse> for Response<'a> {
    fn from(r: query::QueryResponse) -> Response<'a> {
        Response::Query(r)
    }
}

impl<'a> From<autocomplete::AutocompleteResponse> for Response<'a> {
    fn from(r: autocomplete::AutocompleteResponse) -> Response<'a> {
        Response::Autocomplete(r)
    }
}

impl<'a> From<hoverable::HoverableResponse> for Response<'a> {
    fn from(r: hoverable::HoverableResponse) -> Response<'a> {
        Response::Hoverable(r)
    }
}

impl<'a> From<intelligence::TokenInfoResponse> for Response<'a> {
    fn from(r: intelligence::TokenInfoResponse) -> Response<'a> {
        Response::Intelligence(r)
    }
}

impl<'a> From<file::FileResponse> for Response<'a> {
    fn from(r: file::FileResponse) -> Response<'a> {
        Response::File(r)
    }
}

impl<'a> From<semantic::SemanticResponse> for Response<'a> {
    fn from(r: semantic::SemanticResponse) -> Response<'a> {
        Response::Semantic(r)
    }
}

impl<'a> From<EndpointError<'a>> for Response<'a> {
    fn from(r: EndpointError<'a>) -> Response<'a> {
        Response::Error(r)
    }
}

#[derive(OpenApi)]
#[openapi(
    paths(query::handle, autocomplete::handle, hoverable::handle, intelligence::handle),
    components(schemas(
        crate::symbol::Symbol,
        crate::text_range::TextRange,
        crate::text_range::Point,
        EndpointError<'_>,
        ErrorKind,
        autocomplete::AutocompleteResponse,
        query::QueryResponse,
        query::QueryResult,
        query::RepositoryResultData,
        query::FileResultData,
        query::FileData,
        query::DirectoryData,
        hoverable::HoverableResponse,
        intelligence::TokenInfoResponse,
        intelligence::SymbolOccurrence,
        snippet::SnippedFile,
        snippet::Snippet,
        repos::ReposResponse,
        repos::Repo,
        repos::SetIndexed,
        state::Backend,
        state::RepoRemote,
        state::SyncStatus,
        github::GithubResponse,
        github::GithubCredentialStatus,
    ))
)]
struct ApiDoc;

pub mod openapi_json {
    use super::*;
    pub async fn handle() -> impl IntoResponse {
        Json(<ApiDoc as OpenApi>::openapi())
    }
}

pub mod openapi_yaml {
    use super::*;
    pub async fn handle() -> impl IntoResponse {
        <ApiDoc as OpenApi>::openapi().to_yaml().unwrap()
    }
}

async fn health() {}
