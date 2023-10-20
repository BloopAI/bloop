use super::{
    aaa::{AuthResponse, CredentialStatus},
    middleware::User,
    prelude::*,
};
use crate::{
    remotes::{self, github, BackendCredential},
    repo::Backend,
    Application,
};

use axum::extract::State;
use tracing::{debug, error, warn};

use std::time::{Duration, Instant};

/// Connect to Github through Cognito & OAuth
//
pub(super) async fn login(Extension(app): Extension<Application>) -> impl IntoResponse {
    let state = uuid::Uuid::new_v4().to_string();

    tokio::spawn(poll_for_oauth_token(state.clone(), app.clone()));

    let mut url_base = app
        .config
        .cognito_auth_url
        .clone()
        .expect("auth not configured");
    let client_id = app
        .config
        .cognito_client_id
        .as_ref()
        .expect("auth not configured");
    let redirect_url = app
        .config
        .cognito_mgmt_url
        .as_ref()
        .expect("auth not configured")
        .join("complete")
        .unwrap()
        .to_string();

    url_base.query_pairs_mut().extend_pairs(&[
        ("response_type", "code"),
        ("scope", "email openid profile"),
        ("redirect_url", &redirect_url),
        ("client_id", client_id),
        ("state", &state),
    ]);

    let url = url_base.to_string();
    json(AuthResponse::AuthenticationNeeded { url })
}

/// Remove Github OAuth credentials
//
pub(super) async fn logout(
    Extension(user): Extension<User>,
    State(app): State<Application>,
) -> impl IntoResponse {
    if let Some(login) = user.login() {
        app.user_profiles.remove(login);
        app.user_profiles.store().unwrap();
        app.credentials.remove_user().await;
    }

    let deleted = app.credentials.remove(&Backend::Github);
    if let Some(BackendCredential::Github(github::State {
        auth: github::Auth::OAuth(creds),
        ..
    })) = deleted
    {
        let url_base = app
            .config
            .cognito_auth_url
            .as_ref()
            .expect("auth not configured");
        let client_id = app
            .config
            .cognito_client_id
            .as_ref()
            .expect("auth not configured");

        let url = url_base.join("revoke").unwrap();

        reqwest::Client::new()
            .post(url)
            .form(&[("client_id", client_id), ("token", &creds.refresh_token)])
            .send()
            .await
            .unwrap();

        match app.credentials.store() {
            Ok(_) => return Ok(json(AuthResponse::Status(CredentialStatus::Ok))),
            Err(err) => {
                error!(?err, "Failed to delete credentials from disk");
                return Err(Error::internal("failed to save changes"));
            }
        }
    }

    Ok(json(AuthResponse::Status(CredentialStatus::Missing)))
}

async fn poll_for_oauth_token(code: String, app: Application) {
    let start = Instant::now();

    let query_url = {
        let mut url = app
            .config
            .cognito_mgmt_url
            .as_ref()
            .expect("auth not configured")
            .join("access_token")
            .unwrap();

        url.set_query(Some(&format!("state={code}")));
        url.to_string()
    };

    let interval = Duration::from_secs(3);
    let mut clock = tokio::time::interval(interval);
    debug!(?interval, "github auth started");

    let auth = loop {
        clock.tick().await;

        if Instant::now().duration_since(start) > Duration::from_secs(600) {
            error!("github authorization timed out!");
            return;
        }

        let response = match reqwest::get(&query_url).await {
            Ok(res) => res.json().await,
            Err(err) => {
                warn!(?err, "github authorization failed");
                return;
            }
        };

        match response {
            Ok(remotes::AuthResponse::Backoff { backoff_secs }) => {
                clock = tokio::time::interval(Duration::from_secs(backoff_secs));
                clock.tick().await;
            }
            Ok(remotes::AuthResponse::Success(success)) => {
                break success;
            }
            Ok(remotes::AuthResponse::Error { error }) => {
                warn!(?error, "bloop authentication failed");
                return;
            }
            Err(err) => {
                warn!(?err, "github authorization failed");
                return;
            }
        }
    };

    debug!("acquired credentials");
    app.credentials.set_github(github::Auth::OAuth(auth));
    let username = app
        .credentials
        .github()
        .unwrap()
        .client()
        .unwrap()
        .current()
        .user()
        .await
        .unwrap()
        .login;

    let tracking_id = app
        .analytics
        .as_ref()
        .map(|a| a.tracking_id(Some(&username)))
        .unwrap_or_default();

    app.with_analytics(|analytics| {
        use rudderanalytics::message::{Identify, Message};
        analytics.send(Message::Identify(Identify {
            user_id: Some(tracking_id.clone()),
            traits: Some(serde_json::json!({
                "org_name": app.user().org_name(),
                "device_id": analytics.device_id(),
                "is_self_serve": app.env.is_cloud_instance(),
                "github_username": username,
            })),
            ..Default::default()
        }));
    });

    if let Err(err) = app.credentials.store() {
        error!(?err, "failed to save credentials to disk");
    }

    // the old place for credentials is now ready to be wiped
    app.config.source.ensure_deleted("credentials.json");
    debug!("github auth complete");
}
