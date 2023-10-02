use crate::Application;

use super::prelude::*;
use axum::{extract::Query, routing::get};
use secrecy::SecretString;

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
    Extension(app): Extension<Application>,
    Query(RedirectQuery { redirect_to }): Query<RedirectQuery>,
) -> impl IntoResponse {
    let timestamp = chrono::Utc::now();
    let payload = serde_json::json!({ "timestamp": timestamp.to_rfc2822(), "redirect_url": redirect_to.as_ref() });
    let state = app.seal_auth_state(payload);

    let mut oauth_url = app.config.cognito_auth_url.clone().expect("bad config");
    oauth_url.query_pairs_mut().extend_pairs(&[
        ("state", state.as_ref()),
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
    use jwt_authorizer::{Authorizer, IntoLayer, JwtAuthorizer};
    let userpool_id = app.config.cognito_userpool_id.as_ref().expect("bad config");
    let (region, _) = userpool_id.split_once('_').unwrap();
    let url =
        format!("https://cognito-idp.{region}.amazonaws.com/{userpool_id}/.well-known/jwks.json");

    let auth: Authorizer = JwtAuthorizer::from_jwks_url(&url).build().await.unwrap();

    router
        .layer(auth.into_layer())
        .route("/auth/login/start", get(login))
}
