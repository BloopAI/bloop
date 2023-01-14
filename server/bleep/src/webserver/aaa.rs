use std::{ops::Not, sync::Arc};

use crate::{remotes::BackendCredential, Configuration};

use super::*;
use axum::{
    body::{self, boxed},
    extract::{Path, Query},
    http::{self, header::AUTHORIZATION, Error, Request, Response, StatusCode},
    response::Redirect,
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use biscuit_auth::{self as biscuit, Biscuit};
use dashmap::{DashMap, DashSet};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tower_http::auth::{AuthorizeRequest, RequireAuthorizationLayer};

type State = String;
type Resource<'a> = Cow<'a, str>;
type Operation<'a> = Cow<'a, str>;

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
struct UserId(String);

#[derive(Deserialize)]
struct InputUserPermissions<'a>(Vec<(Resource<'a>, Operation<'a>)>);

#[derive(Deserialize, Serialize)]
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
    refreshed_permissions: Arc<DashSet<UserId>>,
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
            refreshed_permissions: DashSet::default().into(),
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

            builder.add_authority_fact(fact("user", &[&user])).unwrap();

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

        let mut token = {
            let mut builder = authority.create_block();
            builder.expiration_date(SystemTime::now() + Duration::from_days(1));

            let end_token = authority.append(builder).unwrap();
            end_token.to_base64()
        };

        self.user_perms
            .insert(user.clone(), UserPermissions(perms.clone()));

        token
    }

    fn check_auth<B>(&self, request: &Request<B>) -> Option<UserId> {
        // ...
        None
    }
}

impl<B> AuthorizeRequest<B> for AuthenticationLayer {
    type ResponseBody = body::BoxBody;

    fn authorize(&mut self, request: &mut Request<B>) -> Result<(), Response<Self::ResponseBody>> {
        if let Some(user_id) = self.check_auth(request) {
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

    let perms = UserPermissions::default();
    let token = app.auth.issue_auth_cookie(userid, perms);

    (jar.add(Cookie::new("auth_token", token)), Redirect::to("/"))
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
    let github_installation_client = app.credentials.github_client().await;
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
async fn set_user(
    Extension(app): Extension<Application>,
    Path(user): Path<String>,
    Json(permissions): Json<InputUserPermissions<'_>>,
) -> impl IntoResponse {
    let github_installation_client = app.credentials.github_client().await;
    {
        // validate if user is part of the organization
        todo!()
    }

    app.auth.user_perms.insert(
        UserId(user),
        permissions.validate().expect("invalid permission set"),
    );
    app.auth.refreshed_permissions.insert(UserId(user));

    StatusCode::OK
}

pub(super) fn router(auth: AuthenticationLayer) -> Router {
    Router::new()
        .route("/auth/login/start", get(login))
        .route("/auth/login/complete", put(authorized))
        .route("/auth/users", put(list_users))
        .route("/auth/users/:user", put(set_user))
        .layer(RequireAuthorizationLayer::custom(auth))
}
