use axum::{Extension, Json};
use reqwest::StatusCode;
use secrecy::ExposeSecret;

use crate::Application;

use super::Error;

#[derive(serde::Deserialize, serde::Serialize)]
pub struct QuotaResponse {
    paid: bool,
    used: String,
}

pub async fn get(app: Extension<Application>) -> super::Result<Json<QuotaResponse>> {
    let answer_api_token = app
        .answer_api_token()
        .map_err(|e| Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .ok_or_else(|| Error::unauthorized("answer API token was not present"))
        .map(|s| s.expose_secret().to_owned())?;

    reqwest::Client::new()
        .get(format!("{}/v2/get-usage-quota", app.config.answer_api_url))
        .bearer_auth(answer_api_token)
        .send()
        .await
        .map_err(Error::internal)?
        .json()
        .await
        .map_err(Error::internal)
        .map(Json)
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct SubscriptionResponse {
    url: String,
}

pub async fn create_checkout_session(
    app: Extension<Application>,
) -> super::Result<Json<SubscriptionResponse>> {
    let answer_api_token = app
        .answer_api_token()
        .map_err(|e| Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .ok_or_else(|| Error::unauthorized("answer API token was not present"))
        .map(|s| s.expose_secret().to_owned())?;

    reqwest::Client::new()
        .get(format!(
            "{}/v2/create-checkout-session",
            app.config.answer_api_url
        ))
        .bearer_auth(answer_api_token)
        .send()
        .await
        .map_err(Error::internal)?
        .json()
        .await
        .map_err(Error::internal)
        .map(Json)
}
