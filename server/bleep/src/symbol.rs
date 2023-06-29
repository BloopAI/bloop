use crate::{intelligence::ScopeGraph, text_range::TextRange};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Symbol {
    pub kind: String,
    pub range: TextRange,
}

/// Collection of symbol locations for *single* file
#[derive(Default, Debug, Clone, Deserialize, Serialize)]
#[non_exhaustive]
pub enum SymbolLocations {
    /// tree-sitter powered symbol-locations (and more!)
    TreeSitter(ScopeGraph),

    /// no symbol-locations for this file
    #[default]
    Empty,
}

impl SymbolLocations {
    pub fn list(&self) -> Vec<Symbol> {
        match self {
            Self::TreeSitter(graph) => graph.symbols(),
            Self::Empty => Vec::new(),
        }
    }

    pub fn scope_graph(&self) -> Option<&ScopeGraph> {
        match self {
            Self::TreeSitter(graph) => Some(graph),
            Self::Empty => None,
        }
    }
}
