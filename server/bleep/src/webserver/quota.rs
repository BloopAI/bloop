use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use reqwest::StatusCode;
use serde::Deserialize;
use tracing::error;

use crate::{periodic::sync_github_status_once, Application};

use super::{middleware::User, Error};

#[derive(serde::Deserialize, serde::Serialize)]
pub struct QuotaResponse {
    upgraded: bool,
    used: u32,
    allowed: u32,
    reset_at: DateTime<Utc>,
    #[serde(rename = "isPastDue")]
    is_past_due: bool,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct SubscriptionResponse {
    url: String,
}

pub async fn get(
    app: Extension<Application>,
    user: Extension<User>,
) -> super::Result<Json<QuotaResponse>> {
    match get_request(app, user, "/v2/get-usage-quota").await {
        Ok(result) => Ok(result),
        Err(e) => {
            error!("failed to get usage quota: {}", e);
            Err(e)
        }
    }
}

pub async fn create_checkout_session(
    app: Extension<Application>,
    user: Extension<User>,
) -> super::Result<Json<SubscriptionResponse>> {
    match get_request(app, user, "/v2/create-checkout-session").await {
        Ok(result) => Ok(result),
        Err(e) => {
            error!("failed to create checkout session: {}", e);
            Err(e)
        }
    }
}

async fn get_request<T: for<'a> Deserialize<'a>>(
    app: Extension<Application>,
    Extension(user): Extension<User>,
    endpoint: &str,
) -> super::Result<Json<T>> {
    const MAX_RETRIES: usize = 5;

    let Some(api_token) = user.access_token() else {
        return Err(Error::unauthorized("answer API token was not present"));
    };

    for _ in 0..MAX_RETRIES {
        let response = reqwest::Client::new()
            .get(format!("{}{}", app.config.answer_api_url, endpoint))
            .bearer_auth(api_token)
            .send()
            .await
            .map_err(Error::internal)?;

        if response.status().is_success() {
            let body = response.text().await.map_err(Error::internal)?;
            return match serde_json::from_str::<T>(&body) {
                Ok(t) => Ok(Json(t)),
                Err(_) => Err(Error::internal(format!(
                    "quota call return invalid JSON: {body}"
                ))),
            };
        } else if response.status() == StatusCode::UNAUTHORIZED {
            sync_github_status_once(&app).await;
            continue;
        } else {
            let status = response.status();
            return match response.text().await {
                Ok(body) if !body.is_empty() => Err(Error::internal(format!(
                    "request failed with status code {status}: {body}",
                ))),
                Ok(_) => Err(Error::internal(format!(
                    "request failed with status code {status}, response had no body",
                ))),
                Err(_) => Err(Error::internal(format!(
                    "request failed with status code {status}, failed to retrieve response body",
                ))),
            };
        }
    }

    Err(Error::internal(
        "failed to make quota request, potentially failed authorization?",
    ))
}
