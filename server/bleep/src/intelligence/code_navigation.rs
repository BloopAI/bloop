//! Handlers for code-navigation:
//! - scope-graph based handler that operates only in the owning file
//! - search based handler that operates on any file belonging to the repo

use std::{collections::HashSet, ops::Not};

use super::NodeKind;
use crate::{
    indexes::reader::ContentDocument,
    snippet::{Snipper, Snippet},
    text_range::TextRange,
};

use rayon::prelude::*;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct FileSymbols {
    /// The file to which the following occurrences belong
    pub file: String,

    /// A collection of symbol locations with context in this file
    pub data: Vec<Occurrence>,
}

#[derive(Serialize, Debug)]
pub struct Occurrence {
    pub kind: OccurrenceKind,
    pub range: TextRange,
    pub snippet: Snippet,
}

impl Occurrence {
    pub fn is_definition(&self) -> bool {
        matches!(self.kind, OccurrenceKind::Definition)
    }
}

#[derive(Serialize, Debug, Default)]
#[serde(rename_all = "snake_case")]
pub enum OccurrenceKind {
    #[default]
    Reference,
    Definition,
}

pub enum CodeNavigationError {}

pub struct CodeNavigationContext<'a, 'b> {
    pub token: Token<'a>,
    pub all_docs: &'b [ContentDocument],
    pub source_document_idx: usize,
}

impl<'a, 'b> CodeNavigationContext<'a, 'b> {
    /// Produces a list of docs that import items from source_document
    ///
    /// This works by going through every definition node in source_document, calculating
    /// repo-wide references for all such nodes, and gathering the resulting file-set.
    pub fn files_importing(
        all_docs: &'b [ContentDocument],
        source_document_idx: usize,
    ) -> HashSet<&'b ContentDocument> {
        // scope graph of the source document
        let source_doc = all_docs.get(source_document_idx).unwrap();
        let Some(source_sg) = source_doc.symbol_locations.scope_graph() else {
            return HashSet::default();
        };
        source_sg
            .graph
            .node_indices()
            .par_bridge()
            .filter(|idx| source_sg.is_definition(*idx) && source_sg.is_top_level(*idx))
            .flat_map_iter(|idx| {
                let range = source_sg.graph[idx].range();
                let token = Token {
                    relative_path: &source_doc.relative_path,
                    start_byte: range.start.byte,
                    end_byte: range.end.byte,
                };
                let active_token_range = token.start_byte..token.end_byte;
                let active_token_text =
                    source_doc.content.as_str().get(active_token_range).unwrap();
                all_docs
                    .par_iter()
                    .filter(|doc| doc.relative_path != source_doc.relative_path)
                    .filter(|doc| {
                        let Some(scope_graph) = doc.symbol_locations.scope_graph() else {
                            return false;
                        };
                        let content = doc.content.as_bytes();
                        scope_graph
                            .graph
                            .node_indices()
                            .par_bridge()
                            .filter(|&idx| scope_graph.is_top_level(idx))
                            .any(|idx| match scope_graph.get_node(idx).unwrap() {
                                NodeKind::Import(n) => {
                                    n.name(content) == active_token_text.as_bytes()
                                }
                                _ => false,
                            })
                    })
                    .collect::<Vec<_>>()
            })
            .collect()
    }

    /// Produces a list of docs that are imported in source_document
    ///
    /// This works by going through every reference or import node in the current file, calculating
    /// its non-local definition (if any) and gathering the resuting file-set.
    pub fn files_imported(
        all_docs: &'b [ContentDocument],
        source_document_idx: usize,
    ) -> HashSet<&'b ContentDocument> {
        // scope graph of the source document
        let source_doc = all_docs.get(source_document_idx).unwrap();
        let Some(source_sg) = source_doc.symbol_locations.scope_graph() else {
            return HashSet::default();
        };

        source_sg
            .graph
            .node_indices()
            .par_bridge()
            .filter(|idx| source_sg.is_reference(*idx) || source_sg.is_import(*idx))
            .filter(|&idx| {
                CodeNavigationContext {
                    all_docs,
                    source_document_idx,
                    token: Token {
                        relative_path: &source_doc.relative_path,
                        start_byte: source_sg.graph[idx].range().start.byte,
                        end_byte: source_sg.graph[idx].range().end.byte,
                    },
                }
                .local_definitions()
                .is_none()
            })
            .flat_map_iter(|idx| {
                let range = source_sg.graph[idx].range();
                let token = Token {
                    relative_path: &source_doc.relative_path,
                    start_byte: range.start.byte,
                    end_byte: range.end.byte,
                };
                let active_token_range = token.start_byte..token.end_byte;
                let active_token_text =
                    source_doc.content.as_str().get(active_token_range).unwrap();
                all_docs
                    .par_iter()
                    .filter(|doc| doc.relative_path != source_doc.relative_path)
                    .filter(|doc| {
                        let Some(scope_graph) = doc.symbol_locations.scope_graph() else {
                            return false;
                        };
                        let content = doc.content.as_bytes();
                        scope_graph
                            .graph
                            .node_indices()
                            .par_bridge()
                            .filter(|idx| scope_graph.is_top_level(*idx))
                            .any(|idx| {
                                if let Some(NodeKind::Def(d)) = scope_graph.get_node(idx) {
                                    d.name(content) == active_token_text.as_bytes()
                                } else {
                                    false
                                }
                            })
                    })
                    .collect::<Vec<_>>()
            })
            .collect::<HashSet<_>>()
    }

    fn singleton(source_document: &'b ContentDocument, token: Token<'a>) -> Self {
        Self {
            all_docs: std::slice::from_ref(source_document),
            source_document_idx: 0,
            token,
        }
    }

    fn source_document(&self) -> &ContentDocument {
        self.all_docs.get(self.source_document_idx).unwrap()
    }

    pub fn token_info(&self) -> Vec<FileSymbols> {
        if self.is_definition() {
            let local_references = self.local_references();
            let repo_wide_references = self
                .is_top_level()
                .then(|| self.repo_wide_references())
                .unwrap_or_default();

            local_references
                .into_iter()
                .chain(repo_wide_references)
                .collect()
        } else if self.is_reference() {
            let local_definitions = self.local_definitions();
            let repo_wide_definitions = local_definitions
                .is_none()
                .then(|| self.repo_wide_definitions())
                .unwrap_or_default();

            let local_references = self.local_references();
            let repo_wide_references = local_definitions
                .is_none()
                .then(|| self.repo_wide_references())
                .unwrap_or_default();

            let imports = self.imports();

            local_definitions
                .or(imports)
                .into_iter()
                .chain(repo_wide_definitions)
                .chain(local_references.into_iter())
                .chain(repo_wide_references)
                .collect()
        } else if self.is_import() {
            let local_references = self.local_references();
            let repo_wide_definitions = self.repo_wide_definitions();

            repo_wide_definitions
                .into_iter()
                .chain(local_references)
                .collect()
        } else {
            Vec::new()
        }
    }

    fn is_definition(&self) -> bool {
        self.source_document()
            .symbol_locations
            .scope_graph()
            .and_then(|sg| {
                let idx = sg.node_by_range(self.token.start_byte, self.token.end_byte)?;
                Some(matches!(sg.get_node(idx).unwrap(), NodeKind::Def(_)))
            })
            .unwrap_or_default()
    }

    fn is_reference(&self) -> bool {
        self.source_document()
            .symbol_locations
            .scope_graph()
            .and_then(|sg| {
                let idx = sg.node_by_range(self.token.start_byte, self.token.end_byte)?;
                Some(matches!(sg.get_node(idx).unwrap(), NodeKind::Ref(_)))
            })
            .unwrap_or_default()
    }

    fn is_import(&self) -> bool {
        self.source_document()
            .symbol_locations
            .scope_graph()
            .and_then(|sg| {
                let idx = sg.node_by_range(self.token.start_byte, self.token.end_byte)?;
                Some(matches!(sg.get_node(idx).unwrap(), NodeKind::Import(_)))
            })
            .unwrap_or_default()
    }

    fn is_top_level(&self) -> bool {
        self.source_document()
            .symbol_locations
            .scope_graph()
            .and_then(|sg| {
                let idx = sg.node_by_range(self.token.start_byte, self.token.end_byte)?;
                Some(sg.is_top_level(idx))
            })
            .unwrap_or_default()
    }

    fn non_source_documents(&self) -> impl Iterator<Item = &ContentDocument> {
        self.all_docs
            .iter()
            .filter(|doc| doc.relative_path != self.source_document().relative_path)
    }

    pub fn active_token_range(&self) -> std::ops::Range<usize> {
        self.token.start_byte..self.token.end_byte
    }

    pub fn active_token_text(&self) -> &str {
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
            .map(|idx| Occurrence {
                kind: OccurrenceKind::Definition,
                range: scope_graph.graph[idx].range(),
                snippet: to_occurrence(self.source_document(), scope_graph.graph[idx].range()),
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
            .par_bridge()
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
            .chain(scope_graph.references(node_idx))
            .map(|idx| Occurrence {
                kind: OccurrenceKind::Reference,
                range: scope_graph.graph[idx].range(),
                snippet: to_occurrence(self.source_document(), scope_graph.graph[idx].range()),
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
            .par_bridge()
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

    fn imports(&self) -> Option<FileSymbols> {
        let scope_graph = self.source_document().symbol_locations.scope_graph()?;
        let node_idx = scope_graph.node_by_range(self.token.start_byte, self.token.end_byte)?;
        let mut data = scope_graph
            .imports(node_idx)
            .map(|idx| Occurrence {
                kind: OccurrenceKind::Definition,
                range: scope_graph.graph[idx].range(),
                snippet: to_occurrence(self.source_document(), scope_graph.graph[idx].range()),
            })
            .collect::<Vec<_>>();

        data.sort_by_key(|occurrence| occurrence.range.start.byte);

        data.is_empty().not().then(|| FileSymbols {
            file: self.token.relative_path.to_owned(),
            data,
        })
    }
}

pub struct Token<'a> {
    pub relative_path: &'a str,
    pub start_byte: usize,
    pub end_byte: usize,
}

fn to_occurrence(doc: &ContentDocument, range: TextRange) -> Snippet {
    let src = &doc.content;
    let line_end_indices = &doc.line_end_indices;
    let highlight = range.start.byte..range.end.byte;
    Snipper::default()
        .expand(highlight, src, line_end_indices)
        .reify(src, &[])
}

// ranges of defs in related_file_document used in source_document
pub fn imported_ranges(
    source_document: &ContentDocument,
    related_file_document: &ContentDocument,
) -> HashSet<TextRange> {
    // scope graph of the source document
    let Some(source_sg) = source_document.symbol_locations.scope_graph() else {
        return HashSet::new();
    };

    // scope graph of the related_file document
    let Some(related_file_sg) = related_file_document.symbol_locations.scope_graph() else {
        return HashSet::new();
    };
    let related_file_content = &related_file_document.content;

    source_sg
        .graph
        .node_indices()
        .par_bridge()
        .filter(|idx| source_sg.is_reference(*idx) || source_sg.is_import(*idx))
        .filter(|&idx| {
            let token = Token {
                relative_path: &source_document.relative_path,
                start_byte: source_sg.graph[idx].range().start.byte,
                end_byte: source_sg.graph[idx].range().end.byte,
            };
            (CodeNavigationContext::singleton(source_document, token))
                .local_definitions()
                .is_none()
        })
        .flat_map(|idx| {
            let range = source_sg.graph[idx].range();
            let token = Token {
                relative_path: &source_document.relative_path,
                start_byte: range.start.byte,
                end_byte: range.end.byte,
            };
            let active_token_range = token.start_byte..token.end_byte;
            let active_token_text = source_document
                .content
                .as_str()
                .get(active_token_range)
                .unwrap();

            related_file_sg
                .graph
                .node_indices()
                .par_bridge()
                .filter(|idx| related_file_sg.is_top_level(*idx))
                .filter(|idx| {
                    if let Some(NodeKind::Def(d)) = related_file_sg.get_node(*idx) {
                        d.name(related_file_content.as_bytes()) == active_token_text.as_bytes()
                    } else {
                        false
                    }
                })
                .filter_map(|idx| related_file_sg.value_of_definition(idx))
                .map(|idx| related_file_sg.graph[idx].range())
        })
        .collect()
}
