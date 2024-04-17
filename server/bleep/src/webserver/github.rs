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
//use axum::Json;
use serde_json::json;
use axum::{extract::Query, response::IntoResponse, Json};
use serde::Deserialize;
use reqwest::header::ACCEPT;
use std::collections::HashMap;
use axum::response::Redirect;
use crate::remotes::CognitoGithubTokenBundle;

#[derive(serde::Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

/// Connect to Github through Cognito & OAuth

pub(super) async fn login(Extension(app): Extension<Application>) -> impl IntoResponse {
    println!("{:?}", app.config.cognito_auth_url);
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
    println!("login redirect to: {}", url);
    json(AuthResponse::AuthenticationNeeded { url })
}
// pub(super) async fn login(Json(LoginRequest { username, password }): Json<LoginRequest>) -> impl IntoResponse {
//     // 不进行用户名和密码的校验，直接返回登录成功
//     println!("login request: username: {}, password: {}", username, password);
//     // let response = json!({
//     //     "status": "success",
//     //     "message": "Logged in successfully"
//     // });
//     //return Ok(Json(response));
//     let url = "www.github.com";
//     println!("redirect to: {}", url);
//     return json(AuthResponse::AuthenticationNeeded { url: url.to_string() });
// }

#[derive(Deserialize)]
pub struct CallbackQuery {
    code: String,
}

pub async fn callback(Query(query): Query<CallbackQuery>, State(app): State<Application>) -> Redirect {
    let access_token = match get_access_token(&query.code).await {
        Ok(token) => token,
        Err(err) => {
            error!(?err, "Failed to exchange code for access token");
            // return Json(json!({"status": "error", "message": "Failed to exchange code for access token"}));
            return Redirect::to("/error?message=Failed to exchange code for access token");
        }
    };
    println!("github callback access_token: {}", access_token);

    // 这里可以处理获取到的访问令牌，例如存储在数据库中
    // Create a CognitoGithubTokenBundle instance
    let token_bundle = CognitoGithubTokenBundle {
        access_token: String::from("access_token") ,
        refresh_token: String::from("refresh_token"), // Replace with your actual refresh token
        github_access_token: access_token.clone()// Replace with your actual Github access token
    };

    // Set the credentials
    app.credentials.set_github(github::Auth::OAuth(token_bundle));
    debug!("github auth complete");
    crate::periodic::validate_github_credentials(&app).await;
    debug!("github auth validate_github_credentials complete");
    crate::periodic::update_repo_list(&app).await;
    debug!("github auth update_repo_list complete");

    // let cookie = CookieBuilder::new("access_token", access_token)
    //     .path("/")
    //     .secure(true)
    //     .http_only(true)
    //     .finish();

    // 重定向到客户端页面，并附带访问令牌作为查询参数
    let redirect_url = format!("http://localhost:5173?access_token={}", access_token);
    println!("github callback redirect to: {}", redirect_url);
    //axum::response::Redirect::temporary(&*redirect_url)
    // Redirect::to(&format!(
    //     "http://localhost?access_token={}",
    //     access_token
    // ))

    Redirect::to(&redirect_url)
}

async fn get_access_token(code: &str) -> Result<String, Error> {
    let url = "https://github.com/login/oauth/access_token";
    let mut params = HashMap::new();
    params.insert("client_id", "e5f8d6f79aa8b809b292");
    params.insert("client_secret", "e573ce7ad2433aec57629d1c4a8004ca37f5b68d");
    params.insert("code", code);
    params.insert("redirect_uri", "https://91e3-1-170-194-235.ngrok-free.app/api/auth/callback" );//"https://9014-121-35-244-66.ngrok-free.app/api/auth/callback");
    println!("get_access_token params: {:?}", params);

    let client = reqwest::Client::new();
    let response = client.post(url)
        .json(&params)
        .header(ACCEPT, "application/json")
        .send()
        .await?;

    if response.status().is_success() {
        let data: HashMap<String, String> = response.json().await?;
        if let Some(access_token) = data.get("access_token") {
            Ok(access_token.clone())
        } else {
            Err(Error::new(ErrorKind::Internal, "No access token in response"))
        }
    } else {
        Err(Error::new(ErrorKind::Internal, "Failed to get access token"))
    }
}

/// Remove Github OAuth credentials
//
pub(super) async fn logout(
    Extension(user): Extension<User>,
    State(app): State<Application>,
) -> impl IntoResponse {
    if let Some(login) = user.username() {
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
                warn!(?err, "github authorization query failed");
                clock.tick().await;
                continue;
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
    crate::periodic::validate_github_credentials(&app).await;
    crate::periodic::update_repo_list(&app).await;

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

    let user = app.user().await;

    app.with_analytics(|analytics| {
        use rudderanalytics::message::{Identify, Message};
        analytics.send(Message::Identify(Identify {
            user_id: Some(tracking_id.clone()),
            traits: Some(serde_json::json!({
                "org_name": user.org_name(),
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
