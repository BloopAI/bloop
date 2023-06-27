use std::{ops::Not, sync::Arc};

use super::prelude::*;
use crate::{
    indexes::Indexes,
    intelligence::{
        code_navigation::{CodeNavigationContext, FileSymbols, Occurrence, OccurrenceKind, Token},
        Language, NodeKind, TSLanguage,
    },
    repo::RepoRef,
    snippet::Snipper,
    text_range::TextRange,
};

use axum::{extract::Query, response::IntoResponse, Extension};
use serde::{Deserialize, Serialize};

/// The request made to the `local-intel` endpoint.
#[derive(Debug, Deserialize)]
pub(super) struct TokenInfoRequest {
    /// The repo_ref of the file of interest
    repo_ref: String,

    /// The path to the file of interest, relative to the repo root
    relative_path: String,

    /// The byte range to look for
    start: usize,
    end: usize,
}

/// The response from the `local-intel` endpoint.
#[derive(Serialize, Debug)]
pub(super) struct TokenInfoResponse {
    data: Vec<FileSymbols>,
}

impl TokenInfoResponse {
    fn new(data: Vec<FileSymbols>) -> Self {
        Self { data }
    }
}

impl super::ApiResponse for TokenInfoResponse {}

pub(super) async fn handle(
    Query(payload): Query<TokenInfoRequest>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> Result<impl IntoResponse> {
    let repo_ref = payload.repo_ref.parse::<RepoRef>().map_err(Error::user)?;

    let token = Token {
        relative_path: payload.relative_path.as_str(),
        start_byte: payload.start,
        end_byte: payload.end,
    };

    let content = indexes
        .file
        .by_path(&repo_ref, &payload.relative_path)
        .await
        .map_err(Error::user)?;
    let lang = content.lang.as_deref();
    let all_docs = {
        let associated_langs = match lang.map(TSLanguage::from_id) {
            Some(Language::Supported(config)) => config.language_ids,
            _ => &[],
        };
        indexes
            .file
            .by_repo(&repo_ref, associated_langs.iter())
            .await
    };

    let source_document_idx = all_docs
        .iter()
        .position(|doc| doc.relative_path == payload.relative_path)
        .ok_or(Error::internal("invalid language"))?;

    let ctx = CodeNavigationContext {
        repo_ref: repo_ref.clone(),
        token,
        indexes: Arc::clone(&indexes),
        all_docs,
        source_document_idx,
    };

    let data = ctx.token_info();

    if data.is_empty() {
        search_nav(
            Arc::clone(&indexes),
            &repo_ref,
            ctx.active_token_text(),
            ctx.active_token_range(),
            lang.map(str::to_string),
        )
        .await
        .map(TokenInfoResponse::new)
        .map(json)
    } else {
        Ok(json(TokenInfoResponse { data }))
    }
}

async fn search_nav(
    indexes: Arc<Indexes>,
    repo_ref: &RepoRef,
    hovered_text: &str,
    payload_range: std::ops::Range<usize>,
    lang: Option<String>,
) -> Result<Vec<FileSymbols>> {
    use crate::{
        indexes::{reader::ContentReader, DocumentRead},
        query::compiler::trigrams,
    };
    use tantivy::{
        collector::TopDocs,
        query::{BooleanQuery, TermQuery},
        schema::{IndexRecordOption, Term},
    };

    let associated_langs = match lang.as_deref().map(TSLanguage::from_id) {
        Some(Language::Supported(config)) => config.language_ids,
        _ => &[],
    };

    // produce search based results here
    let target = regex::Regex::new(&format!(r"\b{hovered_text}\b")).expect("failed to build regex");
    // perform a text search for hovered_text
    let file_source = &indexes.file.source;
    let indexer = &indexes.file;
    let query = {
        let repo_filter = Term::from_field_text(indexer.source.repo_ref, &repo_ref.to_string());
        let terms = trigrams(hovered_text)
            .map(|token| Term::from_field_text(indexer.source.content, token.as_str()))
            .map(|term| {
                Box::new(TermQuery::new(term, IndexRecordOption::Basic))
                    as Box<dyn tantivy::query::Query>
            })
            .chain(std::iter::once(
                Box::new(TermQuery::new(repo_filter, IndexRecordOption::Basic))
                    as Box<dyn tantivy::query::Query>,
            ))
            .chain(std::iter::once(Box::new(BooleanQuery::union(
                associated_langs
                    .iter()
                    .map(|l| {
                        Term::from_field_bytes(
                            indexer.source.lang,
                            l.to_ascii_lowercase().as_bytes(),
                        )
                    })
                    .map(|l| {
                        Box::new(TermQuery::new(l, IndexRecordOption::Basic))
                            as Box<dyn tantivy::query::Query>
                    })
                    .collect::<Vec<_>>(),
            ))
                as Box<dyn tantivy::query::Query>))
            .collect::<Vec<Box<dyn tantivy::query::Query>>>();
        BooleanQuery::intersection(terms)
    };
    let collector = TopDocs::with_limit(500);
    let reader = indexes.file.reader.read().await;
    let searcher = reader.searcher();
    let results = searcher
        .search(&query, &collector)
        .expect("failed to search index");

    let data = results
        .into_iter()
        .filter_map(|(_, doc_addr)| {
            let retrieved_doc = searcher
                .doc(doc_addr)
                .expect("failed to get document by address");
            let doc = ContentReader.read_document(file_source, retrieved_doc);
            let hoverable_ranges = doc.hoverable_ranges()?;
            let data = target
                .find_iter(&doc.content)
                .map(|m| TextRange::from_byte_range(m.range(), &doc.line_end_indices))
                .filter(|range| hoverable_ranges.iter().any(|r| r.contains(range)))
                .filter(|range| {
                    !(payload_range.start >= range.start.byte
                        && payload_range.end <= range.end.byte)
                })
                .map(|range| {
                    let start_byte = range.start.byte;
                    let end_byte = range.end.byte;
                    let is_def = doc
                        .symbol_locations
                        .scope_graph()
                        .and_then(|graph| {
                            graph
                                .node_by_range(start_byte, end_byte)
                                .map(|idx| matches!(graph.graph[idx], NodeKind::Def(_)))
                        })
                        .map(|d| {
                            if d {
                                OccurrenceKind::Definition
                            } else {
                                OccurrenceKind::Reference
                            }
                        })
                        .unwrap_or_default();
                    let highlight = start_byte..end_byte;
                    let snippet = Snipper::default()
                        .expand(highlight, &doc.content, &doc.line_end_indices)
                        .reify(&doc.content, &[]);

                    Occurrence {
                        kind: is_def,
                        range,
                        snippet,
                    }
                })
                .collect::<Vec<_>>();

            let file = doc.relative_path;

            data.is_empty().not().then(|| FileSymbols {
                file: file.clone(),
                data,
            })
        })
        .collect::<Vec<_>>();

    Ok(data)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::text_range::Point;

    #[test]
    fn serialize_response_reference() {
        let expected = serde_json::json!({
            "kind": "reference",
            "definitions": [{
                "file": "server/bleep/src/symbol.rs",
                "data": [{
                    "start": { "byte": 2620, "line": 90, "column": 0  },
                    "end": { "byte": 2627, "line": 90, "column": 0  },
                    "snippet": {
                        "highlights": [ { "start": 12, "end": 19 } ],
                        "data": "        let indexes = Indexes::new(self.clone(), threads).await?;\n",
                        "line_range": { "start": 91, "end": 92 },
                        "symbols": [],
                    }
                }]
            }],
            "references": [{
                "file": "server/bleep/src/intelligence/scope_resolution.rs",
                "data": [{
                    "start": { "byte": 2725, "line": 93, "column": 0  },
                    "end": { "byte": 2732, "line": 93, "column": 0  },
                    "snippet": {
                        "highlights": [ { "start": 12, "end": 19 } ],
                        "symbols": [],
                        "line_range": { "start": 94, "end": 95 },
                        "data": "            indexes.reindex().await?;\n"
                    }
                }]
            }]
        });

        let observed = serde_json::to_value(TokenInfoResponse::Reference {
            definitions: vec![FileSymbols {
                file: "server/bleep/src/symbol.rs".into(),
                data: vec![SymbolOccurrence {
                    range: TextRange {
                        start: Point {
                            byte: 2620,
                            line: 90,
                            column: 0,
                        },
                        end: Point {
                            byte: 2627,
                            line: 90,
                            column: 0,
                        },
                    },
                    snippet: Snippet {
                        line_range: 91..92,
                        data: "        let indexes = Indexes::new(self.clone(), threads).await?;\n"
                            .to_owned(),
                        highlights: vec![12..19],
                        symbols: vec![],
                    },
                }],
            }],
            references: vec![FileSymbols {
                file: "server/bleep/src/intelligence/scope_resolution.rs".into(),
                data: vec![SymbolOccurrence {
                    range: TextRange {
                        start: Point {
                            byte: 2725,
                            line: 93,
                            column: 0,
                        },
                        end: Point {
                            byte: 2732,
                            line: 93,
                            column: 0,
                        },
                    },
                    snippet: Snippet {
                        line_range: 94..95,
                        data: "            indexes.reindex().await?;\n".to_owned(),
                        highlights: vec![12..19],
                        symbols: vec![],
                    },
                }],
            }],
        })
        .unwrap();

        pretty_assertions::assert_eq!(expected, observed)
    }

    #[test]
    fn serialize_response_definition() {
        let expected = serde_json::json!({
            "kind": "definition",
            "references": [{
                "file": "server/bleep/benches/snippets.rs",
                "data": [{
                    "start": { "byte": 2725, "line": 93, "column": 0 },
                    "end": { "byte": 2732, "line": 93, "column": 0  },
                    "snippet": {
                        "highlights": [ { "start": 12, "end": 19 } ],
                        "line_range": { "start": 94, "end": 95 },
                        "data": "            indexes.reindex().await?;\n",
                        "symbols": []
                    }
                }]
            }]
        });

        let observed = serde_json::to_value(TokenInfoResponse::Definition {
            references: vec![FileSymbols {
                file: "server/bleep/benches/snippets.rs".into(),
                data: vec![SymbolOccurrence {
                    range: TextRange {
                        start: Point {
                            byte: 2725,
                            line: 93,
                            column: 0,
                        },
                        end: Point {
                            byte: 2732,
                            line: 93,
                            column: 0,
                        },
                    },
                    snippet: Snippet {
                        line_range: 94..95,
                        data: "            indexes.reindex().await?;\n".to_owned(),
                        highlights: vec![12..19],
                        symbols: vec![],
                    },
                }],
            }],
        })
        .unwrap();

        assert_eq!(expected, observed)
    }
}
