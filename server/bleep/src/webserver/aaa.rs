use std::{
    sync::Arc,
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use crate::{
    remotes::{self, BackendCredential},
    state::Backend,
};

use super::*;
use anyhow::{bail, Context, Result};
use axum::{
    extract::Query,
    http::{Request, StatusCode},
    middleware::Next,
    response::Redirect,
};
use axum_extra::extract::cookie::{Cookie, PrivateCookieJar};
use dashmap::DashMap;
use octocrab::Octocrab;
use rand::{distributions::Alphanumeric, Rng};
use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use tantivy::time::Duration;
use tracing::error;

#[derive(serde::Serialize, serde::Deserialize)]
struct GithubAuthToken {
    expires_in: u64,
    #[serde(serialize_with = "crate::state::serialize_secret_str")]
    refresh_token: SecretString,
    #[serde(serialize_with = "crate::state::serialize_secret_str")]
    access_token: SecretString,
    // Ignore other fields here ...
}

#[derive(serde::Serialize, serde::Deserialize)]
struct AuthCookie {
    github_token: GithubAuthToken,
    created_at: u64,
    member_checked_at: Option<u64>,
}

impl AuthCookie {
    const COOKIE_NAME: &str = "auth_cookie";

    fn new(github_token: GithubAuthToken) -> Self {
        Self {
            github_token,
            created_at: unix_time_sec(),
            member_checked_at: None,
        }
    }

    fn member_checked(&self) -> bool {
        const MEMBERSHIP_CHECK_DURATION_SECS: u64 = 60 * 5;

        self.member_checked_at
            .map(|t| t + MEMBERSHIP_CHECK_DURATION_SECS >= unix_time_sec())
            .unwrap_or(false)
    }

    fn need_refresh(&self) -> bool {
        self.created_at + self.github_token.expires_in <= unix_time_sec()
    }

    fn set_member_checked(&mut self) {
        self.member_checked_at = Some(unix_time_sec());
    }

    fn to_cookie(&self) -> Cookie<'static> {
        let mut c = Cookie::new(
            AuthCookie::COOKIE_NAME,
            serde_json::to_string(self).unwrap(),
        );
        c.set_path("/");
        c.set_max_age(Duration::weeks(52));
        c
    }
}

const STATE_LEN: usize = 32;
type State = String;

/// Initiate a new login using a web-based OAuth flow.
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

    auth_layer.initialized_login.insert(state, Instant::now());
    auth_layer.clean_old_states();

    serde_json::json!({ "oauth_url": github_oauth_url }).to_string()
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
    jar: PrivateCookieJar,
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

    let gh_token = auth_layer
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
        .json()
        .await
        .unwrap();

    (
        jar.add(AuthCookie::new(gh_token).to_cookie()),
        Redirect::to("/"),
    )
}

fn unix_time_sec() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

pub(super) fn router(router: Router, app: Application) -> Router {
    router
        .layer(middleware::from_fn_with_state(
            app,
            authenticate_authorize_reissue,
        ))
        .route("/auth/login/complete", get(authorized))
        .route("/auth/login/start", get(login))
        .layer(Extension(Arc::new(AuthLayer::default())))
}

#[derive(Default)]
pub(crate) struct AuthLayer {
    /// Logins that have been initiated, but not completed.
    ///
    /// Maps to the time this login attempt was created.
    initialized_login: DashMap<State, Instant>,

    /// The HTTP client.
    client: reqwest::Client,
}

impl AuthLayer {
    fn clean_old_states(&self) {
        const MAX_AGE: std::time::Duration = std::time::Duration::from_secs(60 * 5);
        let now = Instant::now();
        self.initialized_login.retain(|_, t| now - *t < MAX_AGE);
    }
}

async fn authenticate_authorize_reissue<B>(
    Extension(app): Extension<Application>,
    Extension(auth_layer): Extension<Arc<AuthLayer>>,
    mut jar: PrivateCookieJar,
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
    jar: PrivateCookieJar,
    app: &Application,
    client: &reqwest::Client,
) -> Result<PrivateCookieJar> {
    let mut auth_cookie: AuthCookie = serde_json::from_str(
        jar.get(AuthCookie::COOKIE_NAME)
            .context("missing auth cookie")?
            .value(),
    )
    .context("invalid auth cookie")?;

    let member_checked = auth_cookie.member_checked();
    let need_refresh = auth_cookie.need_refresh();

    if member_checked && !need_refresh {
        return Ok(jar);
    }

    if need_refresh {
        let refresh_token = &auth_cookie.github_token.refresh_token.expose_secret();

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
            .header("Accept", "application/json")
            .send()
            .await?
            .text()
            .await?;

        auth_cookie.github_token =
            serde_json::from_str(&oauth_json).context("failed to deserialize refresh token")?;
    }

    if !member_checked {
        let org_name = {
            let BackendCredential::Github(cred) =
                app.credentials.get(&Backend::Github).unwrap().clone();

            match cred {
                remotes::github::Auth::App { org, .. } => org,
                _ => panic!("backend has invalid github credentials"),
            }
        };

        // An octocrab instance based on the user's access token.
        let octocrab = Octocrab::builder()
            .personal_token(
                auth_cookie
                    .github_token
                    .access_token
                    .expose_secret()
                    .clone(),
            )
            .build()
            .context("failed to build octocrab instance")?;

        let user_name: String = octocrab
            .current()
            .user()
            .await
            .context("failed to get user")?
            .login;

        // https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#check-organization-membership-for-a-user
        let is_member = octocrab
            ._get(
                format!("https://api.github.com/orgs/{org_name}/members/{user_name}"),
                None::<&()>,
            )
            .await
            .context("failed to check user membership on org")?
            .status()
            .is_success();

        if !is_member {
            bail!("{user_name} is not a member of the {org_name} organization");
        }

        auth_cookie.set_member_checked();
    }

    Ok(jar.add(auth_cookie.to_cookie()))
}
