use anyhow::{anyhow, Result};
use tracing::instrument;

use crate::{
    agent::{
        exchange::{CodeChunk, RepoPath, SearchStep, Update},
        Agent, AgentSemanticSearchParams,
    },
    analytics::EventData,
    query::parser::Literal, semantic::SemanticSearchParams,
};

impl Agent {
    #[instrument(skip(self))]
    pub async fn process_files(&mut self, query: &str, aliases: &[usize]) -> Result<String> {
        let paths = aliases
            .iter()
            .copied()
            .map(|i| self.paths().nth(i).ok_or(i).map(Clone::clone))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|i| anyhow!("invalid path alias {i}"))?;

        self.update(Update::StartStep(SearchStep::Proc {
            query: query.to_string(),
            paths: paths.clone(),
            response: String::new(),
        }))
        .await?;

        let repos = paths.iter().map(|p| p.repo.clone()).collect::<Vec<_>>();

        let results = self
            .semantic_search(AgentSemanticSearchParams {
                query: Literal::from(&query.to_string()),
                paths: paths.clone(),
                repos,
                semantic_params: SemanticSearchParams {
                    limit: 10,
                    offset: 0,
                    threshold: 0.0,
                    exact_match: true,
                },
            })
            .await?;

        let mut chunks = results
            .into_iter()
            .map(|chunk| {
                let repo_path = RepoPath {
                    repo: chunk.repo_ref.clone(),
                    path: chunk.relative_path,
                };

                CodeChunk {
                    alias: self.get_path_alias(&repo_path),
                    snippet: chunk.text,
                    start_line: chunk.start_line as usize,
                    end_line: chunk.end_line as usize,
                    start_byte: Some(chunk.start_byte as usize),
                    end_byte: Some(chunk.end_byte as usize),
                    repo_path,
                }
            })
            .collect::<Vec<_>>();

        chunks.sort_by(|a, b| a.alias.cmp(&b.alias).then(a.start_line.cmp(&b.start_line)));

        for chunk in chunks.iter().filter(|c| !c.is_empty()) {
            self.conversation
                .exchanges
                .last_mut()
                .unwrap()
                .code_chunks
                .push(chunk.clone())
        }

        let extra_chunks = self.get_related_chunks(chunks.clone()).await;

        chunks.extend(extra_chunks);

        let response = chunks
            .iter()
            .filter(|c| !c.is_empty())
            .map(|c| c.to_string())
            .collect::<Vec<_>>()
            .join("\n\n");

        self.update(Update::ReplaceStep(SearchStep::Proc {
            query: query.to_string(),
            paths,
            response: response.clone(),
        }))
        .await?;

        self.track_query(
            EventData::input_stage("process file")
                .with_payload("question", query)
                .with_payload("chunks", &response),
        );

        Ok(response)
    }
}
