use crate::agent::{exchange::CodeChunk, Agent};
use crate::intelligence::{code_navigation::FileSymbols, Language, TSLanguage};
use crate::llm_gateway;
use crate::webserver::intelligence::{get_token_info, TokenInfoRequest};
use anyhow::{Context, Result};
use tracing::log::{debug, info, warn};

use super::exchange::RepoPath;
use super::prompts::symbol_classification_prompt;

pub struct ChunkWithHoverableSymbols {
    pub chunk: CodeChunk,
    pub symbols: Vec<HoverableSymbol>,
}

/// This helps the code and proc tool return related chunks based on references and definitions.
/// `get_related_chunks` receives a list of chunks from code or proc search and returns `MAX_CHUNKS` related chunks
/// For each input chunk, we extract all symbols (variables, function names, structs...).
/// Then we disconsider symbols that are defined in the same file using the scope graph.
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
            .by_path(&chunk.repo_path.repo, &chunk.repo_path.path, None)
            .await?
            .with_context(|| format!("failed to read path: {}", &chunk.repo_path))?;

        let graph = document
            .symbol_locations
            .scope_graph()
            .with_context(|| format!("no scope graph for file: {}", &chunk.repo_path))?;

        let hoverable_ranges = document
            .hoverable_ranges()
            .ok_or_else(|| anyhow::anyhow!("no hoverable ranges"))?;

        let mut symbols = hoverable_ranges
            .into_iter()
            .filter(|range| {
                (range.start.byte >= chunk.start_byte.unwrap_or_default())
                    && (range.start.byte < chunk.end_byte.unwrap_or_default())
            })
            .filter(|range| {
                // if this node can be resolved locally in the scope-graph, omit it
                if let Some(node_by_range) = graph.node_by_range(range.start.byte, range.end.byte) {
                    if graph.is_reference(node_by_range) || graph.is_definition(node_by_range) {
                        return false;
                    }
                }
                true
            })
            .map(|range| HoverableSymbol {
                name: chunk.snippet[(range.start.byte - chunk.start_byte.unwrap_or_default())
                    ..(range.end.byte - chunk.start_byte.unwrap_or_default())]
                    .to_string(),
                token_info_request: TokenInfoRequest {
                    relative_path: chunk.repo_path.path.clone(),
                    repo_ref: chunk.repo_path.repo.indexed_name(),
                    branch: None,
                    start: range.start.byte,
                    end: range.end.byte,
                },
                repo_path: chunk.repo_path.clone(),
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
                        repo_path: RepoPath {
                            repo: file_symbols.repo.clone(),
                            path: filename.clone(),
                        },
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

        const NUMBER_CHUNK_LINES: usize = 10;

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
                    "```{}\n{}```\n\n{}",
                    c.repo_path,
                    c.snippet.clone(),
                    symbols_string
                )
            })
            .collect::<Vec<_>>()
            .join("\n\n");

        // instruction
        let messages = vec![
            llm_gateway::api::Message::system(&symbol_classification_prompt(&chunks_string)),
            llm_gateway::api::Message::user(query),
        ];

        let response = match self
            .llm_gateway
            .clone()
            .model("gpt-4-0613")
            .temperature(0.0)
            .max_tokens(5)
            .chat(&messages, None)
            .await
        {
            Ok(response) => response,
            Err(e) => {
                warn!(
                    "Symbol classifier llm call failed, picking the first symbol: {}",
                    e
                );
                "0".into()
            }
        };

        let selected_symbol = match response.as_str().parse::<i32>() {
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
            .find(|(alias, _)| *alias == selected_symbol)
        {
            Some((_alias, symbol_metadata)) => Ok(Symbol {
                name: symbol_metadata.name,
                related_symbols: {
                    let document = self
                        .app
                        .indexes
                        .file
                        .by_path(
                            &symbol_metadata.repo_path.repo,
                            &symbol_metadata.repo_path.path,
                            None,
                        )
                        .await?
                        .context("Document is None")?;

                    let all_docs = {
                        let associated_langs =
                            match document.lang.as_deref().map(TSLanguage::from_id) {
                                Some(Language::Supported(config)) => config.language_ids,
                                _ => &[],
                            };
                        self.app
                            .indexes
                            .file
                            .by_repo(
                                &symbol_metadata.repo_path.repo,
                                associated_langs.iter(),
                                None,
                            )
                            .await
                    };

                    get_token_info(
                        symbol_metadata.token_info_request,
                        &symbol_metadata.repo_path.repo,
                        self.app.indexes.clone(),
                        &document,
                        &all_docs,
                        Some(0),
                        Some(NUMBER_CHUNK_LINES),
                    )
                    .await?
                    .into_iter()
                    .filter(|file_symbol| {
                        file_symbol.file != symbol_metadata.repo_path.path
                            || file_symbol.repo != symbol_metadata.repo_path.repo
                    })
                    .collect::<Vec<_>>()
                },
            }),
            _ => Err(SymbolError::OutOfBounds),
        }
    }

    pub async fn get_related_chunks(&mut self, chunks: Vec<CodeChunk>) -> Result<Vec<CodeChunk>> {
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
        let user_query = self
            .last_exchange()
            .query
            .target()
            .context("Query has no target")?;

        // select one symbol
        let selected_symbol = match self.filter_symbols(&user_query, chunks_with_symbols).await {
            Ok(selected_symbol) => {
                info!("Selected symbol: {}", selected_symbol.name);
                selected_symbol
            }
            Err(e) => {
                info!("Returning no extra chunks: {}", e);
                return Ok(Vec::new());
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
                    alias: self.get_path_alias(&c.repo_path),
                    ..c.clone()
                };
                self.conversation
                    .exchanges
                    .last_mut()
                    .unwrap()
                    .code_chunks
                    .push(chunk.clone());
                chunk
            })
            .collect::<Vec<_>>();

        Ok(extra_chunks)
    }
}

pub struct HoverableSymbol {
    pub name: String,
    pub token_info_request: TokenInfoRequest,
    pub repo_path: RepoPath,
}
pub struct Symbol {
    pub name: String,
    pub related_symbols: Vec<FileSymbols>,
}

#[derive(thiserror::Error, Debug)]
pub enum SymbolError {
    #[error("No symbol retrieved in the provided chunks")]
    ListEmpty,
    #[error("Selected symbol out of bounds")]
    OutOfBounds,
    #[error("anyhow: {0:?}")]
    Anyhow(#[from] anyhow::Error),
}
