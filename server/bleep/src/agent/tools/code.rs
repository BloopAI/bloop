use anyhow::Result;
use tracing::{debug, info, instrument, trace};
use futures::{TryStreamExt};


use crate::{
    agent::{
        exchange::{ChunkRefDef, CodeChunk, RefDefMetadata, SearchStep, Update},
        prompts, Agent, Action,
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

        let contents = response.iter().flat_map(|c| {
            c.metadata.iter().flat_map(|s| {
                 s
                    .file_symbols
                    .iter()
                    .map(|e_c| e_c)
                
            })
        }).collect::<Vec<_>>();

        let user_query = self.exchanges.iter().rev().take(1).collect::<Vec<_>>().get(0).unwrap().query.raw_query.clone();

        let contents = contents.iter().map(|x| self.get_file_content(&x.file));

        let contents: Vec<crate::indexes::reader::ContentDocument> = futures::future::join_all(contents)
            .await
            .into_iter()
            .map(|x| x.unwrap().unwrap())
            .collect::<Vec<_>>();

        let extra_chunks: Vec<Vec<CodeChunk>> = response
            .iter()
            .map(|c| {
                c.metadata
                    .iter()
                    .flat_map(|s| {
                        s.file_symbols
                            .iter()
                            .flat_map(|f_s| {
                                f_s.data
                                    .iter()
                                    .map(|occ| {
                                        let filename = f_s.file.clone();
                                        let content = contents
                                            .iter()
                                            .find(|x| x.relative_path == filename)
                                            .unwrap().content.lines().collect::<Vec<_>>();
                                        let n_lines = content.len();
                                        let chunk_content =
                                            content[occ.range.start.line
                                                ..(occ.range.end.line + 10).min(n_lines)].to_vec()
                                                .join("\n");
                                        CodeChunk {
                                            path: filename,
                                            alias: 0,
                                            snippet: chunk_content,
                                            start_line: occ.range.start.line as usize,
                                            end_line: (occ.range.end.line + 10).min(n_lines)
                                                as usize,
                                            start_byte: 0 as usize,
                                            end_byte: 0 as usize,
                                        }
                                    })
                                    .collect::<Vec<_>>()
                            })
                            .collect::<Vec<_>>()
                    })
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();

            
        
        
        let extra_chunks = extra_chunks.iter().zip(chunks.iter())
        .filter(|(x, _)| x.len()>0)
        .map(
            |(extra, original)| self.filter_chunks(&user_query, extra.to_vec(), original.clone())
        );
        
        let extra_chunks = futures::future::join_all(extra_chunks).await.into_iter().map(|x| x.unwrap())
        .map(
            |x| CodeChunk {
                path: x.path.clone(),
                alias: self.get_path_alias(&x.path),
                snippet: x.snippet,
                start_line: x.start_line,
                end_line: x.end_line,
                start_byte: 0 as usize,
                end_byte: 0 as usize,
            }
        ).collect::<Vec<_>>();

        

        dbg!("{}", extra_chunks.clone());

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

    async fn filter_chunks(&self, query: &str, chunks: Vec<CodeChunk>, original: CodeChunk) -> Result<CodeChunk> {
        
        let chunks_string = chunks.iter().enumerate()
        .map(|(i, c)| format!("{}: {}\n\n{}", i, c.path, c.snippet)).collect::<Vec<_>>().join("\n\n"); 
        let prompt = vec![llm_gateway::api::Message::user(
            format!("Additional snippets:\n{}\n\nInstruction: Given the above additional snippets and the following query and main snippet select the additional snippet which contains code that will complement the most the main snippet to help the most to answer the query. Answer using the additional snippet alias (integer defined before the path). Answer only with a function.\n\nMain snippet: {}\n\nQuery:{}\n\nWhat is the most complementary additional snippet?", chunks_string.as_str(), original.snippet, query).as_str()
        )];

        let filter_function = serde_json::from_value::<Vec<llm_gateway::api::Function>>(serde_json::json!([
            {
                "name": "filter",
                "description":  "Select the chunk most likely to contain information to answer the query",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "chunk": {
                            "type": "integer",
                            "description": "The chunk alias"
                        }
                    },
                    "required": ["chunk"]
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
            .unwrap_or(FunctionCall{name: Some("filter".to_string()), arguments: "{\"chunk\": 0}".to_string()});

        dbg!("{}", response.clone());

        //let function_response: FunctionCall = serde_json::from_str(response.as_str()).unwrap_or(FunctionCall{name: Some("filter".to_string()), arguments: "{\"chunk\": 0}".to_string()});

        let action =
            Action::deserialize_gpt(&response).unwrap();

        let selected_chunk = match action {
            Action::Filter { chunk: x } => x,
            _ => 0
        };

        
        

        Ok(chunks.get(selected_chunk).unwrap().clone())
    }
    

    

}
