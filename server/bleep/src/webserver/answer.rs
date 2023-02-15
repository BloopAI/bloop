use axum::{extract::Query, response::IntoResponse, Extension, Json};
use reqwest::StatusCode;
use utoipa::ToSchema;

use crate::{answer::AnswerError, Application};

fn default_limit() -> u64 {
    13
}

fn default_user_id() -> String {
    String::from("test_user")
}

#[derive(Debug, serde::Deserialize)]
pub struct Params {
    /// the query text
    pub q: String,
    /// currently unused (?)
    #[serde(default = "default_limit")]
    pub limit: u64,
    /// the user querying
    #[serde(default = "default_user_id")]
    pub user_id: String,
}

#[derive(serde::Serialize, ToSchema)]
pub struct AnswerResponse {
    pub user_id: String,
    pub query_id: uuid::Uuid,
    pub snippets: Vec<crate::answer::Snippet>,
    pub selection: AnswerApiResponse,
}

/// Mirrored from `answer_api/lib.rs` to avoid private dependency.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct AnswerApiResponse {
    pub answer: String,
    pub answer_path: String,
}

impl IntoResponse for AnswerError {
    fn into_response(self) -> axum::response::Response {
        match self {
            AnswerError::Configuration(msg) => {
                (StatusCode::INTERNAL_SERVER_ERROR, msg).into_response()
            }
            AnswerError::User(msg) => (StatusCode::BAD_REQUEST, msg).into_response(),
            AnswerError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg).into_response(),
            AnswerError::UpstreamService(api_error) => {
                (StatusCode::INTERNAL_SERVER_ERROR, api_error.to_string()).into_response()
            }
        }
    }
}

pub async fn handle(
    Query(params): Query<Params>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    let query_id = uuid::Uuid::new_v4();
    let (snippets, snippet_explanation) =
        crate::answer::answer(&params.q, &params.user_id, params.limit, app, query_id).await?;

    // answering snippet is always at index 0
    let answer_path = snippets.get(0).unwrap().relative_path.to_string();

    Ok::<Json<super::Response<'static>>, AnswerError>(Json(super::Response::Answer(
        AnswerResponse {
            snippets,
            query_id,
            user_id: params.user_id,
            selection: AnswerApiResponse {
                answer: snippet_explanation,
                answer_path,
            },
        },
    )))
}

// This endpoint returns the prior conversation for debugging purposes
// TODO: This does not check any authentication, it just takes the user ID
pub async fn get_conversation(
    Query(user_id): Query<String>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    Ok::<String, StatusCode>(
        app.prior_conversation_store
            .with_prior_conversation(&user_id, |c| {
                c.iter()
                    .map(|c| c.to_string())
                    .collect::<Vec<_>>()
                    .join("\n===\n")
            })
            .unwrap_or(String::new()),
    )
}

// This endpoint purges the prior conversation for this user.
// TODO: This does not check any authentication, it just takes the user ID
pub async fn reset_conversation(
    Query(user_id): Query<String>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    app.prior_conversation_store
        .purge_prior_conversation(&user_id);
    Ok::<_, StatusCode>(StatusCode::FOUND)
}
