use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::Application;

use super::{middleware::User, Error};

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

pub async fn get(
    app: Extension<Application>,
    user: Extension<User>,
) -> super::Result<Json<QuotaResponse>> {
    get_request(app, user, "/v2/get-usage-quota").await
}

pub async fn create_checkout_session(
    app: Extension<Application>,
    user: Extension<User>,
) -> super::Result<Json<SubscriptionResponse>> {
    get_request(app, user, "/v2/create-checkout-session").await
}

async fn get_request<T: for<'a> Deserialize<'a>>(
    app: Extension<Application>,
    Extension(user): Extension<User>,
    endpoint: &str,
) -> super::Result<Json<T>> {
    let User::Authenticated {
        api_token: Some(api_token),
        ..
    } = user
    else {
        return Err(Error::unauthorized("answer API token was not present"));
    };

    let response = reqwest::Client::new()
        .get(format!("{}{}", app.config.answer_api_url, endpoint))
        .bearer_auth(api_token)
        .send()
        .await
        .map_err(Error::internal)?;

    if response.status().is_success() {
        response.json().await.map_err(Error::internal).map(Json)
    } else {
        let status = response.status();
        match response.text().await {
            Ok(body) if !body.is_empty() => Err(Error::internal(format!(
                "request failed with status code {status}: {body}",
            ))),
            Ok(_) => Err(Error::internal(format!(
                "request failed with status code {status}, response had no body",
            ))),
            Err(_) => Err(Error::internal(format!(
                "request failed with status code {status}, failed to retrieve response body",
            ))),
        }
    }
}
