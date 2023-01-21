use std::{
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    remotes::{self, BackendCredential},
    state::Backend,
};

use super::*;
use anyhow::{Context, Result};
use axum::{
    extract::Query,
    http::{Request, StatusCode},
    middleware::Next,
    response::Redirect,
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use dashmap::DashSet;
use rand::{distributions::Alphanumeric, Rng};
use secrecy::ExposeSecret;
use serde::Deserialize;
use tantivy::time::Duration;
use tracing::error;

const AUTH_TOKEN_COOKIE: &str = "auth_token";
const AUTH_CREATED_AT_COOKIE: &str = "auth_created_at";

const STATE_LEN: usize = 32;
type State = String;

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
    Extension(auth_layer): Extension<Arc<AuthLayer>>,
) -> impl IntoResponse {
    let state = rand::thread_rng()
        .sample_iter(Alphanumeric)
        .take(STATE_LEN)
        .map(|c| c as char)
        .collect::<String>();

    let client_id = app
        .config
        .github_client_id
        .as_ref()
        .expect("github client id must be provided")
        .expose_secret();

    let redirect_uri = format!(
        "https://{}/auth/login/complete",
        app.config
            .instance_domain
            .as_ref()
            .expect("instance domain must be provided")
    );

    let github_oauth_url = &format!(
        "https://github.com/login/oauth/authorize\
         ?client_id={client_id}\
         &state={state}\
         &allow_signup=false\
         &redirect_uri={redirect_uri}",
    );

    auth_layer.initialized_login.insert(state);

    Redirect::to(github_oauth_url)
}

fn update_cookies(jar: CookieJar, oauth_json: String) -> CookieJar {
    const ONE_YEAR: Duration = Duration::seconds(60 * 60 * 24 * 365);

    jar.add(
        Cookie::build(AUTH_TOKEN_COOKIE, oauth_json)
            .path("/")
            .max_age(ONE_YEAR)
            .finish(),
    )
    .add(
        Cookie::build(AUTH_CREATED_AT_COOKIE, unix_time().to_string())
            .path("/")
            .max_age(ONE_YEAR)
            .finish(),
    )
}

#[derive(Deserialize)]
pub(super) struct AuthorizedParams {
    state: State,
    code: String,
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
    Extension(auth_layer): Extension<Arc<AuthLayer>>,
    Query(params): Query<AuthorizedParams>,
    jar: CookieJar,
) -> impl IntoResponse {
    let AuthorizedParams { state, code } = params;

    auth_layer
        .initialized_login
        .remove(&state)
        .expect("invalid state key");

    let (client_id, client_secret) = app
        .config
        .github_client_id_and_secret()
        .expect("github client id and secret must be provided");

    let oauth_json: String = auth_layer
        .client
        .post(format!(
            "https://github.com/login/oauth/access_token\
            ?client_id={client_id}\
            &client_secret={client_secret}\
            &code={code}"
        ))
        .header("Accept", "application/json")
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();

    (update_cookies(jar, oauth_json), Redirect::to("/"))
}

fn unix_time() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

pub(super) fn router(router: Router) -> Router {
    router
        .layer(middleware::from_fn(authenticate_authorize_reissue))
        .route("/auth/login/complete", get(authorized))
        .route("/auth/login/start", get(login))
        .layer(Extension(Arc::new(AuthLayer::default())))
}

#[derive(Default)]
pub(crate) struct AuthLayer {
    /// Logins that have been initiaed, but not completed.
    // TODO: Note that this isn't currently cleaned up with a timeout, so there's a DoS
    // vulnerability here.
    initialized_login: DashSet<State>,

    /// The HTTP client.
    client: reqwest::Client,
}

async fn authenticate_authorize_reissue<B>(
    Extension(app): Extension<Application>,
    Extension(auth_layer): Extension<Arc<AuthLayer>>,
    mut jar: CookieJar,
    request: Request<B>,
    next: Next<B>,
) -> impl IntoResponse {
    let unauthorized = || StatusCode::UNAUTHORIZED.into_response();

    match user_auth(jar, &app, &auth_layer.client).await {
        Ok(new_cookies) => jar = new_cookies,
        Err(err) => {
            error!(?err, "failed to authenticate user");
            return unauthorized();
        }
    }

    let body = next.run(request).await;
    (jar, body).into_response()
}

async fn user_auth(
    jar: CookieJar,
    app: &Application,
    client: &reqwest::Client,
) -> Result<CookieJar> {
    let auth_token = jar
        .get(AUTH_TOKEN_COOKIE)
        .context("missing auth_token cookie")?
        .value();

    let created_at = jar
        .get(AUTH_CREATED_AT_COOKIE)
        .context("missing auth_created_at cookie")?
        .value()
        .parse::<u64>()
        .context("invalid auth_created_at cookie")?;

    #[derive(Deserialize)]
    struct GithubAuth {
        expires_in: u64,
        refresh_token: String,
        // Ignore other fields here ...
    }

    let auth: GithubAuth = serde_json::from_str(auth_token)?;

    let org_name = {
        let BackendCredential::Github(cred) =
            app.credentials.get(&Backend::Github).unwrap().clone();

        match cred {
            remotes::github::Auth::App { org, .. } => org,
            _ => panic!("backend has invalid github credential"),
        }
    };

    // TODO: Get user name and check membership, cache in new cookie
    // "https://github.com/orgs/{org_name}/members/{user_name}"

    if created_at + auth.expires_in > unix_time() {
        return Ok(jar);
    }

    let GithubAuth { refresh_token, .. } = auth;

    let (client_id, client_secret) = app
        .config
        .github_client_id_and_secret()
        .expect("github client id and secret must be provided");

    let oauth_json = client
        .post(format!(
            "https://github.com/login/oauth/access_token\
            ?refresh_token={refresh_token}\
            &grant_type=refresh_token\
            &client_id={client_id}\
            &client_secret={client_secret}"
        ))
        .send()
        .await?
        .text()
        .await?;

    Ok(update_cookies(jar, oauth_json))
}
