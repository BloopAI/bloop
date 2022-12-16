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
        let src = &self.doc.content;
        let sg = self.scope_graph;

        sg.graph
            .node_indices()
            .filter_map(|node_idx| match &sg.graph[node_idx] {
                NodeKind::Ref(r) if r.name(src.as_bytes()) == self.token => Some(r.range),
                _ => None,
            })
            .collect()
    }

    // we are at a ref, produce (defs, refs) from the target file
    pub fn handle_reference(&self) -> (Vec<TextRange>, Vec<TextRange>) {
        let graph = &self.scope_graph.graph;
        let src = &self.doc.content;
        let (def_data, ref_data): (Vec<_>, Vec<_>) = graph
            .node_indices()
            .filter(|&node_idx| self.scope_graph.is_top_level(node_idx))
            .filter(|node_idx| matches!(&graph[*node_idx], NodeKind::Def(d) if d.name(src.as_bytes()) == self.token))
            .map(|node_idx| (graph[node_idx].range(), self.scope_graph.references(node_idx)))
            .unzip();
        let ref_data = ref_data
            .into_iter()
            .flatten()
            .map(|node_idx| graph[node_idx].range())
            .collect();
        (def_data, ref_data)
    }
}
