use std::{collections::HashMap, ops::Not, sync::Arc};

use super::prelude::*;
use crate::{
    indexes::{reader::ContentDocument, Indexes},
    intelligence::{
        code_navigation::{
            self, CodeNavigationContext, FileSymbols, Occurrence, OccurrenceKind, Token,
        },
        Language, NodeKind, TSLanguage,
    },
    repo::RepoRef,
    snippet::Snipper,
    text_range::{self, TextRange},
};

use ::serde::{Deserialize, Serialize};
use axum::{extract::Query, response::IntoResponse, Extension};
use stack_graphs::{arena, graph, partial, serde, stitching};
use tracing::info;

/// The request made to the `local-intel` endpoint.
#[derive(Debug, Deserialize)]
pub(super) struct TokenInfoRequest {
    /// The repo_ref of the file of interest
    repo_ref: String,

    /// The path to the file of interest, relative to the repo root
    relative_path: String,

    /// Branch name to use for the lookup,
    branch: Option<String>,

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

fn within_span(point: crate::text_range::Point, span: &lsp_positions::Span) -> bool {
    (span.start.line == point.line && span.start.column.grapheme_offset <= point.column)
        && (span.end.line == point.line && span.end.column.grapheme_offset >= point.column)
}

pub fn find_node_handle(
    source_document: &ContentDocument,
    payload_range: std::ops::Range<usize>,
    combined_graph: &graph::StackGraph,
) -> Option<arena::Handle<graph::Node>> {
    let payload_range =
        TextRange::from_byte_range(payload_range, &source_document.line_end_indices);
    let ts_range = tree_sitter::Range::from(payload_range);
    dbg!(&payload_range);
    dbg!(&source_document.relative_path);
    let (deser_graph, _db) = source_document.symbol_locations.stack_graph()?;

    // dbg pieces
    //
    // combined_graph
    //     .iter_nodes()
    //     .filter(|handle| {
    //         combined_graph[*handle]
    //             .file()
    //             .map(|f_handle| combined_graph[f_handle].name())
    //             .map(|file| file.ends_with(source_document.relative_path.as_str()))
    //             .unwrap_or_default()
    //     })
    //     .filter(|handle| {
    //         combined_graph[*handle].is_reference() || combined_graph[*handle].is_definition()
    //     })
    //     .for_each(|handle| {
    //         print!("handle: {}", combined_graph[handle].display(combined_graph));
    //         if let Some(source_info) = combined_graph.source_info(handle) {
    //             print!(
    //                 " with span L{},C{} - L{},C{}",
    //                 source_info.span.start.line,
    //                 source_info.span.start.column.grapheme_offset,
    //                 source_info.span.end.line,
    //                 source_info.span.end.column.grapheme_offset
    //             );
    //         }
    //         println!()
    //     });

    combined_graph.iter_nodes().find(|handle| {
        let is_reference = combined_graph[*handle].is_reference();
        let is_definition = combined_graph[*handle].is_definition();
        let is_scope = combined_graph[*handle].scope().is_some();
        let is_root = combined_graph[*handle].is_root();
        let is_jump_to = combined_graph[*handle].is_jump_to();

        let present_in_target_file = combined_graph[*handle]
            .file()
            .map(|f_handle| combined_graph[f_handle].name())
            .map(|file| file.ends_with(source_document.relative_path.as_str()))
            .unwrap_or_default();

        let contains_payload = match combined_graph.source_info(*handle) {
            Some(source_info) => within_span(payload_range.start, &source_info.span),
            None => false,
        };

        let found = (is_reference || is_definition)
            && contains_payload
            && present_in_target_file
            && !is_root
            && !is_jump_to
            && !is_scope;

        if found {
            dbg!(
                &is_reference,
                &is_definition,
                &contains_payload,
                &is_root,
                &is_jump_to,
                &is_scope
            );

            info!(
                "found handle {}",
                combined_graph[*handle].display(&combined_graph),
            );
        }
        found
    })
}

pub(super) async fn handle(
    Query(payload): Query<TokenInfoRequest>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> Result<impl IntoResponse> {
    let start_of_handle = std::time::Instant::now();
    let repo_ref = payload.repo_ref.parse::<RepoRef>().map_err(Error::user)?;

    let token = Token {
        relative_path: payload.relative_path.as_str(),
        start_byte: payload.start,
        end_byte: payload.end,
    };

    let source_document = indexes
        .file
        .by_path(&repo_ref, &payload.relative_path, payload.branch.as_deref())
        .await
        .map_err(Error::user)?
        .ok_or_else(|| Error::user("path not found").with_status(StatusCode::NOT_FOUND))?;
    let lang = source_document.lang.as_deref();
    let all_docs = {
        let associated_langs = match lang.map(TSLanguage::from_id) {
            Some(Language::Supported(config)) => config.language_ids,
            _ => &[],
        };
        indexes
            .file
            .by_repo(
                &repo_ref,
                associated_langs.iter(),
                payload.branch.as_deref(),
            )
            .await
    };
    info!(
        "found all docs at {}ms",
        start_of_handle.elapsed().as_millis()
    );

    let source_document_idx = all_docs
        .iter()
        .position(|doc| doc.relative_path == payload.relative_path)
        .ok_or(Error::internal("invalid language"))?;

    let (mut combined_graph, mut combined_db, mut partials) = all_docs.iter().fold(
        (
            graph::StackGraph::new(),
            stitching::Database::new(),
            partial::PartialPaths::new(),
        ),
        |(mut combined_graph, mut combined_db, mut partials), doc| {
            let sg = doc.symbol_locations.stack_graph();
            if let Some((g, d)) = sg {
                let _ = g.load_into(&mut combined_graph);
                let _ = d.load_into(&mut combined_graph, &mut partials, &mut combined_db);
            }
            (combined_graph, combined_db, partials)
        },
    );
    info!(
        "load and combine graph at {}ms",
        start_of_handle.elapsed().as_millis()
    );

    let handle = find_node_handle(
        &all_docs[source_document_idx],
        payload.start..payload.end,
        &combined_graph,
    )
    .expect("payload range is not a valid code-nav range");
    info!("find handle at {}ms", start_of_handle.elapsed().as_millis());

    // TODO: use initial paths to seed ForwardPartialPathStitcher:
    // - lot faster probably
    // - opens up possibilities of cancellation/streaming/controlled searches
    //
    // e.g.: perform path extension N times and stop, resume the calculation
    // on the click of a `show more` button
    //
    // let initial_paths = {
    //     let mut p = partial::PartialPath::from_node(&combined_graph, &mut partials, handle);
    //     p.eliminate_precondition_stack_variables(&mut partials);
    //     p
    // };

    let mut def_paths = Vec::new();
    let _ = dbg!(
        stitching::ForwardPartialPathStitcher::find_all_complete_partial_paths(
            &combined_graph,
            &mut partials,
            &mut combined_db,
            vec![handle],
            &stack_graphs::NoCancellation,
            |_, _, p| {
                def_paths.push(p.clone());
            },
        )
    );
    info!(
        "path stitching at {}ms",
        start_of_handle.elapsed().as_millis()
    );

    // repetitive code bunched under an uninspiring name
    // TODO: refactor
    let process = |handle: arena::Handle<graph::Node>, combined_graph: &graph::StackGraph| {
        let file_handle = combined_graph[handle].file()?;
        let file = combined_graph[file_handle].name();
        let doc = all_docs
            .iter()
            .find(|d| file.ends_with(d.relative_path.as_str()))?;

        let range = combined_graph.source_info(handle).map(|source_info| {
            let start = {
                let pt = source_info.span.start.as_point();

                text_range::Point::from_line_column(
                    pt.row.saturating_sub(1),
                    pt.column,
                    &doc.line_end_indices,
                )
            };
            let end = {
                let pt = source_info.span.end.as_point();
                text_range::Point::from_line_column(
                    pt.row.saturating_sub(1),
                    pt.column,
                    &doc.line_end_indices,
                )
            };
            TextRange::new(start, end)
        })?;
        info!("range of definiton: {:?}", range);
        let occurrence = code_navigation::to_occurrence(doc, range);
        Some((doc.relative_path.as_str(), occurrence, range))
    };

    let mut file_symbols: HashMap<String, Vec<Occurrence>> = HashMap::new();

    dbg!(def_paths.len());
    for p in def_paths {
        println!("{}", p.display(&combined_graph, &mut partials));
        if p.start_node == handle && p.ends_at_definition(&combined_graph) {
            let end_node = p.end_node;
            if let Some((path, snippet, range)) = process(end_node, &combined_graph) {
                let o = Occurrence {
                    kind: OccurrenceKind::Definition,
                    range,
                    snippet,
                };
                file_symbols
                    .entry(path.to_owned())
                    .or_insert_with(Vec::new)
                    .push(o);
            }
        }
    }
    info!(
        "filtering partial paths at {}ms",
        start_of_handle.elapsed().as_millis()
    );

    let data = file_symbols
        .into_iter()
        .map(|(file, data)| FileSymbols { file, data })
        .collect::<Vec<_>>();

    info!(
        "building response at {}ms",
        start_of_handle.elapsed().as_millis()
    );
    info!(
        "intelligence::handle {}ms",
        start_of_handle.elapsed().as_millis()
    );

    return Ok(json(TokenInfoResponse::new(data)));

    // let ctx = CodeNavigationContext {
    //     repo_ref: repo_ref.clone(),
    //     token,
    //     all_docs,
    //     source_document_idx,
    // };

    // let data = ctx.token_info();
    // if data.is_empty() {
    //     search_nav(
    //         Arc::clone(&indexes),
    //         &repo_ref,
    //         ctx.active_token_text(),
    //         ctx.active_token_range(),
    //         payload.branch.as_deref(),
    //         &source_document,
    //     )
    //     .await
    //     .map(TokenInfoResponse::new)
    //     .map(json)
    // } else {
    //     Ok(json(TokenInfoResponse { data }))
    // }
}

async fn search_nav(
    indexes: Arc<Indexes>,
    repo_ref: &RepoRef,
    hovered_text: &str,
    payload_range: std::ops::Range<usize>,
    branch: Option<&str>,
    source_document: &ContentDocument,
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

    let associated_langs = match source_document.lang.as_deref().map(TSLanguage::from_id) {
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
            .chain(
                branch
                    .into_iter()
                    .map(|b| {
                        trigrams(b)
                            .map(|token| {
                                Term::from_field_text(indexer.source.branches, token.as_str())
                            })
                            .map(|term| TermQuery::new(term, IndexRecordOption::Basic))
                            .map(Box::new)
                            .map(|q| q as Box<dyn tantivy::query::Query>)
                            .collect::<Vec<_>>()
                    })
                    .map(BooleanQuery::intersection)
                    .map(Box::new)
                    .map(|b| b as Box<dyn tantivy::query::Query>),
            )
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

    // if the hovered token is a def, ignore all other search-based defs
    let ignore_defs = {
        source_document
            .symbol_locations
            .scope_graph()
            .and_then(|graph| {
                graph
                    .node_by_range(payload_range.start, payload_range.end)
                    .map(|idx| matches!(graph.graph[idx], NodeKind::Def(_)))
            })
            .unwrap_or_default()
    };

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
                .filter(|o| !(ignore_defs && o.is_definition())) // if ignore_defs is true & o is a def, omit it
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
    use crate::{snippet::Snippet, text_range::Point};

    #[test]
    fn serialize_response() {
        let expected = serde_json::json!({
            "data": [
                {
                    "file": "server/bleep/src/symbol.rs",
                    "data": [{
                        "kind": "definition",
                        "range": {
                            "start": { "byte": 2620, "line": 90, "column": 0  },
                            "end": { "byte": 2627, "line": 90, "column": 0  },
                        },
                        "snippet": {
                            "highlights": [ { "start": 12, "end": 19 } ],
                            "data": "        let indexes = Indexes::new(self.clone(), threads).await?;\n",
                            "line_range": { "start": 91, "end": 92 },
                            "symbols": []
                        }
                    }]

                },
                {
                    "file": "server/bleep/src/intelligence/scope_resolution.rs",
                    "data": [{
                        "kind": "reference",
                        "range": {
                            "start": { "byte": 2725, "line": 93, "column": 0  },
                            "end": { "byte": 2732, "line": 93, "column": 0  },
                        },
                        "snippet": {
                            "highlights": [ { "start": 12, "end": 19 } ],
                            "data": "            indexes.reindex().await?;\n",
                            "line_range": { "start": 94, "end": 95 },
                            "symbols": []
                        }
                    }]
                }
            ]
        });

        let observed = serde_json::to_value(TokenInfoResponse {
            data: vec![
                FileSymbols {
                    file: "server/bleep/src/symbol.rs".into(),
                    data: vec![Occurrence {
                    kind: OccurrenceKind::Definition,
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
                },
                FileSymbols {
                    file: "server/bleep/src/intelligence/scope_resolution.rs".into(),
                    data: vec![Occurrence {
                        kind: OccurrenceKind::Reference,
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
                },
            ],
        })
        .unwrap();

        pretty_assertions::assert_eq!(expected, observed)
    }
}
