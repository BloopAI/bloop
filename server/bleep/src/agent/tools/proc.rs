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
    pub async fn process_files(&mut self, query: &str, path_aliases: &[usize]) -> Result<String> {
        const MAX_CHUNK_LINE_LENGTH: usize = 20;
        const CHUNK_MERGE_DISTANCE: usize = 10;
        const MAX_TOKENS: usize = 15400;

        let paths = path_aliases
            .iter()
            .copied()
            .map(|i| self.paths().nth(i).ok_or(i).map(str::to_owned))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|i| anyhow!("invalid path alias {i}"))?;

        debug!(?query, ?paths, "invoking proc");

        self.update(Update::StartStep(SearchStep::Proc {
            query: query.to_string(),
            paths: paths.clone(),
            response: String::new(),
        }))
        .await?;

        // Immutable reborrow of `self`, to copy freely to async closures.
        let self_ = &*self;
        let chunks = stream::iter(paths.clone())
            .map(|path| async move {
                tracing::debug!(?path, "reading file");

                let lines = self_
                    .get_file_content(&path)
                    .await?
                    .with_context(|| format!("path does not exist in the index: {path}"))?
                    .content
                    .lines()
                    .enumerate()
                    .map(|(i, line)| format!("{} {line}", i + 1))
                    .collect::<Vec<_>>();

                let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo")?;

                let iter =
                    tokio::task::spawn_blocking(|| trim_lines_by_tokens(lines, bpe, MAX_TOKENS))
                        .await
                        .context("failed to split by token")?;

                Result::<_>::Ok((iter, path.clone()))
            })
            // Buffer file loading to load multiple paths at once
            .buffered(10)
            .map(|result| async {
                let (lines, path) = result?;

                // The unwraps here should never fail, we generated this string above to always
                // have the same format.
                let start_line = lines[0]
                    .split_once(' ')
                    .unwrap()
                    .0
                    .parse::<usize>()
                    .unwrap()
                    - 1;

                // We store the lines separately, so that we can reference them later to trim
                // this snippet by line number.
                let contents = lines.join("\n");
                let prompt = prompts::file_explanation(query, &path, &contents);

                debug!(?path, "calling chat API on file");

                let json = self_
                    .llm_gateway
                    .clone()
                    .model("gpt-3.5-turbo-16k-0613")
                    // Set low frequency penalty to discourage long outputs.
                    .frequency_penalty(0.2)
                    .chat(&[llm_gateway::api::Message::system(&prompt)], None)
                    .await?
                    .try_collect::<String>()
                    .await?;

                #[derive(
                    serde::Deserialize,
                    serde::Serialize,
                    PartialEq,
                    Eq,
                    PartialOrd,
                    Ord,
                    Copy,
                    Clone,
                    Debug,
                )]
                struct Range {
                    start: usize,
                    end: usize,
                }

                #[derive(serde::Serialize)]
                struct RelevantChunk {
                    #[serde(flatten)]
                    range: Range,
                    code: String,
                }

                let mut line_ranges: Vec<Range> = serde_json::from_str::<Vec<Range>>(&json)?
                    .into_iter()
                    .filter(|r| r.start > 0 && r.end > 0)
                    .map(|mut r| {
                        r.end = r.end.min(r.start + MAX_CHUNK_LINE_LENGTH); // Cap relevant chunk size by line number
                        r
                    })
                    .map(|r| Range {
                        start: r.start - 1,
                        end: r.end,
                    })
                    .collect();

                line_ranges.sort();
                line_ranges.dedup();

                let relevant_chunks = line_ranges
                    .into_iter()
                    .fold(Vec::<Range>::new(), |mut exps, next| {
                        if let Some(prev) = exps.last_mut() {
                            if prev.end + CHUNK_MERGE_DISTANCE >= next.start {
                                prev.end = next.end;
                                return exps;
                            }
                        }

                        exps.push(next);
                        exps
                    })
                    .into_iter()
                    .filter_map(|range| {
                        Some(RelevantChunk {
                            range,
                            code: lines
                                .get(
                                    range.start.saturating_sub(start_line)
                                        ..=range.end.saturating_sub(start_line),
                                )?
                                .iter()
                                .map(|line| line.split_once(' ').unwrap().1)
                                .collect::<Vec<_>>()
                                .join("\n"),
                        })
                    })
                    .collect::<Vec<_>>();

                Ok::<_, anyhow::Error>((relevant_chunks, path))
            });

        let processed = chunks
            // This box seems unnecessary, but it avoids a compiler bug:
            // https://github.com/rust-lang/rust/issues/64552
            .boxed()
            .buffered(5)
            .filter_map(|res| async { res.ok() })
            .collect::<Vec<_>>()
            .await;

        let mut chunks = processed
            .into_iter()
            .flat_map(|(relevant_chunks, path)| {
                let alias = self.get_path_alias(&path);

                relevant_chunks.into_iter().map(move |c| CodeChunk {
                    path: path.clone(),
                    alias,
                    snippet: c.code,
                    start_line: c.range.start,
                    end_line: c.range.end,
                })
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
