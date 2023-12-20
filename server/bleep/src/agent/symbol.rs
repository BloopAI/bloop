use futures::TryStreamExt;

use crate::agent::{exchange::CodeChunk, Agent};
use crate::intelligence::{code_navigation::FileSymbols, Language, TSLanguage};
use crate::llm_gateway;
use crate::webserver::intelligence::{get_token_info, TokenInfoRequest};
use anyhow::{Context, Result};
use tracing::log::{debug, info, warn};

pub struct ChunkWithSymbols {
    pub chunk: CodeChunk,
    pub symbols: Vec<Symbol>,
}

impl Agent {
    pub async fn extract_symbols(&self, chunk: CodeChunk) -> Result<ChunkWithSymbols> {
        const MAX_REF_DEFS: usize = 5; // Ignore symbols with more than this many cross-file refs/defs
        const NUMBER_CHUNK_LINES: usize = 10;

        // get hoverable elements
        let document = self
            .app
            .indexes
            .file
            .by_path(&self.repo_ref, &chunk.path, None)
            .await?
            .with_context(|| format!("failed to read path: {}", &chunk.path))?;

        let hoverable_ranges = document
            .hoverable_ranges()
            .ok_or_else(|| anyhow::anyhow!("no hoverable ranges"))?;

        let all_docs = {
            let associated_langs = match document.lang.as_deref().map(TSLanguage::from_id) {
                Some(Language::Supported(config)) => config.language_ids,
                _ => &[],
            };
            self.app
                .indexes
                .file
                .by_repo(&self.repo_ref, associated_langs.iter(), None)
                .await
        };

        // get references and definitions for each symbol
        let related_symbols = futures::future::join_all(
            hoverable_ranges
                .iter()
                .filter(|range| {
                    (range.start.byte >= chunk.start_byte) && (range.start.byte < chunk.end_byte)
                })
                .map(|range| {
                    get_token_info(
                        TokenInfoRequest {
                            relative_path: chunk.path.clone(),
                            repo_ref: self.repo_ref.display_name(),
                            branch: None,
                            start: range.start.byte,
                            end: range.end.byte,
                        },
                        &self.repo_ref,
                        self.app.indexes.clone(),
                        &document,
                        &all_docs,
                        Some(0),
                        Some(NUMBER_CHUNK_LINES),
                    )
                }),
        )
        .await;

        // filter references and definitions
        // 1: symbol shouldn't be in the same file
        // 2: number of refs/defs should be less than 5 to avoid very common symbols (iter, unwrap...)
        // 3: also filter out symbols without refs/defs
        let mut symbols = related_symbols
            .into_iter()
            .filter_map(Result::ok)
            .zip(hoverable_ranges.into_iter())
            .map(|(token_info, range)| {
                let filtered_token_info = token_info
                    .into_iter()
                    .filter(|file_symbols| file_symbols.file != chunk.path)
                    .collect::<Vec<_>>();

                Symbol {
                    name: chunk.snippet.clone()[(range.start.byte - chunk.start_byte)
                        ..(range.end.byte - chunk.start_byte)]
                        .to_string(),
                    related_symbols: filtered_token_info,
                }
            })
            .filter(|metadata| {
                (metadata.related_symbols.len() < MAX_REF_DEFS)
                    && (!metadata.related_symbols.is_empty())
            })
            .collect::<Vec<_>>();

        symbols.sort_by(|a, b| a.name.cmp(&b.name));
        symbols.dedup_by(|a, b| a.name == b.name);

        debug!("Attached {} symbols", symbols.len());

        Ok(ChunkWithSymbols {
            chunk: chunk.clone(),
            symbols,
        })
    }

    pub async fn expand_symbol_into_chunks(&self, ref_def_metadata: Symbol) -> Vec<CodeChunk> {
        // each symbol may be in multiple files and have multiple occurences in each file
        ref_def_metadata
            .related_symbols
            .iter()
            .flat_map(|file_symbols| {
                let filename = file_symbols.file.clone();

                file_symbols
                    .data
                    .iter()
                    .map(|occurrence| CodeChunk {
                        path: filename.clone(),
                        alias: 0,
                        snippet: occurrence.snippet.data.clone(),
                        start_line: occurrence.snippet.line_range.start,
                        end_line: occurrence.snippet.line_range.end,
                        start_byte: 0,
                        end_byte: 0,
                    })
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>()
    }

    pub async fn filter_symbols(
        &self,
        query: &str,
        chunks_with_symbols: Vec<ChunkWithSymbols>,
    ) -> Result<Symbol, SymbolError> {
        let mut i: i32 = -1;
        // we have multiples chunks and each chunk may have multiple symbols
        // unique alias (i) per symbol
        let symbols = chunks_with_symbols
            .into_iter()
            .map(|chunk_with_symbol| {
                (
                    chunk_with_symbol.chunk,
                    chunk_with_symbol
                        .symbols
                        .into_iter()
                        .map(|symbol| {
                            i += 1;
                            (i, symbol)
                        })
                        .collect::<Vec<_>>(),
                )
            })
            .collect::<Vec<_>>();
        if i == -1 {
            return Err(SymbolError::ListEmpty);
        }

        // Classifier

        // context
        let chunks_string = symbols
            .iter()
            .filter(|(_, s)| !s.is_empty())
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

        // instruction
        let prompt = format!("Snippets:\n\n{}\n\nInstruction: Above there are some code chunks and some symbols extracted from the chunks. Your job is to select the most relevant symbol to the user query. Do not answer with the siymbol name, use the symbol key/alias.\n\nQuery:{}", chunks_string.as_str(),  query);

        // function_call
        let filter_function = serde_json::from_value::<Vec<llm_gateway::api::Function>>(serde_json::json!([
            {
                "name": "filter",
                "description":  "Select the symbol most likely to contain information to answer the query",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "symbol": {
                            "type": "integer",
                            "description": "The symbol alias"
                        }
                    },
                    "required": ["symbol"]
                }
            }])
        )
        .unwrap();

        let llm_response = match self.llm_with_function_call(prompt, filter_function).await {
            Ok(llm_response) => llm_response,
            Err(e) => {
                warn!(
                    "Symbol classifier llm call failed, picking the first symbol: {}",
                    e
                );
                llm_gateway::api::FunctionCall {
                    name: Some("filter".to_string()),
                    arguments: "{\"symbol\": 0}".to_string(),
                }
            }
        };

        let filter_argument: Filter =
            match serde_json::from_str(llm_response.clone().arguments.as_str()) {
                Ok(argument) => argument,
                Err(_e) => {
                    warn!("Cannot deserialize: {:?}", llm_response);
                    return Err(SymbolError::DeserializeFilter);
                }
            };

        let selected_symbol = filter_argument.symbol;

        // finding symbol metadata
        match symbols
            .into_iter()
            .flat_map(|(_, symbol_with_alias)| symbol_with_alias)
            .find(|(alias, _)| *alias == selected_symbol as i32)
        {
            Some((_alias, symbol_metadata)) => Ok(symbol_metadata),
            _ => Err(SymbolError::OutOfBounds),
        }
    }

    pub async fn get_related_chunks(&mut self, chunks: Vec<CodeChunk>) -> Vec<CodeChunk> {
        const MAX_CHUNKS: usize = 3;

        // get symbols with ref/defs for each chunk
        let chunks_with_symbols = futures::future::join_all(
            chunks
                .iter()
                .filter(|c| !c.is_empty())
                .map(|c| self.extract_symbols(c.clone())), // TODO: Log failure
        )
        .await
        .into_iter()
        .filter_map(Result::ok)
        .collect();

        // get original user query
        let user_query = self.last_exchange().query.target().unwrap();

        // select one symbol
        let selected_symbol = match self.filter_symbols(&user_query, chunks_with_symbols).await {
            Ok(selected_symbol) => selected_symbol,
            Err(e) => {
                info!("Returning no extra chunks: {}", e);
                return Vec::new();
            }
        };

        // get expanded chunks for selected symbol
        let extra_chunks = self.expand_symbol_into_chunks(selected_symbol).await;

        // take 3 chunks, update path aliases, update enchange chunks
        let extra_chunks = extra_chunks
            .iter()
            .take(MAX_CHUNKS)
            .map(|c| {
                let chunk = CodeChunk {
                    alias: self.get_path_alias(c.path.as_str()),
                    ..c.clone()
                };
                self.exchanges
                    .last_mut()
                    .unwrap()
                    .code_chunks
                    .push(chunk.clone());
                chunk
            })
            .collect::<Vec<_>>();
        extra_chunks
    }

    async fn llm_with_function_call(
        &self,
        prompt: String,
        functions: Vec<llm_gateway::api::Function>,
    ) -> Result<llm_gateway::api::FunctionCall, anyhow::Error> {
        let messages = vec![llm_gateway::api::Message::user(prompt.as_str())];

        self.llm_gateway
            .clone()
            .model("gpt-3.5-turbo-0613")
            .temperature(0.0)
            .chat_stream(&messages, Some(&functions))
            .await?
            .try_fold(
                llm_gateway::api::FunctionCall::default(),
                |acc: llm_gateway::api::FunctionCall, e: String| async move {
                    let e: llm_gateway::api::FunctionCall =
                        serde_json::from_str(&e).map_err(|err| {
                            tracing::error!(
                                "Failed to deserialize to FunctionCall: {:?}. Error: {:?}",
                                e,
                                err
                            );
                            err
                        })?;
                    Ok(llm_gateway::api::FunctionCall {
                        name: acc.name.or(e.name),
                        arguments: acc.arguments + &e.arguments,
                    })
                },
            )
            .await
    }
}

pub struct Symbol {
    pub name: String,
    pub related_symbols: Vec<FileSymbols>,
}
#[derive(serde::Deserialize)]
struct Filter {
    symbol: usize,
}

#[derive(thiserror::Error, Debug)]
pub enum SymbolError {
    #[error("No symbol retrieved in the provided chunks")]
    ListEmpty,
    #[error("Cannot deserialize llm function call arguments")]
    DeserializeFilter,
    #[error("Selected symbol out of bounds")]
    OutOfBounds,
}
