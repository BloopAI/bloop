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
    use base64::Engine;
    use rand::RngCore;

    let privkey = {
        let bytes = app
            .config
            .bloop_instance_secret
            .as_ref()
            .expect("no instance secret configured")
            .as_bytes();

        ring::aead::LessSafeKey::new(
            ring::aead::UnboundKey::new(&ring::aead::AES_128_GCM, bytes)
                .expect("bad key initialization"),
        )
    };

    let (nonce, nonce_str) = {
        let mut buf = [0; 12];
        rand::thread_rng().fill_bytes(&mut buf);

        let nonce_str = hex::encode(buf);
        (ring::aead::Nonce::assume_unique_for_key(buf), nonce_str)
    };

    let enc = {
        let timestamp = chrono::Utc::now();
        let mut serialized = serde_json::to_vec(
            &serde_json::json!({ "timestamp": timestamp.to_rfc2822(), "redirect_url": redirect_to.as_ref() }),
        )
        .unwrap();
        privkey
            .seal_in_place_append_tag(nonce, ring::aead::Aad::empty(), &mut serialized)
            .expect("encryption failed");

        serialized
    };

    let state = base64::engine::general_purpose::STANDARD_NO_PAD.encode(
        serde_json::to_vec(&serde_json::json!({
        "org": app.config.bloop_instance_org.as_ref().expect("bad config"),
        "n": nonce_str,
        "enc": enc
        }))
        .expect("bad encoding"),
    );

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
