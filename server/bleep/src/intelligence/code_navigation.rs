//! Handlers for code-navigation:
//! - scope-graph based handler that operates only in the owning file
//! - search based handler that operates on any file belonging to the repo

use std::collections::BTreeSet;

use super::{NodeKind, ScopeGraph};
use crate::{indexes::reader::ContentDocument, text_range::TextRange};
use petgraph::graph::NodeIndex;

/// scope-graph based code-nav handler
pub struct CurrentFileHandler<'a> {
    pub scope_graph: &'a ScopeGraph,
    pub idx: NodeIndex<u32>,
    pub doc: &'a ContentDocument,
}

impl<'a> CurrentFileHandler<'a> {
    // produce a list of references
    pub fn handle_definition(&self) -> Vec<TextRange> {
        let Self {
            scope_graph, idx, ..
        } = self;
        scope_graph
            .references(*idx)
            .map(|i| scope_graph.graph[i].range())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>()
    }

    // produce a list of definitions and references
    pub fn handle_reference(&self) -> (Vec<TextRange>, Vec<TextRange>) {
        let Self {
            scope_graph, idx, ..
        } = self;
        let (defs, mut refs) = scope_graph
            .definitions(*idx) // for every possible def...
            .map(|def| {
                // get its corresponding (range, refs)
                (
                    scope_graph.graph[def].range(),
                    scope_graph
                        .references(def)
                        .map(|i| scope_graph.graph[i].range()),
                )
            })
            .fold(
                // collect all of that into (all definitions, all references)
                //
                // we collect into a BTreeSet just to be absolutely sure that
                // there are no dupes.
                (BTreeSet::new(), BTreeSet::new()),
                |(mut defs, mut refs), (d, rs)| {
                    defs.insert(d);
                    for r in rs {
                        refs.insert(r);
                    }
                    (defs, refs)
                },
            );

        // remove the currently hovered ref from the list
        refs.remove(&self.scope_graph.graph[self.idx].range());

        let defs = defs.into_iter().collect::<Vec<_>>();
        let refs = refs.into_iter().collect::<Vec<_>>();
        (defs, refs)
    }
}

pub struct RepoWideHandler<'a> {
    // the name we are looking for
    pub token: &'a [u8],
    // the symbol kind of the currently hovered symbol
    pub kind: Option<&'a str>,
    // scope-graph of the target file
    pub scope_graph: &'a ScopeGraph,
    // the target file
    pub doc: &'a ContentDocument,
}

impl<'a> RepoWideHandler<'a> {
    // we are at a def, produce refs from the target file
    pub fn handle_definition(&self) -> Vec<TextRange> {
        // fetch repo-wide references as long as we aren't looking at a variable,
        // variables tend to live locally.
        let src = &self.doc.content;
        let sg = self.scope_graph;
        if !matches!(self.kind, Some("var" | "variable")) {
            sg.graph
                .node_indices()
                .filter(|node_idx| {
                    !sg.definitions(*node_idx)
                        .any(|i| matches!(sg.symbol_name_of(i), Some("var" | "variable")))
                })
                .filter_map(|node_idx| match &sg.graph[node_idx] {
                    NodeKind::Ref(r) if r.name(src.as_bytes()) == self.token => Some(r.range),
                    _ => None,
                })
                .collect()
        } else {
            // repo-wide references for variables does not make much sense,
            // as they usually live locally.
            vec![]
        }
    }

    // we are at a ref, produce defs from the target file
    pub fn handle_reference(&self) -> Vec<TextRange> {
        let graph = &self.scope_graph.graph;
        let src = &self.doc.content;
        graph
            .node_indices()
            .filter(|&node_idx| {
                // permit cross-file GTD only for functions & ADTs.
                // generally speaking, variables live locally.
                //
                // TODO: look at this again if and when we normalize
                //       symbol kinds.
                !matches!(
                    self.scope_graph.symbol_name_of(node_idx),
                    Some("var" | "variable")
                )
            })
            .filter_map(|node_idx| match &graph[node_idx] {
                NodeKind::Def(d) if d.name(src.as_bytes()) == self.token => Some(d.range),
                _ => None,
            })
            .collect()
    }
}
