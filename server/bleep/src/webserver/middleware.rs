use super::{aaa, prelude::*};
use crate::{llm_gateway, Application};

use anyhow::{bail, Context};
use axum::{
    extract::State,
    http::Request,
    middleware::{from_fn, from_fn_with_state, Next},
    response::Response,
};
use axum_extra::extract::CookieJar;
use jwt_authorizer::JwtClaims;
use regex_syntax::ast::print;
use sentry::{Hub, SentryFutureExt};
use tracing::error;

#[derive(Serialize, Clone)]
pub enum User {
    Unknown,
    Desktop {
        access_token: String,
        login: String,
        #[serde(skip)]
        crab: Arc<dyn Fn() -> anyhow::Result<octocrab::Octocrab> + Send + Sync>,
    },
    Cloud {
        org_name: String,
        access_token: String,
        login: String,
        #[serde(skip)]
        crab: Arc<dyn Fn() -> anyhow::Result<octocrab::Octocrab> + Send + Sync>,
    },
}

impl User {
    pub fn username(&self) -> Option<&str> {
        match self {
            User::Desktop { login, .. } => Some(login),
            User::Cloud { login, .. } => Some(login),
            _ => None,
        }
    }

    pub(crate) fn org_name(&self) -> Option<&str> {
        let User::Cloud { org_name, .. } = self else {
            return None;
        };

        Some(org_name.as_ref())
    }

    pub(crate) fn github_client(&self) -> Option<octocrab::Octocrab> {
        let crab = match self {
            User::Unknown => return None,
            User::Desktop { crab, .. } => crab,
            User::Cloud { crab, .. } => crab,
        };

        crab().ok()
    }

    pub(crate) fn access_token(&self) -> Option<&str> {
        match self {
            User::Unknown => None,
            User::Desktop { access_token, .. } => Some(access_token),
            User::Cloud { access_token, .. } => Some(access_token),
        }
    }

    pub(crate) async fn llm_gateway(
        &self,
        app: &Application,
    ) -> anyhow::Result<llm_gateway::Client> {

        println!("llm_gateway");
        if let User::Unknown = self {
            bail!("user unauthenticated");
        }

        let access_token = self.access_token().map(str::to_owned);
        let access_token = Some("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".to_owned());
        println!("llm_gateway access_token: {:?}", access_token);
        Ok(llm_gateway::Client::new(app.clone()).bearer(access_token))
    }

    pub(crate) async fn paid_features(&self, app: &Application) -> bool {
        let access_token = match self {
            User::Desktop { access_token, .. } => access_token,
            User::Cloud { .. } => return true,
            _ => return false,
        };

        let Ok(response) = reqwest::Client::new()
            .get(format!("{}/v2/get-usage-quota", app.config.answer_api_url))
            .bearer_auth(access_token)
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
    let username = user.username().map(str::to_owned);

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
    request.extensions_mut().insert(app.user().await);
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

        let org_name = app
            .credentials
            .github()
            .and_then(|state| match state.auth {
                crate::remotes::github::Auth::App { org, .. } => Some(org),
                _ => None,
            })
            .expect("misconfigured instance");

        User::Cloud {
            login,
            org_name,
            // not doing an `ok()` here to ensure this exists, or blow up
            access_token: jar.get(super::aaa::COOKIE_NAME).unwrap().to_string(),
            crab: Arc::new(move || {
                let gh = app.credentials.github().context("no github")?;
                Ok(gh.client()?)
            }),
        }
    });

    next.run(request).await
}
