use std::collections::HashSet;

use anyhow::Result;
use tracing::instrument;

use crate::{
    agent::{
        exchange::{RepoPath, SearchStep, Update},
        Agent, AgentSemanticSearchParams,
    },
    analytics::EventData,
    semantic::SemanticSearchParams,
};

impl Agent {
    #[instrument(skip(self))]
    pub async fn path_search(&mut self, query: &String) -> Result<String> {
        self.update(Update::StartStep(SearchStep::Path {
            query: query.clone(),
            response: String::new(),
        }))
        .await?;

        // First, perform a lexical search for the path
        let mut paths = self
            .fuzzy_path_search(query)
            .await
            .map(|c| RepoPath {
                repo: c.repo_ref,
                path: c.relative_path,
            })
            .collect::<HashSet<_>>() // TODO: This shouldn't be necessary. Path search should return unique results.
            .into_iter()
            .collect::<Vec<_>>();

        let is_semantic = paths.is_empty();

        // If there are no lexical results, perform a semantic search.
        if paths.is_empty() {
            let semantic_paths = self
                .semantic_search(AgentSemanticSearchParams {
                    query: query.into(),
                    paths: vec![],
                    repos: self.relevant_repos(),
                    semantic_params: SemanticSearchParams {
                        limit: 30,
                        offset: 0,
                        threshold: 0.0,
                        exact_match: false,
                    },
                })
                .await?
                .into_iter()
                .map(|chunk| RepoPath {
                    repo: chunk.repo_ref,
                    path: chunk.relative_path,
                })
                .collect::<HashSet<_>>()
                .into_iter()
                .collect();

            paths = semantic_paths;
        }

        let mut paths = paths
            .iter()
            .map(|repo_path| (self.get_path_alias(repo_path), repo_path.to_string()))
            .collect::<Vec<_>>();
        paths.sort_by(|a: &(usize, String), b| a.0.cmp(&b.0)); // Sort by alias

        let response = paths
            .iter()
            .map(|(alias, path)| format!("{}: {}", alias, path))
            .collect::<Vec<_>>()
            .join("\n");

        self.update(Update::ReplaceStep(SearchStep::Path {
            query: query.clone(),
            response: response.clone(),
        }))
        .await?;

        self.track_query(
            EventData::input_stage("path search")
                .with_payload("query", query)
                .with_payload("is_semantic", is_semantic)
                .with_payload("results", &paths)
                .with_payload("raw_prompt", &response),
        );

        Ok(response)
    }
}
