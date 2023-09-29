use anyhow::{anyhow, Result};
use tracing::instrument;

use crate::{
    agent::{
        exchange::{CodeChunk, SearchStep, Update},
        Agent,
    },
    analytics::EventData,
};

impl Agent {
    #[instrument(skip(self))]
    pub async fn process_files(
        &mut self,
        query: &String,
        path_aliases: &[usize],
    ) -> Result<String> {
        let paths = path_aliases
            .iter()
            .copied()
            .map(|i| self.paths().nth(i).ok_or(i).map(str::to_owned))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|i| anyhow!("invalid path alias {i}"))?;

        self.update(Update::StartStep(SearchStep::Proc {
            query: query.to_string(),
            paths: paths.clone(),
            response: String::new(),
        }))
        .await?;

        let results = self
            .semantic_search(query.into(), paths.clone(), 20, 0, 0.0, true)
            .await?;

        let mut chunks = results
            .into_iter()
            .map(|chunk| {
                let relative_path = chunk.relative_path;

                CodeChunk {
                    path: relative_path.clone(),
                    alias: self.get_path_alias(&relative_path),
                    snippet: chunk.text,
                    start_line: chunk.start_line as usize,
                    end_line: chunk.end_line as usize,
                }
            })
            .collect::<Vec<_>>();

        chunks.sort_by(|a, b| a.alias.cmp(&b.alias).then(a.start_line.cmp(&b.start_line)));

        for chunk in chunks.iter().filter(|c| !c.is_empty()) {
            self.exchanges
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
