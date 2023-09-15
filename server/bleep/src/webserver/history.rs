use anyhow::Context;
use axum::{extract::State, Json};
use secrecy::ExposeSecret;

use crate::{repo::RepoRef, Application};

use super::prelude::*;

#[derive(Debug, serde::Deserialize)]
pub(super) struct Params {
    pub repo_ref: RepoRef,
    pub branch: Option<String>,
}

#[derive(serde::Serialize)]
pub(super) struct PromptSuggestionResponse {
    suggestions: Vec<crate::history::Question>,
}

impl super::ApiResponse for PromptSuggestionResponse {}

pub(super) async fn prompt_suggestions<'a>(
    Query(Params { repo_ref, branch }): Query<Params>,
    State(app): State<Application>,
) -> Result<Json<super::Response<'a>>, Error> {
    let llm_gateway = {
        let answer_api_token = app
            .answer_api_token()
            .map_err(|e| super::Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
            .map(|s| s.expose_secret().clone());

        crate::llm_gateway::Client::new(&app.config.answer_api_url).bearer(answer_api_token)
    };

    // Due to `Send` issues on the gix side, we need to split this off quite brutally.
    let latest_commits =
        tokio::task::spawn_blocking(|| crate::history::latest_commits(app, repo_ref, branch))
            .await
            .context("threads error")??;

    let suggestions =
        crate::history::expand_commits_to_suggestions(latest_commits, &llm_gateway).await?;

    Ok(json(PromptSuggestionResponse { suggestions }))
}
