use anyhow::{anyhow, Context, Result};
use futures::{stream, StreamExt, TryStreamExt};
use tiktoken_rs::CoreBPE;
use tracing::{debug, instrument};

use crate::{
    agent::{
        exchange::{CodeChunk, SearchStep, Update},
        prompts, Agent,
    },
    analytics::EventData,
    llm_gateway,
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
        dbg!(&paths);

        // Communicate to the FE that we're running proc
        self.update(Update::StartStep(SearchStep::Proc {
            query: query.to_string(),
            paths: paths.clone(),
            response: String::new(),
        }))
        .await?;

        // Perform a semantic search for the query against the content of `paths`
        // Perhaps use HyDE here to make the results more accurate
        // Could use a custom HyDE query which was conditioned on the languages of the paths passed

        let results = self
            .semantic_search(query.into(), 20, 0, 0.0, true, Some(paths.clone()))
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

fn trim_lines_by_tokens(lines: Vec<String>, bpe: CoreBPE, max_tokens: usize) -> Vec<String> {
    let line_tokens = lines
        .iter()
        .map(|line| bpe.encode_ordinary(line).len())
        .collect::<Vec<_>>();

    let mut trimmed_lines = Vec::new();

    // Push lines to `trimmed_lines` until we reach the maximum number of tokens.
    let mut i = 0usize;
    let mut tokens = 0usize;
    while i < lines.len() && tokens < max_tokens {
        tokens += line_tokens[i];
        trimmed_lines.push(lines[i].clone());
        i += 1;
    }

    trimmed_lines
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trim_lines_by_tokens() {
        let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo").unwrap();

        let lines = vec![
            "fn main() {".to_string(),
            "    one();".to_string(),
            "    two();".to_string(),
            "    three();".to_string(),
            "    four();".to_string(),
            "    five();".to_string(),
            "    six();".to_string(),
            "}".to_string(),
        ];
        assert_eq!(
            trim_lines_by_tokens(lines, bpe.clone(), 15),
            vec![
                "fn main() {".to_string(),
                "    one();".to_string(),
                "    two();".to_string(),
                "    three();".to_string(),
                "    four();".to_string()
            ]
        );

        let lines = vec!["fn main() {".to_string(), "    one();".to_string()];
        assert_eq!(
            trim_lines_by_tokens(lines, bpe.clone(), 15),
            vec!["fn main() {".to_string(), "    one();".to_string()]
        );

        let expected: Vec<String> = vec![];
        assert_eq!(trim_lines_by_tokens(vec![], bpe, 15), expected);
    }
}
