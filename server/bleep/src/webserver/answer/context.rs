use anyhow::Result;
use secrecy::ExposeSecret;
use tracing::debug;
use uuid::Uuid;

use crate::{
    analytics::{EventData, QueryEvent},
    indexes::reader::ContentDocument,
    query::parser::{self, ParsedQuery, SemanticQuery},
    repo::RepoRef,
    semantic::Payload,
    webserver::middleware::User,
    Application,
};

use super::llm_gateway;

#[derive(Clone)]
pub(super) struct AppContext {
    pub(super) app: Application,
    pub(super) llm_gateway: llm_gateway::Client,
    pub(super) user: User,
    pub(super) query_id: Uuid,
    pub(super) thread_id: Uuid,

    pub(super) repo_ref: RepoRef,
    pub(super) branch: Option<String>,
    query: String,

    /// Indicate whether the request was answered.
    ///
    /// This is used in the `Drop` handler, in order to track cancelled answer queries.
    pub(super) req_complete: bool,
}

impl AppContext {
    pub(super) fn new(
        app: Application,
        user: User,
        params: super::Params,
        query_id: Uuid,
    ) -> Result<Self> {
        let super::Params {
            q,
            repo_ref,
            thread_id,
        } = params;

        let llm_gateway = llm_gateway::Client::new(&app.config.answer_api_url)
            .temperature(0.0)
            .bearer(app.github_token()?.map(|s| s.expose_secret().clone()));

        let branch = if let Ok(ParsedQuery::Semantic(parsed)) = parser::parse_nl(&q) {
            parsed.branch.iter().next().map(|b| b.unwrap().to_string())
        } else {
            None
        };

        Ok(Self {
            app,
            llm_gateway,
            user,
            repo_ref,
            branch,
            query_id,
            thread_id,
            query: q,
            req_complete: false,
        })
    }

    fn semantic_query_params(&self) -> SemanticQuery<'_> {
        let Ok(ParsedQuery::Semantic(mut parsed)) = parser::parse_nl(&self.query)
	    else {
		return SemanticQuery {
		    ..SemanticQuery::default()
		};
            };

        parsed.target = None;
        parsed
    }

    pub(super) fn model(mut self, model: &str) -> Self {
        if model.is_empty() {
            self.llm_gateway.model = None;
        } else {
            self.llm_gateway.model = Some(model.to_owned());
        }

        self
    }

    pub(super) fn track_query(&self, data: EventData) {
        let event = QueryEvent {
            query_id: self.query_id,
            thread_id: self.thread_id,
            repo_ref: Some(self.repo_ref.clone()),
            data,
        };
        self.app.track_query(&self.user, &event);
    }

    pub(super) async fn semantic_search(
        &self,
        query: parser::Literal<'_>,
        limit: u64,
        offset: u64,
        retrieve_more: bool,
    ) -> Result<Vec<Payload>> {
        let query = SemanticQuery {
            target: Some(query),
            ..self.semantic_query_params()
        };

        debug!(?query, "executing semantic query");
        self.app
            .semantic
            .as_ref()
            .unwrap()
            .search(&query, limit, offset, retrieve_more)
            .await
    }

    pub(super) async fn file_search(&self, path: &str) -> Result<ContentDocument> {
        let branch = self.branch.as_deref();
        let repo_ref = &self.repo_ref;

        debug!(%repo_ref, path, ?branch, "executing file search");
        self.app.indexes.file.by_path(repo_ref, path, branch).await
    }
}

impl Drop for AppContext {
    fn drop(&mut self) {
        if !self.req_complete {
            self.track_query(
                EventData::output_stage("cancelled")
                    .with_payload("message", "request was cancelled"),
            );
        }
    }
}
