use anyhow::Result;
use futures::TryStreamExt;
use tracing::{debug, info, instrument, trace};

use crate::{
    agent::{
        exchange::{ChunkRefDef, CodeChunk, RefDefMetadata, SearchStep, Update},
        prompts, Action, Agent,
    },
    analytics::EventData,
    llm_gateway::{self, api::FunctionCall},
};

impl Agent {
    #[instrument(skip(self))]
    pub async fn code_search(&mut self, query: &String) -> Result<String> {
        const CODE_SEARCH_LIMIT: u64 = 10;
        const MINIMUM_RESULTS: usize = CODE_SEARCH_LIMIT as usize / 2;

        self.update(Update::StartStep(SearchStep::Code {
            query: query.clone(),
            response: String::new(),
        }))
        .await?;

        let mut results = self
            .semantic_search(query.into(), vec![], CODE_SEARCH_LIMIT, 0, 0.3, true)
            .await?;

        debug!("returned {} results", results.len());

        let hyde_docs = if results.len() < MINIMUM_RESULTS {
            info!("too few results returned, running HyDE");

            let hyde_docs = self.hyde(query).await?;
            if !hyde_docs.is_empty() {
                let hyde_doc = hyde_docs.first().unwrap().into();
                let hyde_results = self
                    .semantic_search(hyde_doc, vec![], CODE_SEARCH_LIMIT, 0, 0.3, true)
                    .await?;

                debug!("returned {} HyDE results", results.len());
                results.extend(hyde_results);
            }
            hyde_docs
        } else {
            vec![]
        };

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
                    start_byte: chunk.start_byte as usize,
                    end_byte: chunk.end_byte as usize,
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

        let response = chunks.iter().filter(|c| !c.is_empty()).map(|c| {
            ChunkRefDef::new(
                c.clone(),
                format!("github.com/{}", self.repo_ref.name.clone()),
                self.app.indexes.clone(),
            )
        });

        let response: Vec<ChunkRefDef> = futures::future::join_all(response).await;

        let contents = response
            .iter()
            .flat_map(|c| {
                c.metadata
                    .iter()
                    .flat_map(|s| s.file_symbols.iter().map(|e_c| e_c))
            })
            .collect::<Vec<_>>();

        let contents = contents.iter().map(|x| self.get_file_content(&x.file));

        let contents: Vec<crate::indexes::reader::ContentDocument> =
            futures::future::join_all(contents)
                .await
                .into_iter()
                .map(|x| x.unwrap().unwrap())
                .collect::<Vec<_>>();

        let user_query = self
            .exchanges
            .iter()
            .rev()
            .take(1)
            .collect::<Vec<_>>()
            .get(0)
            .unwrap()
            .query
            .raw_query
            .clone();

        let mut i = -1;

        let symbols = response
            .into_iter()
            .map(|c| {
                (
                    c.chunk,
                    c.metadata
                        .into_iter()
                        .map(|s| {
                            i = i + 1;
                            (i, s)
                        })
                        .collect::<Vec<_>>(),
                )
            })
            .collect::<Vec<_>>();

        let selected_symbol = self.filter_symbols(&user_query, symbols).await.unwrap();

        let extra_chunks = selected_symbol
            .file_symbols
            .iter()
            .map(|f_s| {
                let filename = f_s.file.clone();
                let content = contents
                    .iter()
                    .find(|x| x.relative_path == filename)
                    .unwrap()
                    .content
                    .lines()
                    .collect::<Vec<_>>();

                let n_lines = content.len();

                f_s.data
                    .iter()
                    .map(|occ| {
                        let chunk_content = content
                            [occ.range.start.line..(occ.range.end.line + 10).min(n_lines)]
                            .to_vec()
                            .join("\n");
                        CodeChunk {
                            path: filename.clone(),
                            alias: 0,
                            snippet: chunk_content,
                            start_line: occ.range.start.line as usize,
                            end_line: (occ.range.end.line + 10).min(n_lines) as usize,
                            start_byte: 0 as usize,
                            end_byte: 0 as usize,
                        }
                    })
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();

        //dbg!("{}", extra_chunks);

        let extra_chunks = extra_chunks
            .iter()
            .flatten()
            .take(3)
            .map(|c| {
                let chunk = CodeChunk {
                    path: c.path.clone(),
                    alias: self.get_path_alias(c.path.as_str()),
                    snippet: c.snippet.clone(),
                    start_line: c.start_line,
                    end_line: c.end_line,
                    start_byte: 0 as usize,
                    end_byte: 0 as usize,
                };
                self.exchanges
                    .last_mut()
                    .unwrap()
                    .code_chunks
                    .push(chunk.clone());
                chunk
            })
            .collect::<Vec<_>>();
        chunks.extend(extra_chunks);

        let response = chunks.clone()
            .into_iter()
            .map(|c| c.to_string())
            .collect::<Vec<_>>()
            .join("\n\n");

        self.update(Update::ReplaceStep(SearchStep::Code {
            query: query.clone(),
            response: response.clone(),
        }))
        .await?;

        self.track_query(
            EventData::input_stage("semantic code search")
                .with_payload("query", query)
                .with_payload("hyde_queries", &hyde_docs)
                .with_payload("chunks", &chunks)
                .with_payload("raw_prompt", &response),
        );

        Ok(response)
    }

    /// Hypothetical Document Embedding (HyDE): https://arxiv.org/abs/2212.10496
    ///
    /// This method generates synthetic documents based on the query. These are then
    /// parsed and code is extracted. This has been shown to improve semantic search recall.
    async fn hyde(&self, query: &str) -> Result<Vec<String>> {
        let prompt = vec![llm_gateway::api::Message::system(
            &prompts::hypothetical_document_prompt(query),
        )];

        trace!(?query, "generating hyde docs");

        let response = self
            .llm_gateway
            .clone()
            .model("gpt-3.5-turbo-0613")
            .temperature(0.0)
            .chat(&prompt, None)
            .await?;

        trace!("parsing hyde response");

        let documents = prompts::try_parse_hypothetical_documents(&response);

        for doc in documents.iter() {
            info!(?doc, "got hyde doc");
        }

        Ok(documents)
    }

    async fn filter_symbols(
        &self,
        query: &str,
        symbols: Vec<(CodeChunk, Vec<(i32, RefDefMetadata)>)>,
    ) -> Result<RefDefMetadata> {
        let chunks_string = symbols
            .iter()
            .filter(|(_, s)| s.len() > 0)
            .map(|(c, s)| {
                let symbols_string = s
                    .iter()
                    .map(|(i, refdef)| format!("{}: {}", i, refdef.name))
                    .collect::<Vec<_>>()
                    .join("\n");

                format!(
                    "Path:{}\n\n{}\n\nSymbols:\n\n{}",
                    c.path.clone(),
                    c.snippet.clone(),
                    symbols_string
                )
            })
            .collect::<Vec<_>>()
            .join("\n\n");

        let prompt = vec![llm_gateway::api::Message::user(
            format!("Snippets:\n\n{}\n\nInstruction: Above there are some code chunks and some symbols extracted from the chunks. Your job is to select the most relevant symbol to the user query. Do not answer with the siymbol name, use the symbol key/alias.\n\nQuery:{}", chunks_string.as_str(),  query).as_str()
        )];

        let filter_function = serde_json::from_value::<Vec<llm_gateway::api::Function>>(serde_json::json!([
            {
                "name": "filter",
                "description":  "Select the symbol most likely to contain information to answer the query",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "symbol": {
                            "type": "integer",
                            "description": "The chunk alias"
                        }
                    },
                    "required": ["symbol"]
                }
            }])
        )
        .unwrap();

        let response = self
            .llm_gateway
            .clone()
            .model("gpt-3.5-turbo-0613")
            .temperature(0.0)
            .chat_stream(&prompt, Some(&filter_function))
            .await?
            .try_fold(
                llm_gateway::api::FunctionCall::default(),
                |acc: FunctionCall, e: String| async move {
                    let e: FunctionCall = serde_json::from_str(&e).map_err(|err| {
                        tracing::error!(
                            "Failed to deserialize to FunctionCall: {:?}. Error: {:?}",
                            e,
                            err
                        );
                        err
                    })?;
                    Ok(FunctionCall {
                        name: acc.name.or(e.name),
                        arguments: acc.arguments + &e.arguments,
                    })
                },
            )
            .await
            .unwrap_or(FunctionCall {
                name: Some("filter".to_string()),
                arguments: "{\"symbol\": 0}".to_string(),
            });

        dbg!("{}", response.clone());

        //let function_response: FunctionCall = serde_json::from_str(response.as_str()).unwrap_or(FunctionCall{name: Some("filter".to_string()), arguments: "{\"chunk\": 0}".to_string()});

        let action = Action::deserialize_gpt(&response).unwrap();

        let selected_chunk = match action {
            Action::Filter { symbol: x } => x,
            _ => 0,
        };

        let output = symbols
            .into_iter()
            .flat_map(|(c, s)| s)
            .find(|(i, _)| i.clone() == selected_chunk as i32)
            .unwrap();

        Ok(output.1)
    }
}
