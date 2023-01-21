use super::{prelude::*, repos::Repo};
use crate::{remotes::{BackendCredential, self}, state::Backend, Application};

use either::Either;
use octocrab::{auth::DeviceCodes, Octocrab};
use reqwest::header::ACCEPT;
use secrecy::SecretString;
use tracing::{error, warn};

use std::time::{Duration, Instant};

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub(super) enum GithubResponse {
    AuthenticationNeeded { url: String, code: String },
    Status(GithubCredentialStatus),
}

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub(super) enum GithubCredentialStatus {
    Ok,
    Missing,
}

/// Get the status of the Github OAuth authentication
//
#[utoipa::path(get, path = "/remotes/github/status",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn status(Extension(app): Extension<Application>) -> impl IntoResponse {
    (
        StatusCode::OK,
        json(GithubResponse::Status(
            match app.credentials.get(&Backend::Github) {
                Some(_) => GithubCredentialStatus::Ok,
                None => GithubCredentialStatus::Missing,
            },
        )),
    )
}

/// Connect to Github through OAuth Device Flow
//
#[utoipa::path(get, path = "/remotes/github/login",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn login(Extension(app): Extension<Application>) -> impl IntoResponse {
    let client_id = match app.config.github_client_id.as_ref() {
        Some(id) => id.clone(),
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                error(ErrorKind::Configuration, "Github Client ID not available"),
            )
        }
    };

    let github = octocrab::Octocrab::builder()
        .base_url("https://github.com")
        .unwrap()
        .add_header(ACCEPT, "application/json".to_string())
        .build()
        .unwrap();

    let codes = github
        .authenticate_as_device(&client_id, ["public_repo", "repo", "read:org"])
        .await
        .unwrap();

    tokio::spawn(poll_for_oauth_token(
        github,
        client_id,
        codes.clone(),
        app.clone(),
    ));

    (
        StatusCode::OK,
        json(GithubResponse::AuthenticationNeeded {
            url: codes.verification_uri,
            code: codes.user_code,
        }),
    )
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

    let auth = loop {
        clock.tick().await;

        if Instant::now().duration_since(start) > Duration::from_secs(600) {
            error!("Github authorization timed out!");
            return;
        }

        match codes.poll_once(&github, &client_id).await {
            Ok(Either::Left(auth)) => break auth,
            Ok(Either::Right(cont)) => match cont {
                octocrab::auth::Continue::SlowDown => {
                    // We were request to slow down. We add five seconds to the polling
                    // duration.
                    interval += Duration::from_secs(5);
                    clock = tokio::time::interval(interval);
                    // The first tick happens instantly, so we tick that off immediately.
                    clock.tick().await;
                }
                octocrab::auth::Continue::AuthorizationPending => {
                    // The user has not clicked authorize yet, but nothing has gone wrong.
                    // We keep polling.
                }
            },
            Err(err) => {
                warn!(?err, "GitHub authorization failed");
                return;
            }
        }
    };

    app.credentials
        .insert(Backend::Github, BackendCredential::Github(auth.into()));

    let saved = app.config.source.save_credentials(&app.credentials);

    if let Err(err) = saved {
        error!(?err, "Failed to save credentials to disk");
    }
}

pub(super) async fn list_repos(app: Application) -> Result<Vec<Repo>, EndpointError<'static>> {
    let Some(auth) = app.github_auth().await else {
        return Err(EndpointError {
            kind: ErrorKind::Configuration,
            message: "No github authorization".into(),
        });
    };

    let gh_client = auth.client().expect("failed to build github client");

    let mut results = vec![];
    for page in 1.. {
        let mut resp = match auth {
            remotes::github::Auth::OAuth { .. } => gh_client
                .current()
                .list_repos_for_authenticated_user()
                .per_page(100)
                .page(page)
                .send()
                .await,
            remotes::github::Auth::App { ref org, .. } => gh_client
                .orgs(org)
                .list_repos()
                .per_page(100)
                .page(page)
                .send()
                .await,
        }
        .map_err(|err| EndpointError {
            kind: ErrorKind::UpstreamService,
            message: err.to_string().into(),
        })?;

        if resp.items.is_empty() {
            break;
        }

        results.extend(resp.take_items().into_iter().map(|repo| {
            let local_duplicates = app
                .repo_pool
                .iter()
                .filter(|elem| {
                    // either `ssh_url` or `clone_url` should match what we generate.
                    //
                    // also note that this is quite possibly not the
                    // most efficient way of doing this, but the
                    // number of repos should be small, so even n^2
                    // should be fast.
                    //
                    // most of the time is spent in the network.
                    [
                        repo.ssh_url.as_deref().unwrap_or_default().to_lowercase(),
                        repo.clone_url
                            .as_ref()
                            .map(|url| url.as_str())
                            .unwrap_or_default()
                            .to_lowercase(),
                    ]
                    .contains(&elem.remote.to_string().to_lowercase())
                })
                .map(|elem| elem.key().clone())
                .collect();

            Repo::from_github(local_duplicates, repo)
        }))
    }

    Ok(results)
}
