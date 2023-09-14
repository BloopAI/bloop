use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use reqwest::StatusCode;
use secrecy::ExposeSecret;
use serde::Deserialize;

use crate::Application;

use super::Error;

#[derive(serde::Deserialize, serde::Serialize)]
pub struct QuotaResponse {
    upgraded: bool,
    used: u32,
    allowed: u32,
    reset_at: DateTime<Utc>,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct SubscriptionResponse {
    url: String,
}

pub async fn get(app: Extension<Application>) -> super::Result<Json<QuotaResponse>> {
    get_request(app, "/v2/get-usage-quota").await
}

pub async fn create_checkout_session(
    app: Extension<Application>,
) -> super::Result<Json<SubscriptionResponse>> {
    get_request(app, "/v2/create-checkout-session").await
}

async fn get_request<T: for<'a> Deserialize<'a>>(
    app: Extension<Application>,
    endpoint: &str,
) -> super::Result<Json<T>> {
    let answer_api_token = app
        .answer_api_token()
        .map_err(|e| Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .ok_or_else(|| Error::unauthorized("answer API token was not present"))
        .map(|s| s.expose_secret().to_owned())?;

    let response = reqwest::Client::new()
        .get(format!("{}{}", app.config.answer_api_url, endpoint))
        .bearer_auth(answer_api_token)
        .send()
        .await
        .map_err(Error::internal)?;

    if response.status().is_success() {
        response.json().await.map_err(Error::internal).map(Json)
    } else {
        let status = response.status();
        match response.text().await {
            Ok(body) if !body.is_empty() => {
                Err(Error::internal(format!(
                    "request failed with status code {status}: {body}",
                )))
            }
            Ok(_) => Err(Error::internal(format!(
                "request failed with status code {status}, response had no body",
            ))),
            Err(_) => Err(Error::internal(format!(
                "request failed with status code {status}, failed to retrieve response body",
            ))),
        }
    }
}
