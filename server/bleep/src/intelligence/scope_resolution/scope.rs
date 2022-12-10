use super::{EdgeKind, ScopeGraph};
use crate::text_range::TextRange;

use petgraph::{graph::NodeIndex, visit::EdgeRef, Direction};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct LocalScope {
    pub range: TextRange,
}

impl LocalScope {
    pub fn new(range: TextRange) -> Self {
        Self { range }
    }
}

pub struct ScopeStack<'a> {
    pub scope_graph: &'a ScopeGraph,
    pub start: Option<NodeIndex<u32>>,
}

impl<'a> Iterator for ScopeStack<'a> {
    type Item = NodeIndex<u32>;
    fn next(&mut self) -> Option<Self::Item> {
        if let Some(start) = self.start {
            let parent = self
                .scope_graph
                .graph
                .edges_directed(start, Direction::Outgoing)
                .find(|edge| *edge.weight() == EdgeKind::ScopeToScope)
                .map(|edge| edge.target());
            let original = start;
            self.start = parent;
            Some(original)
        } else {
            None
        }
    }
}
