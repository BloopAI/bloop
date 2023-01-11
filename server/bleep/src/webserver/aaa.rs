use super::*;
use axum::{
    body::{self, boxed},
    extract::Path,
    http::{self, header::AUTHORIZATION, Error, Request, Response, StatusCode},
};
use tower_http::auth::{AuthorizeRequest, RequireAuthorizationLayer};

#[derive(Clone, Copy)]
pub(super) struct MyAuth;

#[derive(Debug)]
struct UserId(String);

impl<B> AuthorizeRequest<B> for MyAuth {
    type ResponseBody = body::BoxBody;

    fn authorize(&mut self, request: &mut Request<B>) -> Result<(), Response<Self::ResponseBody>> {
        if let Some(user_id) = check_auth(request) {
            // Set `user_id` as a request extension so it can be accessed by other
            // services down the stack.
            request.extensions_mut().insert(user_id);

            Ok(())
        } else {
            let unauthorized_response = Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .body(boxed(body::Empty::new()))
                .unwrap();

            Err(unauthorized_response)
        }
    }
}

fn check_auth<B>(request: &Request<B>) -> Option<UserId> {
    // ...
    None
}

/// Initiate a new login using a web-based OAuth flow
#[utoipa::path(get, path = "/auth/login",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn login(Extension(app): Extension<Application>) -> impl IntoResponse {
    todo!()
}

/// Complete the login flow. Can only be called by the `auth_server` daemon
#[utoipa::path(post, path = "/auth/authorized",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn authorized(Extension(app): Extension<Application>) -> impl IntoResponse {
    todo!()
}

/// List all users in the organization (admin only)
#[utoipa::path(get, path = "/auth/users",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn list_users(Extension(app): Extension<Application>) -> impl IntoResponse {
    todo!()
}

/// Set user permissions & details (admin only)
#[utoipa::path(put, path = "/auth/users/:user",
    responses(
        (status = 200, description = "Execute query successfully", body = Response),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn set_user(
    Path(user): Path<String>,
    Extension(app): Extension<Application>,
) -> impl IntoResponse {
    todo!()
}
