use anyhow::Result;
use secrecy::ExposeSecret;
use tracing::debug;
use uuid::Uuid;

use crate::{
    analytics::{EventData, QueryEvent},
    indexes::reader::{ContentDocument, FileDocument},
    query::parser::{self, Literal, ParsedQuery, SemanticQuery},
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
}

impl AppContext {
    pub(super) fn new(
        app: Application,
        user: User,
        params: super::Params,
        query_id: Uuid,
        session_reference_id: String,
    ) -> Result<Self> {
        let super::Params {
            q,
            repo_ref,
            thread_id,
        } = params;

        let llm_gateway = llm_gateway::Client::new(&app.config.answer_api_url)
            .temperature(0.0)
            .bearer(app.github_token()?.map(|s| s.expose_secret().clone()))
            .session_reference_id(session_reference_id);

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
        })
    }

    pub(super) fn frequency_penalty(mut self, frequency_penalty: f32) -> Self {
        self.llm_gateway.frequency_penalty = Some(frequency_penalty);
        self
    }

    #[allow(unused)]
    pub(super) fn presence_penalty(mut self, presence_penalty: f32) -> Self {
        self.llm_gateway.presence_penalty = Some(presence_penalty);
        self
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
        query: Literal<'_>,
        limit: u64,
        offset: u64,
        retrieve_more: bool,
    ) -> Result<Vec<Payload>> {
        let query = SemanticQuery {
            target: Some(query),
            repos: [Literal::Plain(self.repo_ref.display_name().into())].into(),
            ..self.semantic_query_params()
        };

        debug!(?query, %self.thread_id, "executing semantic query");
        self.app
            .semantic
            .as_ref()
            .unwrap()
            .search(&query, limit, offset, retrieve_more)
            .await
    }

    pub(super) async fn batch_search(
        &self,
        query: &[Literal<'_>],
        limit: u64,
        offset: u64,
        retrieve_more: bool,
    ) -> Result<Vec<Payload>> {
        let queries = query
            .iter()
            .map(|query| SemanticQuery {
                target: Some(query.clone()),
                repos: [Literal::Plain(self.repo_ref.display_name().into())].into(),
                ..self.semantic_query_params()
            })
            .collect::<Vec<_>>();

        debug!(?query, %self.thread_id, "executing semantic query");
        self.app
            .semantic
            .as_ref()
            .unwrap()
            .batch_search(
                queries.iter().collect::<Vec<&_>>().as_slice(),
                limit,
                offset,
                retrieve_more,
            )
            .await
    }

    pub(super) async fn file_search(&self, path: &str) -> Result<Option<ContentDocument>> {
        let branch = self.branch.as_deref();
        let repo_ref = &self.repo_ref;

        debug!(%repo_ref, path, ?branch, %self.thread_id, "executing file search");
        self.app.indexes.file.by_path(repo_ref, path, branch).await
    }

    pub(super) async fn fuzzy_path_search<'a>(
        &'a self,
        query: &str,
    ) -> impl Iterator<Item = FileDocument> + 'a {
        let branch = self.branch.as_deref();
        let repo_ref = &self.repo_ref;

        debug!(%repo_ref, query, ?branch, %self.thread_id, "executing fuzzy search");
        self.app
            .indexes
            .file
            .fuzzy_path_match(&self.repo_ref, query, self.branch.as_deref(), 50)
            .await
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
}
