use std::{
    collections::{BTreeSet, HashMap},
    sync::Arc,
};

use super::prelude::*;
use crate::{
    indexes::{reader::ContentDocument, Indexes},
    intelligence::{code_navigation, NodeKind, ScopeGraph},
    repo::RepoRef,
    snippet::{Snipper, Snippet},
    symbol::SymbolLocations,
    text_range::{Point, TextRange},
};
use lsp_positions as _;

use axum::{extract::Query, response::IntoResponse, Extension};
use petgraph::graph::NodeIndex;
use serde::{Deserialize, Serialize};
use stack_graphs::{
    arena::Handle,
    graph::{Node, StackGraph},
    partial::PartialPaths,
    NoCancellation,
};
use tracing::info;
use utoipa::{IntoParams, ToSchema};

/// The request made to the `local-intel` endpoint.
#[derive(Debug, Deserialize, IntoParams)]
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
#[derive(Serialize, ToSchema)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub(super) enum TokenInfoResponse {
    /// The response returned when the input range is a definition
    Definition {
        /// A file-wise grouping of references, across this repo
        references: Vec<FileSymbols>,
    },
    /// The response returned when the input range is a reference
    Reference {
        /// The original definition(s) for this reference
        definitions: Vec<FileSymbols>,
        /// The other references in this document
        references: Vec<FileSymbols>,
    },
}

#[derive(Debug, Serialize, ToSchema)]
pub(super) struct FileSymbols {
    // FIXME: choose a better name
    /// The file to which the following occurrences belong
    file: String,

    /// A collection of symbol locations with context in this file
    data: Vec<SymbolOccurrence>,
}

impl FileSymbols {
    fn is_populated(&self) -> bool {
        !self.data.is_empty()
    }
}

/// An occurrence of a single symbol in a document, along with some context
#[derive(Debug, Serialize, ToSchema)]
pub(super) struct SymbolOccurrence {
    /// The precise range of this symbol
    #[serde(flatten)]
    pub(super) range: TextRange,

    /// A few lines of surrounding context
    pub(super) snippet: Snippet,
}

fn handle_definition_local(
    scope_graph: &ScopeGraph,
    idx: NodeIndex<u32>,
    doc: &ContentDocument,
) -> FileSymbols {
    let file = doc.relative_path.clone();
    let handler = code_navigation::CurrentFileHandler {
        scope_graph,
        idx,
        doc,
    };
    let data = handler
        .handle_definition()
        .into_iter()
        .map(|range| to_occurrence(doc, range))
        .collect();
    FileSymbols { file, data }
}

fn handle_definition_repo_wide(
    token: &[u8],
    kind: Option<&str>,
    start_file: &str,
    all_docs: &[ContentDocument],
) -> Vec<FileSymbols> {
    all_docs
        .iter()
        .filter(|doc| doc.relative_path != start_file) // do not look in the current file
        .filter_map(|doc| match &doc.symbol_locations {
            SymbolLocations::TreeSitter(scope_graph) => {
                let file = doc.relative_path.clone();
                let handler = code_navigation::RepoWideHandler {
                    token,
                    kind,
                    scope_graph,
                    doc,
                };
                let data = handler
                    .handle_definition()
                    .into_iter()
                    .map(|range| to_occurrence(doc, range))
                    .collect();
                Some(FileSymbols { file, data })
            }
            _ => None,
        })
        .collect()
}

fn handle_reference_local(
    scope_graph: &ScopeGraph,
    idx: NodeIndex<u32>,
    doc: &ContentDocument,
) -> (FileSymbols, FileSymbols) {
    let file = &doc.relative_path;
    let handler = code_navigation::CurrentFileHandler {
        scope_graph,
        idx,
        doc,
    };
    let (defs, refs) = handler.handle_reference();
    let def_data = FileSymbols {
        file: file.clone(),
        data: defs
            .into_iter()
            .map(|range| to_occurrence(doc, range))
            .collect(),
    };
    let ref_data = FileSymbols {
        file: file.clone(),
        data: refs
            .into_iter()
            .map(|range| to_occurrence(doc, range))
            .collect(),
    };

    (def_data, ref_data)
}

fn handle_reference_repo_wide(
    token: &[u8],
    kind: Option<&str>,
    start_file: &str,
    all_docs: &[ContentDocument],
) -> (Vec<FileSymbols>, Vec<FileSymbols>) {
    all_docs
        .iter()
        .filter(|doc| doc.relative_path != start_file) // do not look in the current file
        .filter_map(|doc| match &doc.symbol_locations {
            SymbolLocations::TreeSitter(scope_graph) => {
                let file = doc.relative_path.clone();
                let handler = code_navigation::RepoWideHandler {
                    token,
                    kind,
                    scope_graph,
                    doc,
                };
                let (defs, refs) = handler.handle_reference();

                let def_data = FileSymbols {
                    file: file.clone(),
                    data: defs
                        .into_iter()
                        .map(|range| to_occurrence(doc, range))
                        .collect(),
                };
                let ref_data = FileSymbols {
                    file,
                    data: refs
                        .into_iter()
                        .map(|range| to_occurrence(doc, range))
                        .collect(),
                };

                Some((def_data, ref_data))
            }
            _ => None,
        })
        .unzip()
}

fn to_occurrence(doc: &ContentDocument, range: TextRange) -> SymbolOccurrence {
    let src = &doc.content;
    let line_end_indices = &doc.line_end_indices;
    let highlight = range.start.byte..range.end.byte;
    let snippet = Snipper::default()
        .expand(highlight, src, line_end_indices)
        .reify(src, &[]);

    SymbolOccurrence { range, snippet }
}

// helper to merge two sets of file-symbols and omit the empty results
fn merge(
    a: impl IntoIterator<Item = FileSymbols>,
    b: impl IntoIterator<Item = FileSymbols>,
) -> Vec<FileSymbols> {
    a.into_iter()
        .chain(b.into_iter())
        .filter(FileSymbols::is_populated)
        .collect()
}

#[utoipa::path(
    get,
    path = "/token-info",
    params(TokenInfoRequest),
    responses(
        (status = 200, description = "Execute query successfully", body = TokenInfoResponse),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn handle(
    Query(payload): Query<TokenInfoRequest>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> Result<impl IntoResponse> {
    let repo_ref = payload.repo_ref.parse::<RepoRef>().map_err(Error::user)?;

    let content = indexes
        .file
        .by_path(&repo_ref, &payload.relative_path)
        .await
        .map_err(Error::user)?;

    let lang = content.lang.as_deref();
    let all_docs = indexes.file.by_repo(&repo_ref, lang).await;

    let doc_map = all_docs.iter().fold(HashMap::new(), |mut acc, x| {
        acc.insert(x.relative_path.as_str(), x);
        acc
    });

    let combined_graph: StackGraph = all_docs
        .iter()
        .filter_map(|doc| doc.symbol_locations.stack_graph())
        .fold(StackGraph::new(), |mut combined_graph, graph| {
            combined_graph.add_from_graph(graph);
            combined_graph
        });

    match content.symbol_locations {
        SymbolLocations::StackGraph(_) => {}
        SymbolLocations::TreeSitter(_) => {
            return Err(Error::user(
                "temporarily disabled, you shouldn't be seeing this in prod",
            ))
        }
        _ => return Err(Error::user("Intelligence is unavailable for this language")),
    };

    let src = &content.content;
    let payload_range = TextRange::from_byte_range(payload.start..payload.end, src);
    tracing::info!(?payload_range);

    let handle = combined_graph
        .iter_nodes()
        // .inspect(|n| tracing::info!("node: `{}`", stack_graph[*n].display(stack_graph)))
        .find(|handle| {
            let is_reference = combined_graph[*handle].is_reference();
            let is_definition = combined_graph[*handle].is_definition();
            let is_scope = combined_graph[*handle].scope().is_some();
            let is_root = combined_graph[*handle].is_root();
            let is_jump_to = combined_graph[*handle].is_jump_to();

            let present_in_target_file = combined_graph[*handle]
                .file()
                .map(|f_handle| combined_graph[f_handle].name())
                .map(|file| file.ends_with(content.relative_path.as_str()))
                .unwrap_or_default();

            let contains_payload = match combined_graph.source_info(*handle) {
                Some(source_info) => source_info.span.contains_point(&payload_range.start.into()),
                None => false,
            };

            (is_reference || is_definition)
                && contains_payload
                && present_in_target_file
                && !is_root
                && !is_jump_to
                && !is_scope
        })
        .ok_or_else(|| Error::user("provided range is not a valid token"))?;

    // repetitive code bunched under an uninspiring name
    // TODO: refactor
    let process = |handle: Handle<Node>, combined_graph: &StackGraph| {
        let file_handle = combined_graph[handle].file()?;
        let file = combined_graph[file_handle].name();
        info!("finding doc... ");
        let doc = all_docs.iter().find(|d| {
            info!("{}", &d.relative_path);
            info!("{}", &file);
            file.ends_with(d.relative_path.as_str())
        })?;
        info!("found doc");
        let src = &doc.content;

        let range = combined_graph.source_info(handle).map(|source_info| {
            let start = {
                let pt = source_info.span.start.as_point();
                Point::from_line_column(pt.row, pt.column, src)
            };
            let end = {
                let pt = source_info.span.end.as_point();
                Point::from_line_column(pt.row, pt.column, src)
            };
            TextRange::new(start, end)
        })?;
        tracing::info!("range of definiton: {:?}", range);
        let occurrence = to_occurrence(doc, range);
        Some((doc.relative_path.as_str(), occurrence))
    };

    // we are looking at a reference, produce definitions
    if combined_graph[handle].is_reference() {
        let mut definitions = BTreeSet::new();
        let mut references = BTreeSet::new();
        PartialPaths::new()
            .find_all_complete_paths(
                &combined_graph,
                std::iter::once(handle),
                &NoCancellation,
                |graph, paths, path| {
                    if path.is_complete(graph) && path.ends_at_definition(graph) {
                        info!("traversing path: {}", path.display(graph, paths));
                        definitions.insert(path.end_node);
                    }
                },
            )
            .expect("should never be cancelled");
        PartialPaths::new()
            .find_all_complete_paths(
                &combined_graph,
                combined_graph
                    .iter_nodes()
                    .filter(|n| combined_graph[*n].is_reference()),
                &NoCancellation,
                |graph, paths, path| {
                    if path.is_complete(graph) && definitions.contains(&path.end_node) {
                        info!("traversing path: {}", path.display(graph, paths));
                        references.insert(path.start_node);
                    }
                },
            )
            .expect("should never be cancelled");

        let file = content.relative_path.clone();
        let def_data = definitions
            .into_iter()
            .filter_map(|d| process(d, &combined_graph))
            .fold(HashMap::new(), |mut acc, (path, occurrence)| {
                acc.entry(path).or_insert_with(Vec::new).push(occurrence);
                acc
            });

        let ref_data = references
            .into_iter()
            .filter_map(|d| process(d, &combined_graph))
            .fold(HashMap::new(), |mut acc, (path, occurrence)| {
                acc.entry(path).or_insert_with(Vec::new).push(occurrence);
                acc
            });

        return Ok(json(TokenInfoResponse::Reference {
            definitions: def_data
                .into_iter()
                .map(|(key, data)| FileSymbols {
                    file: key.to_owned(),
                    data,
                })
                .collect::<Vec<_>>(),
            references: ref_data
                .into_iter()
                .map(|(key, data)| FileSymbols {
                    file: key.to_owned(),
                    data,
                })
                .collect::<Vec<_>>(),
        }));
    } else if combined_graph[handle].is_definition() {
        let mut references = BTreeSet::new();
        PartialPaths::new()
            .find_all_complete_paths(
                &combined_graph,
                combined_graph
                    .iter_nodes()
                    .filter(|n| combined_graph[*n].is_reference()),
                &NoCancellation,
                |graph, paths, path| {
                    if path.is_complete(graph) && path.end_node == handle {
                        info!("traversing path: {}", path.display(graph, paths));
                        references.insert(path.start_node);
                    }
                },
            )
            .expect("should never be cancelled");
        let ref_data = references
            .into_iter()
            .filter_map(|d| process(d, &combined_graph))
            .fold(HashMap::new(), |mut acc, (path, occurrence)| {
                acc.entry(path).or_insert_with(Vec::new).push(occurrence);
                acc
            });

        return Ok(json(TokenInfoResponse::Definition {
            references: ref_data
                .into_iter()
                .map(|(key, data)| FileSymbols {
                    file: key.to_owned(),
                    data,
                })
                .collect::<Vec<_>>(),
        }));
    } else {
        unreachable!("add back the check for (is_reference || is_definition), u muppet")
    }

    // let scope_graph = match content.symbol_locations {
    //     SymbolLocations::TreeSitter(ref graph) => graph,
    //     _ => return Err(Error::user("Intelligence is unavailable for this language")),
    // };

    // let node = scope_graph.node_by_range(payload.start, payload.end);

    // let idx = match node {
    //     None => return Err(Error::user("provided range is not a valid token")),
    //     Some(idx) => idx,
    // };

    // let src = &content.content;
    // let current_file = &content.relative_path;
    // let kind = scope_graph.symbol_name_of(idx);
    // let lang = content.lang.as_deref();
    // let all_docs = indexes.file. by_repo(repo_ref, lang).await;

    // match &scope_graph.graph[idx] {
    //     // we are already at a def
    //     // - find refs from the current file
    //     // - find refs from other files
    //     NodeKind::Def(d) => {
    //         // fetch local references with scope-graphs
    //         let local_references = handle_definition_local(scope_graph, idx, &content);

    //         // fetch repo-wide references with trivial search, only if the def is
    //         // a top-level def (typically functions, ADTs, consts)
    //         let repo_wide_references = if scope_graph.is_top_level(idx) {
    //             let token = d.name(src.as_bytes());
    //             handle_definition_repo_wide(token, kind, current_file, &all_docs)
    //         } else {
    //             vec![]
    //         };

    //         // merge the two
    //         let references = merge([local_references], repo_wide_references);

    //         Ok(json(TokenInfoResponse::Definition { references }))
    //     }

    //     // we are at a reference:
    //     // - find def from the current file
    //     // - find defs from other files
    //     // - find refs from the current file
    //     // - find refs from other files
    //     //
    //     // the ordering here prefers occurrences from the current file, over occurrences
    //     // from other files.
    //     NodeKind::Ref(r) => {
    //         // fetch local (defs, refs) with scope-graphs
    //         let (local_definitions, local_references) =
    //             handle_reference_local(scope_graph, idx, &content);

    //         // fetch repo-wide (defs, refs) with trivial search
    //         let token = r.name(src.as_bytes());
    //         let (repo_wide_definitions, repo_wide_references) =
    //             handle_reference_repo_wide(token, kind, current_file, &all_docs);

    //         // merge the two
    //         let definitions = merge([local_definitions], repo_wide_definitions);
    //         let references = merge([local_references], repo_wide_references);

    //         Ok(json(TokenInfoResponse::Reference {
    //             definitions,
    //             references,
    //         }))
    //     }
    //     _ => Err(Error::user(
    //         "provided range is not eligible for intelligence",
    //     )),
    // }
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
