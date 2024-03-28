use super::{aaa, prelude::*};
use crate::{llm, Application};

use anyhow::{bail, Context};
use axum::{
    extract::State,
    http::Request,
    middleware::{from_fn_with_state, Next},
    response::Response,
};
use axum_extra::extract::CookieJar;
use jwt_authorizer::JwtClaims;

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

    pub(crate) fn github_client(&self) -> Option<octocrab::Octocrab> {
        let crab = match self {
            User::Unknown => return None,
            User::Desktop { crab, .. } => crab,
            User::Cloud { crab, .. } => crab,
        };

        crab().ok()
    }

    pub(crate) async fn llm_gateway(
        &self,
        app: &Application,
    ) -> anyhow::Result<llm::client::Client> {
        if let User::Unknown = self {
            bail!("user unauthenticated");
        }

        Ok(llm::client::Client::new(app.clone()))
    }
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
