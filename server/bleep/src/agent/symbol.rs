use futures::TryStreamExt;

use crate::agent::exchange::CodeChunk;
use crate::agent::Agent;
use crate::intelligence::code_navigation::FileSymbols;
use crate::llm_gateway;
use crate::llm_gateway::api::{Function, FunctionCall};
use crate::webserver::hoverable::{inner_handle, HoverableRequest, HoverableResponse};
use crate::webserver::intelligence::{inner_handle as token_info, TokenInfoRequest};
use tracing::log::warn;

pub struct ChunkRefDef {
    pub chunk: CodeChunk,
    pub metadata: Vec<RefDefMetadata>,
}

impl Agent {
    pub async fn add_symbols_to_chunk(&self, chunk: CodeChunk) -> ChunkRefDef {
        const MAX_NUMBER_REF_DEF: usize = 5;

        let repo_ref = format!("{}", self.repo_ref);
        let indexes = self.app.indexes.clone();

        // get hoverable elements
        let hoverable_request = HoverableRequest {
            repo_ref: repo_ref.clone(),
            relative_path: chunk.path.clone(),
            branch: None,
        };
        let hoverable_response = inner_handle(hoverable_request, indexes.clone())
            .await
            .unwrap_or_else(|_e| HoverableResponse { ranges: Vec::new() });

        // for each symbol call token-info
        let token_info_vec = hoverable_response
            .ranges
            .iter()
            .filter(|range| {
                (range.start.byte >= chunk.start_byte) && (range.start.byte < chunk.end_byte)
            })
            .map(|range| {
                token_info(
                    TokenInfoRequest {
                        relative_path: chunk.path.clone(),
                        repo_ref: repo_ref.clone(),
                        branch: None,
                        start: range.start.byte,
                        end: range.end.byte,
                    },
                    indexes.clone(),
                )
            });

        let token_info_vec = futures::future::join_all(token_info_vec)
            .await
            .into_iter()
            .map(|response| response.unwrap())
            .collect::<Vec<_>>();

        // add metadata and return chunk enriched with metadata (symbols with ref/defs)

        ChunkRefDef {
            chunk: chunk.clone(),
            metadata: {
                let mut metadata = token_info_vec
                    .into_iter()
                    .zip(hoverable_response.ranges.into_iter().filter(|range| {
                        (range.start.byte >= chunk.start_byte)
                            && (range.start.byte < chunk.end_byte)
                    }))
                    .map(|(token_info, range)| {
                        let filtered_token_info = token_info
                            .data
                            .into_iter()
                            .filter(|file_symbols| file_symbols.file != chunk.path)
                            .collect::<Vec<_>>();

                        RefDefMetadata {
                            name: chunk.snippet.clone()[(range.start.byte - chunk.start_byte)
                                ..(range.end.byte - chunk.start_byte)]
                                .to_string(),
                            file_symbols: filtered_token_info,
                        }
                    })
                    .filter(|metadata| {
                        (metadata.file_symbols.len() < MAX_NUMBER_REF_DEF)
                            && (metadata.file_symbols.len() > 0)
                    }) // &&
                    .collect::<Vec<_>>();
                metadata.sort_by(|a, b| a.name.cmp(&b.name));
                metadata.dedup_by(|a, b| a.name == b.name);
                dbg!("Metadata length: {}", metadata.len());
                metadata
            },
        }
    }

    pub async fn expand_symbol_into_chunks(
        &self,
        ref_def_metadata: RefDefMetadata,
    ) -> Vec<CodeChunk> {
        const NUMBER_CHUNK_LINES: usize = 10;

        let contents = ref_def_metadata
            .file_symbols
            .iter()
            .map(|f_s| self.get_file_content(&f_s.file));

        let contents = futures::future::join_all(contents)
            .await
            .into_iter()
            .map(|content_document| content_document.unwrap().unwrap())
            .collect::<Vec<_>>();

        // each symbol may be in multiple files and have multiple occurences in each file
        ref_def_metadata
            .file_symbols
            .iter()
            .zip(contents.iter())
            .flat_map(|(file_symbols, content)| {
                let filename = file_symbols.file.clone();
                let content = content.content.lines().collect::<Vec<_>>();

                let n_lines = content.len();

                file_symbols
                    .data
                    .iter()
                    .map(|occurrence| {
                        let chunk_content = content[occurrence.range.start.line
                            ..(occurrence.range.end.line + NUMBER_CHUNK_LINES).min(n_lines)]
                            .to_vec()
                            .join("\n");
                        CodeChunk {
                            path: filename.clone(),
                            alias: 0,
                            snippet: chunk_content,
                            start_line: occurrence.range.start.line as usize,
                            end_line: (occurrence.range.end.line + NUMBER_CHUNK_LINES).min(n_lines)
                                as usize,
                            start_byte: 0 as usize,
                            end_byte: 0 as usize,
                        }
                    })
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>()
    }

    pub async fn filter_symbols(
        &self,
        query: &str,
        chunks_with_symbols: Vec<ChunkRefDef>,
    ) -> Result<RefDefMetadata, SymbolError> {
        let mut i: i32 = -1;
        // we have multiples chunks and each chunk may have multiple symbols
        // unique alias (i) per symbol
        let symbols = chunks_with_symbols
            .into_iter()
            .map(|chunk_with_symbol| {
                (
                    chunk_with_symbol.chunk,
                    chunk_with_symbol
                        .metadata
                        .into_iter()
                        .map(|symbol| {
                            i = i + 1;
                            (i, symbol)
                        })
                        .collect::<Vec<_>>(),
                )
            })
            .collect::<Vec<_>>();
        if i == -1 {
            return Err(SymbolError::SymbolListEmptyError);
        }

        // Classifier

        // context
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

        // instruction
        let prompt = format!("Snippets:\n\n{}\n\nInstruction: Above there are some code chunks and some symbols extracted from the chunks. Your job is to select the most relevant symbol to the user query. Do not answer with the siymbol name, use the symbol key/alias.\n\nQuery:{}", chunks_string.as_str(),  query);

        // function_call
        let filter_function = serde_json::from_value::<Vec<Function>>(serde_json::json!([
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

        let llm_response = match self.llm_with_function_call(prompt, filter_function).await {
            Ok(llm_response) => llm_response,
            Err(e) => {
                warn!(
                    "Symbol classifier llm call failed, picking the first symbol: {}",
                    e
                );
                FunctionCall {
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
                    return Err(SymbolError::DeserializeFilterError);
                }
            };

        let selected_symbol = filter_argument.symbol;

        // finding symbol metadata
        let output = match symbols
            .into_iter()
            .flat_map(|(_, symbol_with_alias)| symbol_with_alias)
            .find(|(alias, _)| alias.clone() == selected_symbol as i32)
        {
            Some((_alias, symbol_metadata)) => Ok(symbol_metadata),
            _ => Err(SymbolError::SymbolOutOfBoundsError),
        };

        output
    }

    pub async fn get_ref_def_extra_chunks(&mut self, chunks: Vec<CodeChunk>) -> Vec<CodeChunk> {
        const MAX_CHUNKS: usize = 3;

        // get symbols with ref/defs for each chunk
        let chunks_with_symbols = chunks
            .iter()
            .filter(|c| !c.is_empty())
            .map(|c| self.add_symbols_to_chunk(c.clone()));

        let chunks_with_symbols: Vec<ChunkRefDef> =
            futures::future::join_all(chunks_with_symbols).await;

        // get original user query
        let user_query = self.last_exchange().query.target().unwrap();

        // select one symbol
        let selected_symbol = match self.filter_symbols(&user_query, chunks_with_symbols).await {
            Ok(selected_symbol) => selected_symbol,
            Err(e) => {
                warn!("Returning no extra chunks: {}", e);
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
        extra_chunks
    }

    async fn llm_with_function_call(
        &self,
        prompt: String,
        functions: Vec<Function>,
    ) -> Result<FunctionCall, anyhow::Error> {
        let messages = vec![llm_gateway::api::Message::user(prompt.as_str())];

        let response = self
            .llm_gateway
            .clone()
            .model("gpt-3.5-turbo-0613")
            .temperature(0.0)
            .chat_stream(&messages, Some(&functions))
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
            .await;
        response
    }
}

pub struct RefDefMetadata {
    pub name: String,
    pub file_symbols: Vec<FileSymbols>,
}
#[derive(serde::Deserialize)]
struct Filter {
    symbol: usize,
}

#[derive(thiserror::Error, Debug)]
pub enum SymbolError {
    #[error("No symbol retrieved in the provided chunks")]
    SymbolListEmptyError,
    #[error("Cannot deserialize llm function call arguments")]
    DeserializeFilterError,
    #[error("Selected symbol out of bounds")]
    SymbolOutOfBoundsError,
}
