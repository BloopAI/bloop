use super::prelude::*;
use crate::Application;

use anyhow::{bail, Context};
use axum::{
    extract::State,
    http::Request,
    middleware::{from_fn, from_fn_with_state, Next},
    response::Response,
};
use sentry::{Hub, SentryFutureExt};

#[derive(Clone)]
pub enum User {
    Unknown,
    Authenticated {
        login: String,
        crab: Arc<dyn Fn() -> anyhow::Result<octocrab::Octocrab> + Send + Sync>,
    },
}

impl User {
    pub fn authenticated_without_upstream(login: String) -> Self {
        User::Authenticated {
            login,
            crab: Arc::new(|| bail!("no upstream")),
        }
    }

    pub(crate) fn login(&self) -> Option<&str> {
        let User::Authenticated { login, .. }= self
	else {
	    return None;
	};

        Some(login)
    }

    pub(crate) fn github(&self) -> Option<octocrab::Octocrab> {
        let User::Authenticated { crab, .. }= self
	else {
	    return None;
	};

        crab().ok()
    }
}

impl From<String> for User {
    fn from(value: String) -> Self {
        User::authenticated_without_upstream(value)
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
        app.clone()
            .credentials
            .user()
            .map(|user| User::Authenticated {
                login: user,
                crab: Arc::new(move || {
                    let gh = app.credentials.github().context("no github")?;
                    Ok(gh.client()?)
                }),
            })
            .unwrap_or_else(|| User::Unknown),
    );

    next.run(request).await
}
