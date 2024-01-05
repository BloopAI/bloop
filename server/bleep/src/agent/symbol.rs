use futures::TryStreamExt;

use crate::agent::{exchange::CodeChunk, Agent};
use crate::intelligence::{code_navigation::FileSymbols, Language, TSLanguage};
use crate::llm_gateway;
use crate::webserver::intelligence::{get_token_info, TokenInfoRequest};
use anyhow::{Context, Result};
use tracing::log::{debug, info, warn};

use super::prompts::{filter_function, symbol_classification_prompt};

pub struct ChunkWithSymbols {
    pub chunk: CodeChunk,
    pub symbols: Vec<Symbol>,
}

pub struct ChunkWithHoverableSymbols {
    pub chunk: CodeChunk,
    pub symbols: Vec<HoverableSymbol>,
}

/// This helps the code and proc tool return related chunks based on references and definitions.
/// `get_related_chunks` receives a list of chunks from code or proc search and returns `MAX_CHUNKS` related chunks
/// For each input chunk, we extract all symbols (variables, function names, structs...).
/// Then we search for symbol occurrences OUTSIDE the file of the current chunk.
/// We disconsider symbols with too many occurences (> `MAX_REF_DEFS`) as they are typically language related.
/// We then pick ONE symbol using a classifier (`filter_symbols`), where the classifier has access to user query, original chunks and filtered list of symbols.
/// This selected symbol may be present in many files one or more times.
/// We extract the surrounding code (up to `NUMBER_CHUNK_LINES` lines) for each occurence and pick `MAX_CHUNKS` occurrences/chunks.

impl Agent {
    pub async fn extract_hoverable_symbols(
        &self,
        chunk: CodeChunk,
    ) -> Result<ChunkWithHoverableSymbols> {
        // get hoverable elements
        let document = self
            .app
            .indexes
            .file
            .by_path(&self.repo_ref, &chunk.path, None)
            .await?
            .with_context(|| format!("failed to read path: {}", &chunk.path))?;

        let graph = document
            .symbol_locations
            .scope_graph()
            .with_context(|| format!("no scope graph for file: {}", &chunk.path))?;

        let hoverable_ranges = document
            .hoverable_ranges()
            .ok_or_else(|| anyhow::anyhow!("no hoverable ranges"))?;

        let mut symbols = hoverable_ranges
            .into_iter()
            .filter(|range| {
                (range.start.byte >= chunk.start_byte.unwrap_or_default())
                    && (range.start.byte < chunk.end_byte.unwrap_or_default())
            })
            .filter_map(|range| {
                // if this node can be resolved locally in the scope-graph, omit it
                if let Some(node_by_range) = graph.node_by_range(range.start.byte, range.end.byte) {
                    if graph.is_reference(node_by_range) || graph.is_definition(node_by_range) {
                        return None;
                    }
                }
                Some(range)
            })
            .map(|range| HoverableSymbol {
                name: chunk.snippet[(range.start.byte - chunk.start_byte.unwrap_or_default())
                    ..(range.end.byte - chunk.start_byte.unwrap_or_default())]
                    .to_string(),
                token_info_request: TokenInfoRequest {
                    relative_path: chunk.path.clone(),
                    repo_ref: self.repo_ref.display_name(),
                    branch: None,
                    start: range.start.byte,
                    end: range.end.byte,
                },
                path: chunk.path.clone(),
            })
            .collect::<Vec<_>>();

        symbols.sort_by(|a, b| a.name.cmp(&b.name));
        symbols.dedup_by(|a, b| a.name == b.name);

        debug!(
            "Attached {} symbols: {:?}",
            symbols.len(),
            symbols.iter().map(|s| s.name.as_str()).collect::<Vec<_>>()
        );

        Ok(ChunkWithHoverableSymbols {
            chunk: chunk.clone(),
            symbols,
        })
    }

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
                    (range.start.byte >= chunk.start_byte.unwrap_or_default())
                        && (range.start.byte < chunk.end_byte.unwrap_or_default())
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
            .zip(hoverable_ranges.into_iter().filter(|range| {
                (range.start.byte >= chunk.start_byte.unwrap_or_default())
                    && (range.start.byte < chunk.end_byte.unwrap_or_default())
            }))
            .map(|(token_info, range)| {
                let filtered_token_info = token_info
                    .into_iter()
                    .filter(|file_symbols| file_symbols.file != chunk.path)
                    .collect::<Vec<_>>();

                Symbol {
                    name: chunk.snippet[(range.start.byte - chunk.start_byte.unwrap_or_default())
                        ..(range.end.byte - chunk.start_byte.unwrap_or_default())]
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

    pub async fn expand_symbol_into_chunks(&self, symbol: Symbol) -> Vec<CodeChunk> {
        // each symbol may be in multiple files and have multiple occurences in each file
        symbol
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
                        start_byte: None,
                        end_byte: None,
                    })
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>()
    }

    pub async fn filter_symbols(
        &self,
        query: &str,
        chunks_with_symbols: Vec<ChunkWithHoverableSymbols>,
    ) -> Result<Symbol, SymbolError> {
        if chunks_with_symbols.is_empty() {
            return Err(SymbolError::ListEmpty);
        }

        // we have multiples chunks and each chunk may have multiple symbols
        // unique alias (i) per symbol
        let mut i: i32 = -1;
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
        let prompt = symbol_classification_prompt(chunks_string.as_str(), query);

        let llm_response = match self.llm_without_function_call(prompt.0, prompt.1).await {
            Ok(llm_response) => llm_response,
            Err(e) => {
                warn!(
                    "Symbol classifier llm call failed, picking the first symbol: {}",
                    e
                );
                "0".to_string()
            }
        };

        let selected_symbol = match llm_response.as_str().parse::<i32>() {
            Ok(symbol) => symbol,
            Err(e) => {
                warn!("Parsing to integer failed, picking the first symbol: {}", e);
                0
            }
        };

        // finding symbol metadata
        match symbols
            .into_iter()
            .flat_map(|(_, symbol_with_alias)| symbol_with_alias)
            .find(|(alias, _)| *alias == selected_symbol as i32)
        {
            Some((_alias, symbol_metadata)) => Ok(Symbol {
                name: symbol_metadata.name,
                related_symbols: {
                    let document = self
                        .app
                        .indexes
                        .file
                        .by_path(&self.repo_ref, &symbol_metadata.path, None)
                        .await
                        .unwrap()
                        .unwrap();

                    let all_docs = {
                        let associated_langs =
                            match document.lang.as_deref().map(TSLanguage::from_id) {
                                Some(Language::Supported(config)) => config.language_ids,
                                _ => &[],
                            };
                        self.app
                            .indexes
                            .file
                            .by_repo(&self.repo_ref, associated_langs.iter(), None)
                            .await
                    };

                    get_token_info(
                        symbol_metadata.token_info_request,
                        &self.repo_ref,
                        self.app.indexes.clone(),
                        &document,
                        &all_docs,
                        Some(0),
                        Some(10),
                    )
                    .await
                    .unwrap()
                    .into_iter()
                    .filter(|file_symbol| file_symbol.file != symbol_metadata.path)
                    .collect::<Vec<_>>()
                },
            }),
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
                .map(|c| self.extract_hoverable_symbols(c.clone())), // TODO: Log failure
        )
        .await
        .into_iter()
        .filter_map(Result::ok)
        .collect();

        // get original user query
        let user_query = self.last_exchange().query.target().unwrap();

        // select one symbol
        let selected_symbol = match self.filter_symbols(&user_query, chunks_with_symbols).await {
            Ok(selected_symbol) => {
                info!("Selected symbol: {}", selected_symbol.name);
                selected_symbol
            }
            Err(e) => {
                info!("Returning no extra chunks: {}", e);
                return Vec::new();
            }
        };

        // take 3 chunks, update path aliases, update enchange chunks
        let extra_chunks = self
            .expand_symbol_into_chunks(selected_symbol)
            .await
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

    async fn llm_without_function_call(
        &self,
        system_message: String,
        user_message: String,
    ) -> Result<String> {
        let messages = vec![
            llm_gateway::api::Message::system(system_message.as_str()),
            llm_gateway::api::Message::user(user_message.as_str()),
        ];

        self.llm_gateway
            .clone()
            .model("gpt-4-0613")
            .temperature(0.0)
            .chat(&messages, None)
            .await
    }

    async fn llm_with_function_call(
        &self,
        prompt: String,
        functions: Vec<llm_gateway::api::Function>,
    ) -> Result<llm_gateway::api::FunctionCall, anyhow::Error> {
        let messages = vec![llm_gateway::api::Message::user(prompt.as_str())];

        self.llm_gateway
            .clone()
            .model("gpt-4-0613")
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

pub struct HoverableSymbol {
    pub name: String,
    pub token_info_request: TokenInfoRequest,
    pub path: String,
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
