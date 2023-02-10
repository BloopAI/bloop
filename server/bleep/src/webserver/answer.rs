use std::collections::HashMap;

use axum::{extract::Query, response::IntoResponse, Extension, Json};
use reqwest::StatusCode;
use thiserror::Error;
use tracing::{debug, error, info, warn};
use utoipa::ToSchema;

use crate::{
    analytics::QueryEvent, indexes::reader::ContentDocument, query::parser, semantic::Semantic,
    state::RepoRef, Application,
};

use super::ErrorKind;

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
    pub selection: api::Response,
}

/// Mirrored from `answer_api/lib.rs` to avoid private dependency.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct AnswerApiResponse {
    pub answer: String,
    pub answer_path: String,
}

pub async fn handle(
    Query(params): Query<Params>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    let query_id = uuid::Uuid::new_v4();
    let (snippets, snippet_explanation) = crate::answer::answer(
        &params.q,
        &params.user_id,
        params.limit as usize,
        app,
        query_id,
    )?;
    // answering snippet is always at index 0
    let answer_path = snippets.get(0).unwrap().relative_path.to_string();

    Ok::<_, Json<super::Response<'static>>>(Json(super::Response::Answer(AnswerResponse {
        snippets,
        query_id,
        user_id: params.user_id,
        selection: AnswerApiResponse {
            answer: snippet_explanation,
            answer_path,
        },
    })))
}
