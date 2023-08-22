use super::prelude::*;
use crate::{
    remotes::{github, AuthResponse, BackendCredential},
    repo::Backend,
    Application,
};

use tracing::{debug, error, warn};

use std::time::{Duration, Instant};

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum GithubResponse {
    AuthenticationNeeded { url: String },
    Status(GithubCredentialStatus),
}

impl super::ApiResponse for GithubResponse {}

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum GithubCredentialStatus {
    Ok,
    Missing,
}

/// Get the status of the Github OAuth authentication
//
pub(super) async fn status(Extension(app): Extension<Application>) -> impl IntoResponse {
    let github = app.credentials.github();

    if github.is_some() {
        let username = app
            .credentials
            .github()
            // We just initialized this above.
            .expect("github credentials were not initialized")
            .client()
            // We know the builder won't fail as we just built it above.
            .expect("failed to get octocrab client")
            .current()
            .user()
            .await
            // There is no sensible way to track this error, so we panic if it fails.
            .expect("failed to get current user info")
            .login;

        app.with_analytics(|analytics| {
            use rudderanalytics::message::{Identify, Message};
            analytics.send(Message::Identify(Identify {
                user_id: Some(analytics.tracking_id(Some(&username))),
                traits: Some(serde_json::json!({
                    "org_name": app.org_name(),
                    "device_id": analytics.device_id(),
                    "is_self_serve": app.env.is_cloud_instance(),
                    "github_username": username,
                })),
                ..Default::default()
            }));
        });
    }

    (
        StatusCode::OK,
        json(GithubResponse::Status(if github.is_some() {
            GithubCredentialStatus::Ok
        } else {
            GithubCredentialStatus::Missing
        })),
    )
}

/// Connect to Github through Cognito & OAuth
//
pub(super) async fn login(Extension(app): Extension<Application>) -> impl IntoResponse {
    let state = uuid::Uuid::new_v4().to_string();

    tokio::spawn(poll_for_oauth_token(state.clone(), app.clone()));

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
    let redirect_url = reqwest::Url::parse(
        app.config
            .cognito_mgmt_url
            .as_ref()
            .expect("auth not configured"),
    )
    .unwrap()
    .join("complete")
    .unwrap()
    .to_string();

    let url = reqwest::Url::parse_with_params(
        url_base,
        &[
            ("response_type", "code"),
            ("scope", "email openid profile"),
            ("redirect_url", &redirect_url),
            ("client_id", client_id),
            ("state", &state),
        ],
    )
    .unwrap()
    .to_string();

    json(GithubResponse::AuthenticationNeeded { url })
}

/// Remove Github OAuth credentials
//
pub(super) async fn logout(Extension(app): Extension<Application>) -> impl IntoResponse {
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

        let url = reqwest::Url::parse(url_base)
            .unwrap()
            .join("revoke")
            .unwrap();

        reqwest::Client::new()
            .post(url)
            .form(&[("client_id", client_id), ("token", &creds.refresh_token)])
            .send()
            .await
            .unwrap();

        let saved = app
            .config
            .source
            .save_credentials(&app.credentials.serialize().await);

        if saved.is_ok() {
            return Ok(json(GithubResponse::Status(GithubCredentialStatus::Ok)));
        }

        if let Err(err) = saved {
            error!(?err, "Failed to delete credentials from disk");
            return Err(Error::internal("failed to save changes"));
        }
    }

    Ok(json(GithubResponse::Status(
        GithubCredentialStatus::Missing,
    )))
}

async fn poll_for_oauth_token(code: String, app: Application) {
    let start = Instant::now();

    let query_url = {
        let mut url = reqwest::Url::parse(
            app.config
                .cognito_mgmt_url
                .as_ref()
                .expect("auth not configured"),
        )
        .unwrap()
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
            Ok(AuthResponse::Backoff { backoff_secs }) => {
                clock = tokio::time::interval(Duration::from_secs(backoff_secs));
                clock.tick().await;
            }
            Ok(AuthResponse::Success(success)) => {
                break success;
            }
            Ok(AuthResponse::Error { error }) => {
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

    let saved = app
        .config
        .source
        .save_credentials(&app.credentials.serialize().await);

    if let Err(err) = saved {
        error!(?err, "failed to save credentials to disk");
    }

    debug!("github auth complete");
}
