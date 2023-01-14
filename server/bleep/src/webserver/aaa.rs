use std::sync::Arc;

use crate::Configuration;

use super::*;
use axum::{
    body::{self, boxed},
    extract::{Path, Query},
    http::{self, header::AUTHORIZATION, Error, Request, Response, StatusCode},
    response::Redirect,
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use dashmap::{DashMap, DashSet};
use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use serde_json::json;
use tower_http::auth::{AuthorizeRequest, RequireAuthorizationLayer};

type State = String;
type Token = String;
type Oauth = String;

pub(super) fn router(auth: AuthenticationLayer) -> Router {
    Router::new()
        .route("/auth/login/start", get(login))
        .route("/auth/login/complete", put(authorized))
        .route("/auth/users", put(list_users))
        .route("/auth/users/:user", put(set_user))
        .layer(RequireAuthorizationLayer::custom(auth))
}

#[derive(Clone)]
pub(crate) struct AuthenticationLayer {
    client: reqwest::Client,
    host: Option<SecretString>,
    initialized_login: Arc<DashSet<State>>,
    cached_tokens: Arc<DashMap<State, Token>>,
}

impl AuthenticationLayer {
    pub fn new(config: &Configuration) -> Self {
        AuthenticationLayer {
            client: reqwest::Client::new(),
            host: config.auth_server_url.clone(),
            initialized_login: DashSet::default().into(),
            cached_tokens: DashMap::default().into(),
        }
    }

    pub(crate) async fn post(
        &self,
        path: &str,
        json: &serde_json::Value,
    ) -> reqwest::Result<reqwest::Response> {
        let url = format!(
            "{}/{path}",
            self.host
                .as_ref()
                .expect("auth server not found")
                .expose_secret()
        );
        self.client.post(url).json(json).send().await
    }

    pub(crate) async fn get(&self, path: &str) -> reqwest::Result<reqwest::Response> {
        let url = format!("{}/{path}", self.host.as_ref().unwrap().expose_secret());
        self.client.get(url).send().await
    }
}

#[derive(Debug)]
struct UserId(String);

impl<B> AuthorizeRequest<B> for AuthenticationLayer {
    type ResponseBody = body::BoxBody;

    fn authorize(&mut self, request: &mut Request<B>) -> Result<(), Response<Self::ResponseBody>> {
        if let Some(user_id) = check_auth(request) {
            // Set `user_id` as a request extension so it can be accessed by other
            // services down the stack.
            request.extensions_mut().insert(user_id);

            Ok(())
        } else {
            let unauthorized_response = Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .body(boxed(body::Empty::new()))
                .unwrap();

            Err(unauthorized_response)
        }
    }
}

fn check_auth<B>(request: &Request<B>) -> Option<UserId> {
    // ...
    None
}

#[derive(Deserialize)]
pub(super) struct LoginParams {
    state: State,
}

#[derive(Deserialize)]
pub(super) struct LoginComplete {
    oauth: String,
    token: Token,
}

/// Initiate a new login using a web-based OAuth flow.
///
/// Redirects to Github after setting up the correct expectations.
/// Use this endpoint as a redirect target instead of an API call!
#[utoipa::path(get, path = "/auth/login/start",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn login(
    Extension(app): Extension<Application>,
    Query(params): Query<LoginParams>,
) -> impl IntoResponse {
    let state = params.state;
    let github_oauth_url = &format!(
        "https://github.com/login/oauth/authorize?client_id={}&state={state}&allow_signup=false",
        app.config
            .github_client_id
            .as_ref()
            .expect("github client id must be provided")
            .expose_secret()
    );

    app.auth
        .post("/private/start_login", &json!({ "state": &state }))
        .await
        .unwrap();

    app.auth.initialized_login.insert(state);
    Redirect::to(github_oauth_url)
}

/// Complete the login flow.
///
/// Takes the `state` that has been established previously so we don't leak the actual keys.
#[utoipa::path(post, path = "/auth/login/complete",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn authorized(
    Extension(app): Extension<Application>,
    Query(params): Query<LoginParams>,
    jar: CookieJar,
) -> impl IntoResponse {
    let state = params.state;

    // Probably some better error handling here would be useful, but
    // we can also just blow up.
    app.auth
        .initialized_login
        .remove(&state)
        .expect("auth unauthorized");

    let token = app
        .auth
        .get(&format!("/private/issue_token?state={state}"))
        .await
        .unwrap()
        .json::<LoginComplete>()
        .await
        .unwrap();

    (
        jar.add(Cookie::new("auth_token", token.token)),
        Redirect::to("/"),
    )
}

/// List all users in the organization (admin only)
#[utoipa::path(get, path = "/auth/users",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn list_users(Extension(app): Extension<Application>) -> impl IntoResponse {
    todo!()
}

/// Set user permissions & details (admin only)
#[utoipa::path(put, path = "/auth/users/:user",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn set_user(
    Path(user): Path<String>,
    Extension(app): Extension<Application>,
) -> impl IntoResponse {
    todo!()
}
