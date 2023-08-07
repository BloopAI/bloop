use std::collections::HashSet;

use anyhow::Result;

use crate::{
    agent::{
        exchange::{SearchStep, Update},
        Agent,
    },
    analytics::EventData,
};

impl Agent {
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
            .map(|c| c.relative_path)
            .collect::<HashSet<_>>() // TODO: This shouldn't be necessary. Path search should return unique results.
            .into_iter()
            .collect::<Vec<_>>();

        let is_semantic = paths.is_empty();

        // If there are no lexical results, perform a semantic search.
        if paths.is_empty() {
            let semantic_paths = self
                .semantic_search(query.into(), 30, 0, 0.0, true)
                .await?
                .into_iter()
                .map(|chunk| chunk.relative_path)
                .collect::<HashSet<_>>()
                .into_iter()
                .collect();

            paths = semantic_paths;
        }

        let formatted_paths = paths
            .iter()
            .map(|p| (p.to_string(), self.get_path_alias(p)))
            .collect::<Vec<_>>();

        let response = serde_json::to_string(&formatted_paths).unwrap();

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
