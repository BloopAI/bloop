use crate::{env::Feature, Application};

use axum::{http::StatusCode, response::IntoResponse, routing::get, Extension, Json};
use std::{borrow::Cow, net::SocketAddr};
use tower::Service;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::{catch_panic::CatchPanicLayer, cors::CorsLayer};
use tracing::info;

mod aaa;
pub mod answer;
mod autocomplete;
mod config;
mod file;
mod github;
mod hoverable;
mod index;
mod intelligence;
pub mod middleware;
mod query;
mod repos;
mod semantic;

pub type Router<S = Application> = axum::Router<S>;

#[allow(unused)]
pub(in crate::webserver) mod prelude {
    pub(in crate::webserver) use super::{json, EndpointError, Error, ErrorKind, Result, Router};
    pub(in crate::webserver) use crate::indexes::Indexes;
    pub(in crate::webserver) use axum::{
        extract::Query, http::StatusCode, response::IntoResponse, Extension,
    };
    pub(in crate::webserver) use serde::{Deserialize, Serialize};
    pub(in crate::webserver) use std::sync::Arc;
}

pub async fn start(app: Application) -> anyhow::Result<()> {
    let bind = SocketAddr::new(app.config.host.parse()?, app.config.port);

    let mut api = Router::new()
        .route("/config", get(config::handle))
        // querying
        .route("/q", get(query::handle))
        // autocomplete
        .route("/autocomplete", get(autocomplete::handle))
        // indexing
        .route("/index", get(index::handle))
        // repo management
        .route("/repos", get(repos::available))
        .route("/repos/status", get(repos::index_status))
        .route(
            "/repos/indexed",
            get(repos::indexed)
                .put(repos::set_indexed)
                .patch(repos::patch_indexed)
                .delete(repos::delete_by_id),
        )
        .route("/repos/sync", get(repos::sync).delete(repos::delete_sync))
        // intelligence
        .route("/hoverable", get(hoverable::handle))
        .route("/token-info", get(intelligence::handle))
        // misc
        .route("/search", get(semantic::complex_search))
        .route("/file", get(file::handle))
        .route("/answer", get(answer::handle))
        .route(
            "/answer/conversations",
            get(answer::conversations::list).delete(answer::conversations::delete),
        )
        .route(
            "/answer/conversations/:thread_id",
            get(answer::conversations::thread),
        );

    if app.env.allow(Feature::AnyPathScan) {
        api = api.route("/repos/scan", get(repos::scan_local));
    }

    if app.env.allow(Feature::GithubDeviceFlow) {
        api = api
            .route("/remotes/github/login", get(github::login))
            .route("/remotes/github/logout", get(github::logout))
            .route("/remotes/github/status", get(github::status));
    }

    api = api.route("/panic", get(|| async { panic!("dead") }));

    // Note: all routes above this point must be authenticated.
    // These middlewares MUST provide the `middleware::User` extension.
    if app.env.allow(Feature::AuthorizationRequired) {
        api = aaa::router(middleware::sentry_layer(api), app.clone());
    } else {
        api = middleware::local_user(middleware::sentry_layer(api), app.clone());
    }

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

fn json<'a, T>(val: T) -> Json<Response<'a>>
where
    Response<'a>: From<T>,
{
    Json(Response::from(val))
}

type Result<T, E = Error> = std::result::Result<T, E>;

struct Error {
    status: StatusCode,
    body: Json<Response<'static>>,
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

        let body = Json(Response::from(EndpointError {
            kind,
            message: message.into(),
        }));

        Error { status, body }
    }

    fn with_status(mut self, status_code: StatusCode) -> Self {
        self.status = status_code;
        self
    }

    fn internal<S: std::fmt::Display>(message: S) -> Self {
        Error {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            body: Json(Response::from(EndpointError {
                kind: ErrorKind::Internal,
                message: message.to_string().into(),
            })),
        }
    }

    fn user<S: std::fmt::Display>(message: S) -> Self {
        Error {
            status: StatusCode::BAD_REQUEST,
            body: Json(Response::from(EndpointError {
                kind: ErrorKind::User,
                message: message.to_string().into(),
            })),
        }
    }

    fn message(&self) -> &str {
        match &self.body {
            Json(Response::Error(EndpointError { message, .. })) => message.as_ref(),
            _ => "",
        }
    }
}

impl From<anyhow::Error> for Error {
    fn from(value: anyhow::Error) -> Self {
        Error::internal(value.to_string())
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> axum::response::Response {
        (self.status, self.body).into_response()
    }
}

/// The response upon encountering an error
#[derive(serde::Serialize, PartialEq, Eq, Debug)]
struct EndpointError<'a> {
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
enum ErrorKind {
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
enum Response<'a> {
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

async fn health(Extension(app): Extension<Application>) {
    if let Some(ref semantic) = app.semantic {
        // panic is fine here, we don't need exact reporting of
        // subsystem checks at this stage
        semantic.health_check().await.unwrap()
    }
}
