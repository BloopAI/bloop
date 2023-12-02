use anyhow::{anyhow, Result};
use tracing::instrument;

use crate::{
    agent::{
        exchange::{CodeChunk, RepoPath, SearchStep, Update},
        Agent, SemanticSearchParams,
    },
    analytics::EventData,
    query::parser::Literal,
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
            .semantic_search(SemanticSearchParams {
                query: Literal::from(&query.to_string()),
                paths: paths.clone(),
                repos,
                limit: 20,
                offset: 0,
                threshold: 0.0,
                retrieve_more: true,
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
