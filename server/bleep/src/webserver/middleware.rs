use super::prelude::*;
use crate::Application;

use axum::{
    extract::State,
    http::Request,
    middleware::{from_fn_with_state, Next},
    response::Response,
};

#[derive(Clone)]
pub struct User(pub Option<String>);

pub fn local_user(router: Router, app: Application) -> Router {
    router.layer(from_fn_with_state(app, local_user_mw))
}

async fn local_user_mw<B>(
    State(app): State<Application>,
    mut request: Request<B>,
    next: Next<B>,
) -> Response {
    request
        .extensions_mut()
        .insert(User(app.credentials.user().await));

    next.run(request).await
}
