use axum::{
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::get,
};
use axum_extra::extract::{
    cookie::{Cookie, SameSite},
    CookieJar,
};
use chrono::{DateTime, Utc};
use jwt_authorizer::{layer::JwtSource, Authorizer, IntoLayer, JwtAuthorizer, NumericDate};
use secrecy::{ExposeSecret, SecretString};
use serde_json::json;

use crate::{webserver::middleware, Application};

use super::prelude::*;

pub(super) const COOKIE_NAME: &str = "X-Bleep-Cognito";

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum CredentialStatus {
    Ok,
    Missing,
}

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum AuthResponse {
    AuthenticationNeeded { url: String },
    Status(CredentialStatus),
}

impl super::ApiResponse for AuthResponse {}

#[derive(serde::Deserialize)]
pub(super) struct RedirectQuery {
    redirect_to: Option<String>,
}

/// Initiate a new login using a web-based OAuth flow.
pub(super) async fn login(
    State(app): State<Application>,
    Query(RedirectQuery { redirect_to }): Query<RedirectQuery>,
) -> impl IntoResponse {
    let state = {
        let timestamp = chrono::Utc::now();
        let payload = serde_json::json!({
            "timestamp": timestamp.to_rfc2822(),
            "redirect_to": format!("{}/{}",
                                   app.config.instance_domain.as_ref().unwrap(),
                                   redirect_to.unwrap_or_default())
        });
        app.seal_auth_state(payload)
    };

    let url = {
        let mut url = app.config.cognito_auth_url.clone().expect("bad config");
        let client_id = app.config.cognito_client_id.as_ref().expect("bad config");

        url.query_pairs_mut().extend_pairs(&[
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

        url.to_string()
    };

    json(AuthResponse::AuthenticationNeeded { url })
}

pub(super) async fn router(router: Router, app: Application) -> Router {
    let auth = get_authorizer(&app).await;

    router
        .layer(from_fn_with_state(app, middleware::cloud_user_layer_mw))
        .layer(auth.into_layer())
        .route("/auth/login", get(login))
        .route("/auth/refresh_token", get(refresh_token))
}

#[derive(Deserialize, Clone, Debug)]
pub struct TokenClaims {
    pub exp: NumericDate,
    pub sub: String,
    #[serde(rename = "cognito:groups")]
    pub groups: Vec<String>,
}

pub async fn get_authorizer(app: &Application) -> Authorizer<TokenClaims> {
    let userpool_id = app.config.cognito_userpool_id.as_ref().expect("bad config");
    let (region, _) = userpool_id.split_once('_').unwrap();
    let url =
        format!("https://cognito-idp.{region}.amazonaws.com/{userpool_id}/.well-known/jwks.json");

    let mut auth = JwtAuthorizer::from_jwks_url(&url).build().await.unwrap();
    auth.jwt_source = JwtSource::Cookie(COOKIE_NAME.into());
    auth
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
    jar: CookieJar,
) -> Result<impl IntoResponse> {
    let response: TokenResponse = reqwest::Client::new()
        .post(
            app.config
                .cognito_mgmt_url
                .as_ref()
                .expect("bad config")
                .join("refresh_token")
                .unwrap(),
        )
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

    let claims = get_authorizer(&app)
        .await
        .check_auth(response.access_token.expose_secret())
        .await
        .map_err(|_| Error::new(ErrorKind::UpstreamService, "invalid token issued"))?
        .claims;

    app.user_profiles
        .entry(claims.sub)
        .or_default()
        .get_mut()
        .username = Some(response.username.clone());

    let max_age = (DateTime::<Utc>::from(claims.exp) - Utc::now()).num_seconds();
    Ok((
        jar.add(
            Cookie::build(
                COOKIE_NAME,
                response.access_token.expose_secret().to_owned(),
            )
            .same_site(SameSite::Strict)
            .path("/")
            .secure(true)
            .http_only(true)
            // thank you rust for having 3 competing, perfectly functional, and distinct `Duration` types
            .max_age(tantivy::time::Duration::seconds(max_age))
            .finish(),
        ),
        json(response),
    ))
}
