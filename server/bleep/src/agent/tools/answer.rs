use std::{collections::HashMap, mem, ops::Range, pin::pin};

use anyhow::{anyhow, Context, Result};
use futures::StreamExt;
use rand::{rngs::OsRng, seq::SliceRandom};
use tracing::{debug, info, instrument, trace};

use crate::{
    agent::{
        exchange::{CodeChunk, FocusedChunk, Update},
        model, transcoder, Agent,
    },
    analytics::EventData,
    llm_gateway,
};

const CHUNK_MERGE_DISTANCE: usize = 20;

impl Agent {
    #[instrument(skip(self))]
    pub async fn answer(&mut self, aliases: &[usize]) -> Result<()> {
        debug!("creating article response");

        if aliases.len() == 1 {
            let path = self
                .paths()
                .nth(aliases[0])
                .context("invalid path alias passed")?;

            let doc = self
                .get_file_content(path)
                .await?
                .context("path did not exist")?;

            self.update(Update::Focus(FocusedChunk {
                file_path: path.to_owned(),
                start_line: 0,
                end_line: doc.content.lines().count(),
            }))
            .await?;
        }

        let context = self.answer_context(aliases).await?;
        let system_prompt = (self.model.system_prompt)(&context);
        let system_message = llm_gateway::api::Message::system(&system_prompt);
        let history = {
            let h = self.utter_history().collect::<Vec<_>>();
            let system_headroom = tiktoken_rs::num_tokens_from_messages(
                self.model.tokenizer,
                &[(&system_message).into()],
            )?;
            let headroom = self.model.answer_headroom + system_headroom;
            trim_utter_history(h, headroom, self.model)?
        };
        let messages = Some(system_message)
            .into_iter()
            .chain(history.iter().cloned())
            .collect::<Vec<_>>();

        let mut stream = pin!(
            self.llm_gateway
                .clone()
                .model(self.model.model_name)
                .frequency_penalty(if self.model.model_name == "gpt-3.5-turbo-finetuned" {
                    Some(0.2)
                } else {
                    Some(0.0)
                })
                .chat_stream(&messages, None)
                .await?
        );

        let mut response = String::new();
        while let Some(fragment) = stream.next().await {
            let fragment = fragment?;
            response += &fragment;

            let (article, summary) = transcoder::decode(&response);
            self.update(Update::Article(article)).await?;

            if let Some(summary) = summary {
                self.update(Update::Conclude(summary)).await?;
            }
        }

        // We re-decode one final time to catch cases where `summary` is `None`, and to log the
        // output as a trace.
        let (article, summary) = transcoder::decode(&response);
        let summary = summary.unwrap_or_else(|| {
            [
                "I hope that was useful, can I help with anything else?",
                "Is there anything else I can help you with?",
                "Can I help you with anything else?",
            ]
            .choose(&mut OsRng)
            .copied()
            .unwrap()
            .to_owned()
        });

        trace!(%article, "generated answer");

        self.update(Update::Conclude(summary)).await?;

        self.track_query(
            EventData::output_stage("answer_article")
                .with_payload("query", self.last_exchange().query())
                .with_payload("query_history", &history)
                .with_payload("response", &response)
                .with_payload("raw_prompt", &system_prompt),
        );

        Ok(())
    }

    #[instrument(skip(self))]
    async fn answer_context(&mut self, aliases: &[usize]) -> Result<String> {
        let paths = self.paths().collect::<Vec<_>>();

        let mut s = "".to_owned();

        let mut aliases = aliases
            .iter()
            .copied()
            .filter(|alias| *alias < paths.len())
            .collect::<Vec<_>>();

        aliases.sort();
        aliases.dedup();

        debug!(?paths, ?aliases, "created filtered path alias list");

        if !aliases.is_empty() {
            s += "##### PATHS #####\n";

            for alias in &aliases {
                let path = &paths[*alias];
                s += &format!("{path}\n");
            }
        }

        let code_chunks = self.canonicalize_code_chunks(&aliases).await;

        // Sometimes, there are just too many code chunks in the context, and deduplication still
        // doesn't trim enough chunks. So, we enforce a hard limit here that stops adding tokens
        // early if we reach a heuristic limit.
        let bpe = tiktoken_rs::get_bpe_from_model(self.model.tokenizer)?;
        let mut remaining_prompt_tokens =
            tiktoken_rs::get_completion_max_tokens(self.model.tokenizer, &s)?;

        // Select as many recent chunks as possible
        let mut recent_chunks = Vec::new();
        for chunk in code_chunks.iter().rev() {
            let snippet = chunk
                .snippet
                .lines()
                .enumerate()
                .map(|(i, line)| format!("{} {line}\n", i + chunk.start_line + 1))
                .collect::<String>();

            let formatted_snippet = format!("### {} ###\n{snippet}\n\n", chunk.path);

            let snippet_tokens = bpe.encode_ordinary(&formatted_snippet).len();

            if snippet_tokens >= remaining_prompt_tokens - self.model.prompt_headroom {
                info!("breaking at {} tokens", remaining_prompt_tokens);
                break;
            }

            recent_chunks.push((chunk.clone(), formatted_snippet));

            remaining_prompt_tokens -= snippet_tokens;
            debug!("{}", remaining_prompt_tokens);
        }

        // group recent chunks by path alias
        let mut recent_chunks_by_alias: HashMap<_, _> =
            recent_chunks
                .into_iter()
                .fold(HashMap::new(), |mut map, item| {
                    map.entry(item.0.alias).or_insert_with(Vec::new).push(item);
                    map
                });

        // write the header if we have atleast one chunk
        if !recent_chunks_by_alias.values().all(Vec::is_empty) {
            s += "\n##### CODE CHUNKS #####\n\n";
        }

        // sort by alias, then sort by lines
        let mut aliases = recent_chunks_by_alias.keys().copied().collect::<Vec<_>>();
        aliases.sort();

        for alias in aliases {
            let chunks = recent_chunks_by_alias.get_mut(&alias).unwrap();
            chunks.sort_by(|a, b| a.0.start_line.cmp(&b.0.start_line));
            for (_, formatted_snippet) in chunks {
                s += formatted_snippet;
            }
        }

        Ok(s)
    }

    /// History of `user`, `assistant` messages. These are the messages that are shown to the user.
    fn utter_history(&self) -> impl Iterator<Item = llm_gateway::api::Message> + '_ {
        const ANSWER_MAX_HISTORY_SIZE: usize = 5;

        self.exchanges
            .iter()
            .rev()
            .take(ANSWER_MAX_HISTORY_SIZE)
            .rev()
            .flat_map(|e| {
                let query = e.query().map(|q| llm_gateway::api::Message::PlainText {
                    role: "user".to_owned(),
                    content: q,
                });

                let conclusion = e.answer().map(|(answer, conclusion)| {
                    let encoded =
                        transcoder::encode_summarized(answer, Some(conclusion), "gpt-4-0613")
                            .unwrap();

                    llm_gateway::api::Message::PlainText {
                        role: "assistant".to_owned(),
                        content: encoded,
                    }
                });

                query.into_iter().chain(conclusion).collect::<Vec<_>>()
            })
    }

    fn code_chunks(&self) -> impl Iterator<Item = CodeChunk> + '_ {
        self.exchanges
            .iter()
            .flat_map(|e| e.code_chunks.iter().cloned())
    }

    /// Merge overlapping and nearby code chunks
    async fn canonicalize_code_chunks(&mut self, aliases: &[usize]) -> Vec<CodeChunk> {
        debug!(?aliases, "canonicalizing code chunks");

        /// The ratio of code tokens to context size.
        ///
        /// Making this closure to 1 means that more of the context is taken up by source code.
        const CONTEXT_CODE_RATIO: f32 = 0.5;

        let bpe = tiktoken_rs::get_bpe_from_model(self.model.tokenizer).unwrap();
        let context_size = tiktoken_rs::model::get_context_size(self.model.tokenizer);
        let max_tokens = (context_size as f32 * CONTEXT_CODE_RATIO) as usize;

        // Note: The end line number here is *not* inclusive.
        let mut spans_by_path = HashMap::<_, Vec<_>>::new();
        for c in self.code_chunks().filter(|c| aliases.contains(&c.alias)) {
            spans_by_path
                .entry(c.path.clone())
                .or_default()
                .push(c.start_line..c.end_line);
        }

        // If there are no relevant code chunks, but there is a focused chunk, we use that.
        if spans_by_path.is_empty() {
            if let Some(chunk) = &self.last_exchange().focused_chunk {
                spans_by_path
                    .entry(chunk.file_path.clone())
                    .or_default()
                    .push(chunk.start_line..chunk.end_line);
            }
        }

        debug!(?spans_by_path, "expanding spans");

        let self_ = &*self;
        // Map of path -> line list
        let lines_by_file = futures::stream::iter(&mut spans_by_path)
            .then(|(path, spans)| async move {
                spans.sort_by_key(|c| c.start);

                let lines = self_
                    .get_file_content(path)
                    .await
                    .unwrap()
                    .unwrap_or_else(|| panic!("path did not exist in the index: {path}"))
                    .content
                    .lines()
                    .map(str::to_owned)
                    .collect::<Vec<_>>();

                (path.clone(), lines)
            })
            .collect::<HashMap<_, _>>()
            .await;

        // Total number of lines to try and expand by, per loop iteration.
        const TOTAL_LINE_INC: usize = 100;

        // We keep track of whether any spans were changed below, so that we know when to break
        // out of this loop.
        let mut changed = true;

        while !spans_by_path.is_empty() && changed {
            changed = false;

            let tokens = spans_by_path
                .iter()
                .flat_map(|(path, spans)| spans.iter().map(move |s| (path, s)))
                .map(|(path, span)| {
                    let snippet = lines_by_file.get(path).unwrap()[span.clone()].join("\n");
                    bpe.encode_ordinary(&snippet).len()
                })
                .sum::<usize>();

            // First, we grow the spans if possible.
            if tokens < max_tokens {
                // NB: We divide TOTAL_LINE_INC by 2, because we expand in 2 directions.
                let range_step = (TOTAL_LINE_INC / 2)
                    / spans_by_path
                        .values()
                        .map(|spans| spans.len())
                        .sum::<usize>()
                        .max(1);

                let range_step = range_step.max(1);

                for (path, span) in spans_by_path
                    .iter_mut()
                    .flat_map(|(path, spans)| spans.iter_mut().map(move |s| (path, s)))
                {
                    let file_lines = lines_by_file.get(path.as_str()).unwrap().len();

                    let old_span = span.clone();

                    span.start = span.start.saturating_sub(range_step);

                    // Expand the end line forwards, capping at the total number of lines.
                    span.end += range_step;
                    span.end = span.end.min(file_lines);

                    if *span != old_span {
                        trace!(?path, "growing span");
                        changed = true;
                    }
                }
            }

            // Next, we merge any overlapping spans.
            for spans in spans_by_path.values_mut() {
                *spans = mem::take(spans)
                    .into_iter()
                    .fold(Vec::new(), |mut a, next| {
                        // There is some rightward drift here, which could be fixed once if-let
                        // chains are stabilized.
                        if let Some(prev) = a.last_mut() {
                            if let Some(next) = merge_overlapping(prev, next) {
                                a.push(next);
                            } else {
                                changed = true;
                            }
                        } else {
                            a.push(next);
                        }

                        a
                    });
            }
        }

        debug!(?spans_by_path, "expanded spans");

        let code_chunks = spans_by_path
            .into_iter()
            .flat_map(|(path, spans)| spans.into_iter().map(move |s| (path.clone(), s)))
            .map(|(path, span)| {
                let snippet = lines_by_file.get(&path).unwrap()[span.clone()].join("\n");

                CodeChunk {
                    alias: self.get_path_alias(&path),
                    path,
                    snippet,
                    start_line: span.start,
                    end_line: span.end,
                }
            })
            .collect::<Vec<CodeChunk>>();

        // Handle case where there is only one code chunk and it exceeds `max_tokens`.
        // In this instance we trim the chunk to fit within the limit.
        if code_chunks.len() == 1 {
            let chunk = code_chunks.first().unwrap();
            let trimmed_snippet = transcoder::limit_tokens(&chunk.snippet, bpe, max_tokens);
            let num_trimmed_lines = trimmed_snippet.lines().count();
            vec![CodeChunk {
                alias: chunk.alias,
                path: chunk.path.clone(),
                snippet: trimmed_snippet.to_string(),
                start_line: chunk.start_line,
                end_line: (chunk.start_line + num_trimmed_lines).saturating_sub(1),
            }]
        } else {
            code_chunks
        }
    }
}

// headroom refers to the amount of space reserved for the rest of the prompt
fn trim_utter_history(
    mut history: Vec<llm_gateway::api::Message>,
    headroom: usize,
    model: model::AnswerModel,
) -> Result<Vec<llm_gateway::api::Message>> {
    let mut tiktoken_msgs: Vec<tiktoken_rs::ChatCompletionRequestMessage> =
        history.iter().map(|m| m.into()).collect::<Vec<_>>();

    // remove the earliest messages, one by one, until we can accommodate into prompt
    while tiktoken_rs::get_chat_completion_max_tokens(model.tokenizer, &tiktoken_msgs)? < headroom {
        if !tiktoken_msgs.is_empty() {
            tiktoken_msgs.remove(0);
            history.remove(0);
        } else {
            return Err(anyhow!("could not find message to trim"));
        }
    }

    Ok(history)
}

/// Merge line ranges if they overlap or are nearby.
///
/// This function assumes that the first parameter is a line range which starts *before* the line
/// range given by the second parameter.
fn merge_overlapping(a: &mut Range<usize>, b: Range<usize>) -> Option<Range<usize>> {
    if a.end + CHUNK_MERGE_DISTANCE >= b.start {
        // `b` might be contained in `a`, which allows us to discard it.
        if a.end < b.end {
            a.end = b.end;
        }

        None
    } else {
        Some(b)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trimming_utter_history() {
        let long_string = "long string ".repeat(2000);
        let history = vec![
            llm_gateway::api::Message::user("bar"),
            llm_gateway::api::Message::assistant("baz"),
            llm_gateway::api::Message::user(&long_string),
            llm_gateway::api::Message::assistant("quux"),
            llm_gateway::api::Message::user("fred"),
            llm_gateway::api::Message::assistant("thud"),
            llm_gateway::api::Message::user(&long_string),
            llm_gateway::api::Message::user("corge"),
        ];

        // the answer needs 8100 tokens of 8192, the utter history can admit just one message
        assert_eq!(
            trim_utter_history(history.clone(), 8100, model::GPT_4).unwrap(),
            vec![llm_gateway::api::Message::user("corge"),]
        );

        // the answer needs just 4000 tokens of 8192, the utter history can accomodate
        // one long_string, but no more long_strings
        assert_eq!(
            trim_utter_history(history, 4000, model::GPT_4).unwrap(),
            vec![
                llm_gateway::api::Message::assistant("quux"),
                llm_gateway::api::Message::user("fred"),
                llm_gateway::api::Message::assistant("thud"),
                llm_gateway::api::Message::user(&long_string),
                llm_gateway::api::Message::user("corge"),
            ]
        );
    }
}
