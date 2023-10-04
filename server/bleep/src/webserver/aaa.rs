use axum::{
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::get,
};
use jwt_authorizer::{Authorizer, IntoLayer, JwtAuthorizer};
use secrecy::{ExposeSecret, SecretString};
use serde_json::json;

use crate::{webserver::middleware, Application};

use super::prelude::*;

#[derive(serde::Serialize, serde::Deserialize)]
struct GithubAuthToken {
    expires_in: u64,
    #[serde(serialize_with = "crate::config::serialize_secret_str")]
    refresh_token: SecretString,
    #[serde(serialize_with = "crate::config::serialize_secret_str")]
    access_token: SecretString,
    // Ignore other fields here ...
}

#[derive(serde::Deserialize)]
pub(super) struct RedirectQuery {
    redirect_to: Option<String>,
}

/// Initiate a new login using a web-based OAuth flow.
pub(super) async fn login(
    State(app): State<Application>,
    Query(RedirectQuery { redirect_to }): Query<RedirectQuery>,
) -> impl IntoResponse {
    let timestamp = chrono::Utc::now();
    let payload = serde_json::json!({ "timestamp": timestamp.to_rfc2822(), "redirect_url": redirect_to.as_ref() });
    let state = app.seal_auth_state(payload);

    let mut oauth_url = app.config.cognito_auth_url.clone().expect("bad config");
    let client_id = app.config.cognito_client_id.as_ref().expect("bad config");
    oauth_url.query_pairs_mut().extend_pairs(&[
        ("response_type", "code"),
        ("scope", "email openid profile"),
        ("state", state.as_ref()),
        ("client_id", client_id.as_ref()),
        (
            "redirect_url",
            app.config
                .cognito_mgmt_url
                .as_ref()
                .expect("bad config")
                .join("complete")
                .unwrap()
                .as_ref(),
        ),
    ]);

    serde_json::json!({ "oauth_url": oauth_url }).to_string()
}

pub(super) async fn router(router: Router, app: Application) -> Router {
    let auth = get_authorizer(&app).await;

    router
        .layer(from_fn_with_state(app, middleware::remote_user_layer_mw))
        .layer(auth.into_layer())
        .route("/auth/login/start", get(login))
        .route("/auth/refresh_token", get(refresh_token))
}

async fn get_authorizer(app: &Application) -> Authorizer {
    let userpool_id = app.config.cognito_userpool_id.as_ref().expect("bad config");
    let (region, _) = userpool_id.split_once('_').unwrap();
    let url =
        format!("https://cognito-idp.{region}.amazonaws.com/{userpool_id}/.well-known/jwks.json");

    JwtAuthorizer::from_jwks_url(&url).build().await.unwrap()
}

#[derive(Deserialize, Serialize, Debug)]
pub(super) struct TokenResponse {
    #[serde(serialize_with = "crate::config::serialize_secret_str")]
    access_token: SecretString,
    exp: serde_json::Value,
    username: String,
}
impl super::ApiResponse for TokenResponse {}

#[derive(Deserialize)]
pub(super) struct RefreshParams {
    refresh_token: SecretString,
}

pub(super) async fn refresh_token(
    State(app): State<Application>,
    Query(RefreshParams { refresh_token }): Query<RefreshParams>,
) -> Result<impl IntoResponse> {
    let response: TokenResponse = reqwest::Client::new()
        .post(app.config.cognito_mgmt_url.clone().expect("bad config"))
        .json(&json!({
            "type":"user",
            "refresh_token": refresh_token.expose_secret(),
        }))
        .send()
        .await
        .map_err(|_| Error::new(ErrorKind::UpstreamService, "auth not reachable"))?
        .json()
        .await
        .map_err(|_| Error::new(ErrorKind::UpstreamService, "incompatible auth"))?;

    let sub = get_authorizer(&app)
        .await
        .check_auth(response.access_token.expose_secret())
        .await
        .map_err(|_| Error::new(ErrorKind::UpstreamService, "invalid token issued"))?
        .claims
        .sub
        .ok_or(Error::new(
            ErrorKind::UpstreamService,
            "invalid token issued",
        ))?;

    app.user_profiles.entry(sub).or_default().get_mut().username = Some(response.username.clone());
    Ok(json(response))
}
