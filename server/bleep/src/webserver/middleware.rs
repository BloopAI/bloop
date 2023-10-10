use super::{aaa, prelude::*};
use crate::{remotes::CognitoGithubTokenBundle, Application};

use anyhow::Context;
use axum::{
    extract::State,
    http::Request,
    middleware::{from_fn, from_fn_with_state, Next},
    response::Response,
};
use axum_extra::extract::CookieJar;
use jwt_authorizer::JwtClaims;
use sentry::{Hub, SentryFutureExt};
use tracing::error;

#[derive(Serialize, Clone)]
pub enum User {
    Unknown,
    Authenticated {
        login: String,
        api_token: String,
        #[serde(skip)]
        crab: Arc<dyn Fn() -> anyhow::Result<octocrab::Octocrab> + Send + Sync>,
    },
}

impl User {
    pub(crate) fn login(&self) -> Option<&str> {
        let User::Authenticated { login, .. } = self
	else {
	    return None;
	};

        Some(login)
    }

    pub(crate) fn github(&self) -> Option<octocrab::Octocrab> {
        let User::Authenticated { crab, .. } = self
	else {
	    return None;
	};

        crab().ok()
    }

    pub(crate) async fn paid_features(&self, app: &Application) -> bool {
        let User::Authenticated { api_token, ..} = self
        else {
	    return false;
        };

        let Ok(response) = reqwest::Client::new()
            .get(format!("{}/v2/get-usage-quota", app.config.answer_api_url))
            .bearer_auth(api_token)
            .send()
            .await
	else {
	    error!("failed to get quota for user");
	    return false;
	};

        if response.status().is_success() {
            let response: serde_json::Value =
                response.json().await.expect("answer_api proto bad or down");

            response
                .get("upgraded")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or_default()
        } else {
            let status = response.status();
            match response.text().await {
                Ok(body) if !body.is_empty() => {
                    error!(?status, ?body, "request failed with status code")
                }
                Ok(_) => error!(?status, "request failed; response had no body"),
                Err(err) => error!(
                    ?status,
                    ?err,
                    "request failed; failed to retrieve response body",
                ),
            }

            false
        }
    }
}

pub fn sentry_layer(router: Router) -> Router {
    router.layer(from_fn(sentry_layer_mw))
}

async fn sentry_layer_mw<B>(
    Extension(user): Extension<User>,
    request: Request<B>,
    next: Next<B>,
) -> Response {
    let hub = Hub::with(|hub| Hub::new_from_top(hub));
    let username = user.login().map(str::to_owned);

    hub.configure_scope(move |scope| {
        scope.add_event_processor(move |mut event| {
            event.user.get_or_insert_with(Default::default).username = username.clone();
            Some(event)
        })
    });

    next.run(request).bind_hub(hub).await
}

pub fn local_user(router: Router, app: Application) -> Router {
    router.layer(from_fn_with_state(app, local_user_mw))
}

async fn local_user_mw<B>(
    State(app): State<Application>,
    mut request: Request<B>,
    next: Next<B>,
) -> Response {
    request.extensions_mut().insert(
        app.credentials
            .user()
            .zip(app.credentials.github())
            .map(|(user, gh)| {
                use crate::remotes::github::{Auth, State};
                let api_token = match gh {
                    State {
                        auth:
                            Auth::OAuth(CognitoGithubTokenBundle {
                                access_token: ref token,
                                ..
                            }),
                        ..
                    } => token.clone(),
                    _ => {
                        panic!("invalid configuration");
                    }
                };

                User::Authenticated {
                    api_token,
                    login: user,
                    crab: Arc::new(move || Ok(gh.client()?)),
                }
            })
            .unwrap_or_else(|| User::Unknown),
    );

    next.run(request).await
}

pub async fn cloud_user_layer_mw<B>(
    JwtClaims(claims): JwtClaims<aaa::TokenClaims>,
    State(app): State<Application>,
    jar: CookieJar,
    mut request: Request<B>,
    next: Next<B>,
) -> Response {
    request.extensions_mut().insert({
        let login = app
            .user_profiles
            .read(&claims.sub, |_, v| v.username.clone())
            .flatten()
            .unwrap_or_default();

        User::Authenticated {
            login,
            api_token: jar.get(super::aaa::COOKIE_NAME).unwrap().to_string(),
            crab: Arc::new(move || {
                let gh = app.credentials.github().context("no github")?;
                Ok(gh.client()?)
            }),
        }
    });

    next.run(request).await
}
