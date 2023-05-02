use std::{
    sync::Arc,
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use crate::{remotes, Application};

use super::{middleware::User, prelude::*};
use anyhow::{bail, Context, Result};
use axum::{
    extract::Query,
    headers::{authorization::Bearer, Authorization},
    http::{Request, StatusCode},
    middleware::{from_fn_with_state, Next},
    response::Redirect,
    routing::get,
    TypedHeader,
};
use axum_extra::extract::cookie::{Cookie, PrivateCookieJar, SameSite};
use octocrab::Octocrab;
use rand::{distributions::Alphanumeric, Rng};
use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use time::Duration;
use tracing::error;

const MAX_PARALLEL_PENDING_LOGINS: usize = 512;

#[derive(serde::Serialize, serde::Deserialize)]
struct GithubAuthToken {
    expires_in: u64,
    #[serde(serialize_with = "crate::config::serialize_secret_str")]
    refresh_token: SecretString,
    #[serde(serialize_with = "crate::config::serialize_secret_str")]
    access_token: SecretString,
    // Ignore other fields here ...
}

#[derive(serde::Serialize, serde::Deserialize)]
struct AuthCookie {
    user_id: String,
    github_token: GithubAuthToken,
    created_at: u64,
    member_checked_at: Option<u64>,
}

impl AuthCookie {
    const COOKIE_NAME: &str = "auth_cookie";

    fn new(github_token: GithubAuthToken, user_id: String) -> Self {
        Self {
            user_id,
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

    fn update_token(&mut self, github_token: GithubAuthToken) {
        self.created_at = unix_time_sec();
        self.github_token = github_token;
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
pub(super) async fn login(
    Extension(app): Extension<Application>,
    Extension(auth_layer): Extension<Arc<AuthLayer>>,
) -> impl IntoResponse {
    auth_layer.clean_old_states();
    if auth_layer.initialized_login.len() >= MAX_PARALLEL_PENDING_LOGINS {
        panic!("too many parallel authorization requests");
    }

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
        "https://{}/api/auth/login/complete",
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

    _ = auth_layer
        .initialized_login
        .entry(state)
        .insert_entry(Instant::now());
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
pub(super) async fn authorized(
    axum::extract::State(app): axum::extract::State<Application>,
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

    let octocrab = make_octocrab(&gh_token).expect("bad token received from github");
    let user_name = get_username(&octocrab)
        .await
        .expect("can't retrieve user name");

    (
        jar.add(AuthCookie::new(gh_token, user_name).to_cookie()),
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
        .layer(from_fn_with_state(app, authenticate_authorize_reissue))
        .route("/auth/login/complete", get(authorized))
        .route("/auth/login/start", get(login))
        .layer(Extension(Arc::new(AuthLayer::default())))
}

#[derive(Default)]
pub(crate) struct AuthLayer {
    /// Logins that have been initiated, but not completed.
    ///
    /// Maps to the time this login attempt was created.
    initialized_login: scc::HashMap<State, Instant>,

    /// The HTTP client.
    client: reqwest::Client,
}

impl AuthLayer {
    fn clean_old_states(&self) {
        const MAX_AGE: Duration = Duration::seconds(60 * 5);
        let now = Instant::now();
        self.initialized_login.retain(|_, t| now - *t < MAX_AGE);
    }
}

async fn authenticate_authorize_reissue<B>(
    axum::extract::State(app): axum::extract::State<Application>,
    Extension(auth_layer): Extension<Arc<AuthLayer>>,
    auth_header: Option<TypedHeader<Authorization<Bearer>>>,
    jar: PrivateCookieJar,
    mut request: Request<B>,
    next: Next<B>,
) -> impl IntoResponse {
    // For better logging, we use some heuristics here to determine what the request type is. We
    // know that user requests authorize through a cookie, and bot requests authorize with the
    // `Authorization` header.
    let result = if jar.get(AuthCookie::COOKIE_NAME).is_some() {
        user_auth(jar, &app, &auth_layer.client)
            .await
            .context("failed to authenticate user request")
    } else if auth_header.is_some() {
        bot_auth(auth_header, &app)
            .await
            .context("failed to authenticate bot request")
            .map(|()| (User(None), jar))
    } else {
        Err(anyhow::anyhow!(
            "request had no auth cookie or `Authorization` header"
        ))
    };

    let (user, jar) = match result {
        Ok(new_cookies) => new_cookies,
        Err(e) => {
            error!("{}", e);
            return StatusCode::UNAUTHORIZED.into_response();
        }
    };

    request.extensions_mut().insert(user);
    let body = next.run(request).await;
    (jar, body).into_response()
}

async fn user_auth(
    jar: PrivateCookieJar,
    app: &Application,
    client: &reqwest::Client,
) -> Result<(User, PrivateCookieJar)> {
    let mut auth_cookie: AuthCookie = serde_json::from_str(
        jar.get(AuthCookie::COOKIE_NAME)
            .context("missing auth cookie")?
            .value(),
    )
    .context("invalid auth cookie")?;

    let member_checked = auth_cookie.member_checked();
    let need_refresh = auth_cookie.need_refresh();

    if member_checked && !need_refresh {
        return Ok((User(Some(auth_cookie.user_id.clone())), jar));
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

        let gh_token = serde_json::from_str(&oauth_json)
            .context(format!("failed to deserialize refresh token: {oauth_json}"))?;
        auth_cookie.update_token(gh_token);
    }

    let user_name = if !member_checked {
        let org_name = {
            let cred = app.credentials.github().unwrap();
            match cred.auth {
                remotes::github::Auth::App { org, .. } => org.clone(),
                _ => panic!("backend has invalid github credentials"),
            }
        };

        // An octocrab instance based on the user's access token.
        let octocrab = make_octocrab(&auth_cookie.github_token)?;
        let user_name = get_username(&octocrab).await?;

        // https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#check-organization-membership-for-a-user
        let is_member = octocrab
            ._get(format!(
                "https://api.github.com/orgs/{org_name}/members/{user_name}"
            ))
            .await
            .context("failed to check user membership on org")?
            .status()
            .is_success();

        if !is_member {
            bail!("{user_name} is not a member of the {org_name} organization");
        }

        auth_cookie.user_id = user_name.clone();
        auth_cookie.set_member_checked();
        user_name
    } else {
        auth_cookie.user_id.clone()
    };

    // We set SameSite to Strict to avoid CSRF. Specifically, this is *not* done when the cookie is
    // initially created as part of the OAuth process, as OAuth redirects would not work. The
    // cookie will have to undergo a membership check on the first request in this function, which
    // is when we set the `SameSite=Strict` attribute.
    let mut cookie = auth_cookie.to_cookie();
    cookie.set_same_site(SameSite::Strict);
    cookie.set_secure(true);

    Ok((User(Some(user_name)), jar.add(cookie)))
}

async fn get_username(octocrab: &Octocrab) -> Result<String, anyhow::Error> {
    Ok(octocrab
        .current()
        .user()
        .await
        .context("failed to get user")?
        .login)
}

fn make_octocrab(github_token: &GithubAuthToken) -> Result<Octocrab, anyhow::Error> {
    let octocrab = Octocrab::builder()
        .personal_token(github_token.access_token.expose_secret().clone())
        .build()
        .context("failed to build octocrab instance")?;
    Ok(octocrab)
}

async fn bot_auth(
    auth_header: Option<TypedHeader<Authorization<Bearer>>>,
    app: &Application,
) -> Result<()> {
    let bot_secret = app
        .config
        .bot_secret
        .as_ref()
        .context("missing bot_secret configuration option")?;
    let TypedHeader(Authorization(bearer)) = auth_header.context("missing Bearer token")?;

    if bearer.token() != bot_secret.expose_secret() {
        bail!("bot secret token mismatch");
    }

    Ok(())
}
