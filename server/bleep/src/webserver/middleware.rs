use super::prelude::*;
use crate::{llm, Application};

use anyhow::bail;
use axum::{
    extract::State,
    http::Request,
    middleware::{from_fn_with_state, Next},
    response::Response,
};

#[derive(Serialize, Clone)]
pub enum User {
    Unknown,
    Desktop {
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
            _ => None,
        }
    }

    pub(crate) fn github_client(&self) -> Option<octocrab::Octocrab> {
        let crab = match self {
            User::Unknown => return None,
            User::Desktop { crab, .. } => crab,
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
