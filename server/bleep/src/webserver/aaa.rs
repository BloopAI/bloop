use std::{
    ops::Not,
    sync::Arc,
    time::{Duration, SystemTime},
};

use crate::{remotes::BackendCredential, Configuration};

use super::*;
use axum::{
    body::BoxBody,
    extract::{Path, Query},
    headers::{
        authorization::{Authorization, Bearer},
        Header,
    },
    http::{header::AUTHORIZATION, Method, Request, Response, StatusCode},
    middleware::{self, Next},
    response::Redirect,
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use biscuit_auth::{self as biscuit, Biscuit};
use dashmap::{DashMap, DashSet};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use serde_json::json;

const COOKIE: &str = "auth_token";

type State = String;
type Resource<'a> = Cow<'a, str>;
type Operation<'a> = Cow<'a, str>;

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub(crate) struct UserId(String);

#[derive(Deserialize)]
struct InputUserPermissions<'a>(Vec<(Resource<'a>, Operation<'a>)>);

#[derive(Deserialize, Serialize, Clone)]
struct UserPermissions(Vec<(Resource<'static>, Operation<'static>)>);

#[derive(Debug)]
struct PermissionsError(Resource<'static>, Operation<'static>);

impl<'a> InputUserPermissions<'a> {
    /// Validate user input and make it compatible with our storage if
    /// all gucci
    fn validate(self) -> Result<UserPermissions, PermissionsError> {
        let InputUserPermissions(perms) = self;

        perms
            .into_iter()
            .map(|(res, op)| {
                if ["admin", "repos"].contains(&res.as_ref())
                    && ["read", "write"].contains(&op.as_ref())
                {
                    Ok((res.into_owned().into(), op.into_owned().into()))
                } else {
                    Err(PermissionsError(
                        res.into_owned().into(),
                        op.into_owned().into(),
                    ))
                }
            })
            .collect::<Result<Vec<_>, PermissionsError>>()
            .map(UserPermissions)
    }
}

impl Default for UserPermissions {
    fn default() -> Self {
        Self(vec![("repos".into(), "read".into())])
    }
}

// TODO:
//
// Since this is an `Arc`fest, may be useful to do an
// `AuthenticatedLayer(Arc<AuthenticatedLayerInner>)` pattern instead
#[derive(Clone)]
pub(crate) struct AuthenticationLayer {
    /// Identity key of this server.
    /// Never persisted, we force re-logins if the server is re-deployed.
    ///
    /// TODO: This is good for privacy, may or may not suck for UX
    identity: Arc<biscuit::KeyPair>,

    /// The HTTP client
    client: reqwest::Client,

    /// Base URL for the auth server
    auth_server_url: Option<SecretString>,

    /// Logins that have been initiated, but not completed
    ///
    /// TODO: Note that this isn't currently cleaned up with a
    /// timeout, so there's a DoS here
    initialized_login: Arc<DashSet<State>>,

    /// OAuth tokens for the users of this system that authenticate to
    /// the upstream OAuth provider.
    ///
    /// We retain these so we can check expiry & force log out
    /// the user if their access has been revoked to the organization.
    ///
    /// TODO: None of these are enforced right now.
    backend_tokens: Arc<DashMap<UserId, BackendCredential>>,

    /// Permissions available for a user.
    user_perms: Arc<DashMap<UserId, UserPermissions>>,

    /// Users that need a new token issued.
    refresh_token: Arc<DashSet<UserId>>,
}

impl AuthenticationLayer {
    pub fn new(config: &Configuration) -> Self {
        AuthenticationLayer {
            identity: biscuit::KeyPair::new().into(),
            client: reqwest::Client::new(),
            auth_server_url: config.auth_server_url.clone(),
            initialized_login: DashSet::default().into(),
            backend_tokens: DashMap::default().into(),
            user_perms: DashMap::default().into(),
            refresh_token: DashSet::default().into(),
        }
    }

    pub(crate) async fn post(
        &self,
        path: &str,
        json: &serde_json::Value,
    ) -> reqwest::Result<reqwest::Response> {
        let url = format!(
            "{}/{path}",
            self.auth_server_url
                .as_ref()
                .expect("auth server not found")
                .expose_secret()
        );
        self.client.post(url).json(json).send().await
    }

    pub(crate) async fn get(&self, path: &str) -> reqwest::Result<reqwest::Response> {
        let url = format!(
            "{}/{path}",
            self.auth_server_url.as_ref().unwrap().expose_secret()
        );
        self.client.get(url).send().await
    }

    /// Issue a new session token for the user with the given
    /// permission matrix, and store the permissions in the local
    /// cache.
    fn issue_auth_cookie(
        &self,
        UserId(user): UserId,
        UserPermissions(perms): UserPermissions,
    ) -> String {
        use biscuit::builder::{fact, string};

        let authority = {
            let mut builder = Biscuit::builder(&self.identity);
            for (res, op) in &perms {
                builder
                    .add_authority_fact(fact("right", &[string(res), string(op)]))
                    .unwrap();
            }

            builder
                .add_authority_fact(fact("user", &[string(&user)]))
                .unwrap();

            // TODO:
            // would be good to sign the organization name here as
            // well, but it's not an issue since the instance identity
            // key will be unique anyway.
            //
            // i don't really know where to get the org name from
            // without pinging the auth server

            builder
                .add_code(r#"check if resource($res), operation($op), right($res, $op)"#)
                .unwrap();

            builder.build().unwrap()
        };

        let token = {
            let mut builder = authority.create_block();

            // default expiration for a token is 10m. after expiry,
            // force re-issue after a github API check.
            builder.expiration_date(SystemTime::now() + Duration::from_secs(600));

            let end_token = authority.append(builder).unwrap();
            end_token.to_base64().expect("failed to issue token")
        };

        self.user_perms
            .insert(UserId(user.clone()), UserPermissions(perms.clone()));

        token
    }

    /// The lack of detail in error reporting here is deliberate. We
    /// don't want to leak information about how the authorization
    /// failed even inadvertently.
    ///
    /// Note this function is not timing safe, so a timing oracle may
    /// still exist.
    fn check_auth<B>(&self, request: &Request<B>) -> Option<UserId> {
        let jar = CookieJar::from_headers(request.headers());
        let mut auth_headers = request.headers().get_all(AUTHORIZATION).iter();

        let token = if let Some(cookie) = jar.get(COOKIE) {
            cookie.value().to_string()
        } else if let Ok(header) = Authorization::<Bearer>::decode(&mut auth_headers) {
            header.token().to_string()
        } else {
            return None;
        };

        self.validate_token(&token, request)
    }

    /// Validates a token and returns the UserId if it's either valid
    /// or needs refreshing
    ///
    /// **WARNING**: It is the responsibility of the *caller* to
    /// ensure the UserId is up to date before granting authorization.
    fn validate_token<B>(&self, token: &str, request: &Request<B>) -> Option<UserId> {
        use biscuit::builder::{fact, string};

        let biscuit = Biscuit::from_base64(token, |_| self.identity.public()).ok()?;
        let mut authorizer = biscuit.authorizer().ok()?;
        authorizer
            .add_fact(fact(
                "resource",
                &[string(if request.uri().path().starts_with("/auth") {
                    "admin"
                } else {
                    "repos"
                })],
            ))
            .ok()?;

        authorizer
            .add_fact(fact(
                "operation",
                &[string(
                    if [Method::OPTIONS, Method::GET].contains(request.method()) {
                        "read"
                    } else {
                        "write"
                    },
                )],
            ))
            .ok()?;

        let users: Vec<(String,)> = authorizer.query("data($name) <- user($name)").ok()?;
        let user = users.get(0)?.0.to_string();
        let permissions_ok = authorizer.authorize().is_ok();

        authorizer.set_time();
        let expired = authorizer.authorize().is_err();

        match (permissions_ok, expired) {
            (true, false) => Some(UserId(user)),
            (_, true) => {
                self.refresh_token.insert(UserId(user.clone()));
                Some(UserId(user))
            }
            (false, false) => {
                // this is a straight up rejection
                None
            }
        }
    }
}

#[derive(Deserialize)]
pub(super) struct LoginParams {
    state: State,
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

    let oauth = app
        .auth
        .get(&format!("/private/issue_token?state={state}"))
        .await
        .expect("can't reach auth server")
        .json::<BackendCredential>()
        .await
        .expect("invalid auth server response");

    let userid = {
        let BackendCredential::Github(ref auth) = oauth;
        let user = auth
            .client()
            .unwrap()
            .current()
            .user()
            .await
            .expect("invalid github oauth token")
            .login;

        UserId(user)
    };
    app.auth.backend_tokens.insert(userid.clone(), oauth);

    // we need to check if this is a re-auth, or they've been
    // pre-provisioned through a `/private/hello` call.
    let perms = app
        .auth
        .user_perms
        .get(&userid)
        .map(|elem| elem.value().clone())
        .unwrap_or_default();

    let token = app.auth.issue_auth_cookie(userid, perms);

    (jar.add(Cookie::new(COOKIE, token)), Redirect::to("/"))
}

/// List all users in the organization (admin only)
#[utoipa::path(get, path = "/auth/users",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
async fn list_users(Extension(app): Extension<Application>) -> impl IntoResponse {
    Json(app.credentials.github_installation_org_users().await)
}

/// Set user permissions & details (admin only)
#[utoipa::path(put, path = "/auth/users/:user",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
async fn set_user(
    Extension(app): Extension<Application>,
    Path(user): Path<String>,
    Json(permissions): Json<InputUserPermissions<'_>>,
) -> impl IntoResponse {
    if app
        .credentials
        .github_installation_org_users()
        .await
        .contains(&user)
        .not()
    {
        return StatusCode::BAD_REQUEST;
    }

    app.auth.user_perms.insert(
        UserId(user.clone()),
        permissions.validate().expect("invalid permission set"),
    );
    app.auth.refresh_token.insert(UserId(user));

    StatusCode::OK
}

pub(super) fn router() -> Router {
    Router::new()
        .route("/auth/login/start", get(login))
        .route("/auth/login/complete", put(authorized))
        .route("/auth/users", put(list_users))
        .route("/auth/users/:user", put(set_user))
        .layer(middleware::from_fn(authenticate_authorize_reissue))
}

async fn authenticate_authorize_reissue<B>(
    Extension(app): Extension<Application>,
    mut jar: CookieJar,
    mut request: Request<B>,
    next: Next<B>,
) -> Response<BoxBody> {
    let path = request.uri().path();
    if !(path.starts_with("/health") || path.starts_with("/api-doc")) {
        match user_auth(jar, &app, &mut request).await {
            Ok(new_cookies) => jar = new_cookies,
            Err(unauthorized) => return unauthorized,
        }
    }

    next.run(request).await;

    // TODO: I don't actually know if this will discard the inner
    // transformations of the response
    //
    // Since I didn't find a way to cleanly transform the response of
    // `Next`, I have to assume these are merged by axum.
    jar.into_response()
}

async fn user_auth<B>(
    mut jar: CookieJar,
    app: &Application,
    request: &mut Request<B>,
) -> Result<CookieJar, Response<BoxBody>> {
    let auth = &app.auth;
    let unauthorized = || Err(StatusCode::UNAUTHORIZED.into_response());

    let Some(user_id) = auth.check_auth(&request) else {
        return unauthorized();
    };

    // first check passed, now we check if we need a second one.
    if auth.refresh_token.remove(&user_id).is_some() {
        let perms = {
            // reload permission table
            let Some(perms) = auth.user_perms.get(&user_id) else {
		    // this should exist, if it doesn't, something's fishy. bail.
		    return unauthorized();
		};

            perms.value().clone()
        };

        // issue new token, rotate.
        let token = auth.issue_auth_cookie(user_id.clone(), perms);

        // check if new permissions would grant access
        if auth.validate_token(&token, &request).is_none() {
            return unauthorized();
        }

        // if this fails, the token has no backing user
        let Some(creds) = auth.backend_tokens.get(&user_id) else {
	    return unauthorized();
	};

        // check if the user revoked access to the token
        if creds.validate().await.is_err() {
            auth.user_perms.remove(&user_id);
            auth.backend_tokens.remove(&user_id);

            return unauthorized();
        }

        // set the new token as a cookie
        jar = jar
            .remove(Cookie::named(COOKIE))
            .add(Cookie::new(COOKIE, token));
    }
    request.extensions_mut().insert(user_id);

    Ok(jar)
}
