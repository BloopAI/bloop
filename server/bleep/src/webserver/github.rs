use super::prelude::*;
use crate::{repo::Backend, Application};

use either::Either;
use octocrab::{auth::DeviceCodes, Octocrab};
use reqwest::header::ACCEPT;
use secrecy::SecretString;
use tracing::{debug, error, warn};

use std::time::{Duration, Instant};

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum GithubResponse {
    AuthenticationNeeded { url: String, code: String },
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
    (
        StatusCode::OK,
        json(GithubResponse::Status(
            app.credentials
                .github()
                .map(|_| GithubCredentialStatus::Ok)
                .unwrap_or(GithubCredentialStatus::Missing),
        )),
    )
}

/// Connect to Github through OAuth Device Flow
//
pub(super) async fn login(Extension(app): Extension<Application>) -> impl IntoResponse {
    let client_id = match app.config.github_client_id.as_ref() {
        Some(id) => id.clone(),
        None => {
            return Err(
                Error::new(ErrorKind::Configuration, "Github Client ID not available")
                    .with_status(StatusCode::SERVICE_UNAVAILABLE),
            );
        }
    };

    let github = octocrab::Octocrab::builder()
        .base_uri("https://github.com/")
        .unwrap()
        .add_header(ACCEPT, "application/json".to_string())
        .build()
        .map_err(|_| Error::internal("failed to build octocrab client"))?;

    let codes = github
        .authenticate_as_device(&client_id, ["public_repo", "repo", "read:org"])
        .await
        .map_err(|_| Error::internal("failed to authenticate as device"))?;

    tokio::spawn(poll_for_oauth_token(
        github,
        client_id,
        codes.clone(),
        app.clone(),
    ));

    Ok(json(GithubResponse::AuthenticationNeeded {
        url: codes.verification_uri,
        code: codes.user_code,
    }))
}

/// Remove Github OAuth credentials
//
pub(super) async fn logout(Extension(app): Extension<Application>) -> impl IntoResponse {
    let deleted = app.credentials.remove(&Backend::Github).is_some();
    if deleted {
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

async fn poll_for_oauth_token(
    github: Octocrab,
    client_id: SecretString,
    codes: DeviceCodes,
    app: Application,
) {
    let start = Instant::now();

    let mut interval = Duration::from_secs(codes.interval);
    let mut clock = tokio::time::interval(interval);

    debug!(?interval, "github auth started");

    let auth = loop {
        clock.tick().await;

        if Instant::now().duration_since(start) > Duration::from_secs(600) {
            error!("github authorization timed out!");
            return;
        }

        match codes.poll_once(&github, &client_id).await {
            Ok(Either::Left(auth)) => break auth,
            Ok(Either::Right(cont)) => match cont {
                octocrab::auth::Continue::SlowDown => {
                    // We were request to slow down. We add one second to the polling
                    // duration.
                    interval += Duration::from_secs(5);
                    debug!(?interval, "slowing down polling");

                    clock = tokio::time::interval(interval);
                    clock.tick().await;
                }
                octocrab::auth::Continue::AuthorizationPending => {
                    debug!(?interval, "waiting for user");
                    // The user has not clicked authorize yet, but nothing has gone wrong.
                    // We keep polling.
                }
            },
            Err(err) => {
                warn!(?err, "github authorization failed");
                return;
            }
        }
    };

    debug!("acquired credentials");
    app.credentials.set_github(auth.into());

    let saved = app
        .config
        .source
        .save_credentials(&app.credentials.serialize().await);

    if let Err(err) = saved {
        error!(?err, "failed to save credentials to disk");
    }

    debug!("github auth complete");
}
