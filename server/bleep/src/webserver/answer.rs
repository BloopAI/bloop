use axum::{extract::Query, response::IntoResponse, Extension, Json};
use utoipa::ToSchema;

use crate::Application;

use super::ErrorKind;

/// Mirrored from `answer_api/lib.rs` to avoid private dependency.
mod api {
    #[derive(Debug, serde::Serialize, serde::Deserialize)]
    pub struct Request {
        pub query: String,
        pub snippets: Vec<Snippet>,
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
    pub struct Snippet {
        pub lang: String,
        pub repo_name: String,
        pub relative_path: String,
        pub text: String,
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize)]
    pub struct Response {
        pub index: u32,
        pub answer: String,
    }
}

fn default_limit() -> u64 {
    10
}

#[derive(Debug, serde::Deserialize)]
pub struct Params {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: u64,
}

#[derive(serde::Serialize, ToSchema)]
pub struct AnswerResponse {
    pub snippets: Vec<api::Snippet>,
    pub selection: api::Response,
}

pub async fn handle(
    Query(params): Query<Params>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    let snippets = app
        .semantic
        .search(&params.q, params.limit)
        .await
        .map_err(|e| super::error(ErrorKind::Internal, e.to_string()))?
        .into_iter()
        .map(|mut s| {
            use qdrant_client::qdrant::{value::Kind, Value};

            fn value_to_string(value: Value) -> String {
                match value.kind.unwrap() {
                    Kind::StringValue(s) => s,
                    _ => panic!("got non-string value"),
                }
            }

            api::Snippet {
                lang: value_to_string(s.remove("lang").unwrap()),
                repo_name: value_to_string(s.remove("repo_name").unwrap()),
                relative_path: value_to_string(s.remove("relative_path").unwrap()),
                text: value_to_string(s.remove("snippet").unwrap()),
            }
        })
        .collect::<Vec<_>>();

    let res = reqwest::Client::new()
        .post(format!("{}/q", app.config.answer_api_base))
        .json(&api::Request {
            query: params.q,
            snippets: snippets.clone(),
        })
        .send()
        .await
        .map_err(|e| {
            super::error(
                ErrorKind::Internal,
                format!("failed to make request to answer API: {}", e),
            )
        })?;

    Ok::<_, Json<super::Response<'static>>>(Json(super::Response::Answer(AnswerResponse {
        snippets,
        selection: res.json().await.map_err(|e| {
            super::error(
                ErrorKind::Internal,
                format!("answer API was not able to create a valid result: {}", e),
            )
        })?,
    })))
}
