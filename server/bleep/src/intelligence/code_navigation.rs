//! Handlers for code-navigation:
//! - scope-graph based handler that operates only in the owning file
//! - search based handler that operates on any file belonging to the repo

use std::{collections::BTreeSet, ops::Not, sync::Arc};

use super::{NodeKind, ScopeGraph};
use crate::{
    indexes::{reader::ContentDocument, Indexes},
    repo::RepoRef,
    snippet::{Snipper, Snippet},
    text_range::TextRange,
};

use petgraph::graph::NodeIndex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub(super) struct FileSymbols {
    /// The file to which the following occurrences belong
    file: String,

    /// A collection of symbol locations with context in this file
    data: Vec<Occurrence>,
}

impl FileSymbols {
    fn is_populated(&self) -> bool {
        !self.data.is_empty()
    }
}

#[derive(Serialize, Debug)]
pub struct Occurrence {
    kind: OccurrenceKind,
    range: TextRange,
    snippet: Snippet,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum OccurrenceKind {
    Reference,
    Definition,
}

pub enum CodeNavigationError {}

pub struct CodeNavigationContext<'a> {
    repo_ref: RepoRef,
    token: Token<'a>,
    indexes: Arc<Indexes>,
    all_docs: Vec<ContentDocument>,
    source_document_idx: usize,
}

impl<'a> CodeNavigationContext<'a> {
    fn source_document(&self) -> ContentDocument {
        self.all_docs[self.source_document_idx]
    }

    fn non_source_documents(&self) -> impl Iterator<Item = &ContentDocument> {
        self.all_docs
            .iter()
            .filter(|doc| doc.relative_path != self.source_document().relative_path)
    }

    fn active_token_range(&self) -> std::ops::Range<usize> {
        self.token.start_byte..self.token.end_byte
    }

    fn active_token_text(&self) -> &str {
        self.source_document()
            .content
            .as_str()
            .get(self.active_token_range())
            .unwrap()
    }

    fn local_definitions(&self) -> Option<FileSymbols> {
        let scope_graph = self.source_document().symbol_locations.scope_graph()?;
        let node_idx = scope_graph.node_by_range(self.token.start_byte, self.token.end_byte)?;
        let mut data = scope_graph
            .definitions(node_idx)
            .chain(scope_graph.imports(node_idx))
            .map(|idx| Occurrence {
                kind: OccurrenceKind::Definition,
                range: scope_graph.graph[idx].range(),
                snippet: to_occurrence(&self.source_document(), scope_graph.graph[idx].range()),
            })
            .collect::<Vec<_>>();

        data.sort_by_key(|occurrence| occurrence.range.start.byte);

        data.is_empty().not().then(|| FileSymbols {
            file: self.token.relative_path.to_owned(),
            data,
        })
    }

    fn repo_wide_definitions(&self) -> Vec<FileSymbols> {
        self.non_source_documents()
            .filter_map(|doc| {
                let scope_graph = doc.symbol_locations.scope_graph()?;
                let content = doc.content.as_bytes();
                let mut data = scope_graph
                    .graph
                    .node_indices()
                    .filter(|idx| scope_graph.is_top_level(*idx))
                    .filter(|idx| {
                        if let Some(NodeKind::Def(d)) = scope_graph.get_node(*idx) {
                            d.name(content) == self.active_token_text().as_bytes()
                        } else {
                            false
                        }
                    })
                    .map(|idx| Occurrence {
                        kind: OccurrenceKind::Definition,
                        range: scope_graph.graph[idx].range(),
                        snippet: to_occurrence(doc, scope_graph.graph[idx].range()),
                    })
                    .collect::<Vec<_>>();

                data.sort_by_key(|occurrence| occurrence.range.start.byte);

                data.is_empty().not().then(|| FileSymbols {
                    file: doc.relative_path.to_owned(),
                    data,
                })
            })
            .collect()
    }

    fn local_references(&self) -> Option<FileSymbols> {
        let scope_graph = self.source_document().symbol_locations.scope_graph()?;
        let node_idx = scope_graph.node_by_range(self.token.start_byte, self.token.end_byte)?;
        let mut data = scope_graph
            .definitions(node_idx)
            .chain(scope_graph.imports(node_idx))
            .flat_map(|idx| scope_graph.references(idx))
            .map(|idx| Occurrence {
                kind: OccurrenceKind::Reference,
                range: scope_graph.graph[idx].range(),
                snippet: to_occurrence(&self.source_document(), scope_graph.graph[idx].range()),
            })
            .collect::<Vec<_>>();

        data.retain(|occurrence| {
            occurrence.range != scope_graph.get_node(node_idx).unwrap().range()
        });
        data.sort_by_key(|occurrence| occurrence.range.start.byte);

        data.is_empty().not().then(|| FileSymbols {
            file: self.token.relative_path.to_owned(),
            data,
        })
    }

    fn repo_wide_references(&self) -> Vec<FileSymbols> {
        self.non_source_documents()
            .filter_map(|doc| {
                let scope_graph = doc.symbol_locations.scope_graph()?;
                let content = doc.content.as_bytes();
                let mut data = scope_graph
                    .graph
                    .node_indices()
                    .filter(|idx| scope_graph.is_top_level(*idx))
                    .filter(|idx| match scope_graph.get_node(*idx).unwrap() {
                        NodeKind::Def(n) => n.name(content) == self.active_token_text().as_bytes(),
                        NodeKind::Import(n) => {
                            n.name(content) == self.active_token_text().as_bytes()
                        }
                        _ => false,
                    })
                    .flat_map(|idx| scope_graph.references(idx))
                    .map(|idx| Occurrence {
                        kind: OccurrenceKind::Reference,
                        range: scope_graph.graph[idx].range(),
                        snippet: to_occurrence(doc, scope_graph.graph[idx].range()),
                    })
                    .collect::<Vec<_>>();

                data.sort_by_key(|occurrence| occurrence.range.start.byte);

                data.is_empty().not().then(|| FileSymbols {
                    file: doc.relative_path.to_owned(),
                    data,
                })
            })
            .collect()
    }
}

pub struct Token<'a> {
    relative_path: &'a str,
    start_byte: usize,
    end_byte: usize,
}

fn to_occurrence(doc: &ContentDocument, range: TextRange) -> Snippet {
    let src = &doc.content;
    let line_end_indices = &doc.line_end_indices;
    let highlight = range.start.byte..range.end.byte;
    Snipper::default()
        .expand(highlight, src, line_end_indices)
        .reify(src, &[])
}

// /// scope-graph based code-nav handler
// pub struct CurrentFileHandler<'a> {
//     pub scope_graph: &'a ScopeGraph,
//     pub idx: NodeIndex<u32>,
//     pub doc: &'a ContentDocument,
// }
//
// impl<'a> CurrentFileHandler<'a> {
//     // produce a list of references
//     pub fn handle_definition(&self) -> Vec<TextRange> {
//         let Self {
//             scope_graph, idx, ..
//         } = self;
//         scope_graph
//             .references(*idx)
//             .map(|i| scope_graph.graph[i].range())
//             .collect::<BTreeSet<_>>()
//             .into_iter()
//             .collect::<Vec<_>>()
//     }
//
//     // produce a list of definitions and references
//     pub fn handle_reference(&self) -> (Vec<TextRange>, Vec<TextRange>) {
//         let Self {
//             scope_graph, idx, ..
//         } = self;
//         let (defs, refs): (Vec<_>, Vec<_>) = scope_graph
//             .definitions(*idx) // for every possible def...
//             .chain(scope_graph.imports(*idx))
//             .map(|node_idx| {
//                 // get its corresponding (node, refs)
//                 (
//                     &scope_graph.graph[node_idx],
//                     scope_graph
//                         .references(node_idx)
//                         .map(|i| scope_graph.graph[i].range())
//                         .collect::<Vec<_>>(),
//                 )
//             })
//             .unzip();
//
//         let defs = defs
//             .into_iter()
//             .filter(|d| matches!(d, NodeKind::Def(_)))
//             .map(|d| d.range())
//             .collect();
//
//         // remove self from the list of references
//         let mut refs = refs.into_iter().flatten().collect::<BTreeSet<_>>();
//         refs.remove(&self.scope_graph.graph[*idx].range());
//         let refs = refs.into_iter().collect::<Vec<_>>();
//
//         (defs, refs)
//     }
// }
//
// pub struct RepoWideHandler<'a> {
//     // the name we are looking for
//     pub token: &'a [u8],
//     // the symbol kind of the currently hovered symbol
//     pub kind: Option<&'a str>,
//     // scope-graph of the target file
//     pub scope_graph: &'a ScopeGraph,
//     // the target file
//     pub doc: &'a ContentDocument,
// }
//
// impl<'a> RepoWideHandler<'a> {
//     // we are at a def, produce refs from the target file
//     pub fn handle_definition(&self) -> Vec<TextRange> {
//         let src = &self.doc.content;
//         let sg = self.scope_graph;
//
//         sg.graph
//             .node_indices()
//             .filter_map(|node_idx| match &sg.graph[node_idx] {
//                 NodeKind::Ref(r) if r.name(src.as_bytes()) == self.token => Some(r.range),
//                 _ => None,
//             })
//             .collect()
//     }
//
//     // we are at a ref, produce (defs, refs) from the target file
//     pub fn handle_reference(&self) -> (Vec<TextRange>, Vec<TextRange>) {
//         let graph = &self.scope_graph.graph;
//         let src = &self.doc.content;
//         let (def_data, ref_data): (Vec<_>, Vec<_>) = graph
//             .node_indices()
//             .filter(|&node_idx| self.scope_graph.is_top_level(node_idx))
//             .filter(|node_idx| match &graph[*node_idx] {
//                 NodeKind::Def(d) => d.name(src.as_bytes()) == self.token,
//                 NodeKind::Import(i) => i.name(src.as_bytes()) == self.token,
//                 _ => false,
//             })
//             .map(|node_idx| (&graph[node_idx], self.scope_graph.references(node_idx)))
//             .unzip();
//
//         let ref_data = ref_data
//             .into_iter()
//             .flatten()
//             .map(|node_idx| graph[node_idx].range())
//             .collect();
//
//         let def_data = def_data
//             .into_iter()
//             .filter(|node| matches!(node, NodeKind::Def(_)))
//             .map(|node| node.range())
//             .collect();
//
//         (def_data, ref_data)
//     }
// }
