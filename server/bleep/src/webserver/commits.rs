use crate::{commits::Question, repo::RepoRef, Application};
use anyhow::Context;
use axum::{extract::State, Json};

use super::prelude::*;

#[derive(Debug, serde::Deserialize)]
pub(super) struct Params {
    pub repo_ref: RepoRef,
}

#[derive(serde::Serialize)]
pub(super) struct TutorialQuestionsResponse {
    questions: Vec<Question>,
}

impl super::ApiResponse for TutorialQuestionsResponse {}

pub(super) async fn tutorial_questions<'a>(
    Query(Params { repo_ref }): Query<Params>,
    State(app): State<Application>,
) -> Result<Json<super::Response<'a>>, Error> {
    let repo_str = repo_ref.to_string();
    let questions = sqlx::query_as!(
        Question,
        "SELECT question, tag FROM tutorial_questions \
         WHERE repo_ref = ?",
        repo_str
    )
    .fetch_all(app.sql.as_ref())
    .await
    .context("database error")?;

    Ok(json(TutorialQuestionsResponse { questions }))
}
