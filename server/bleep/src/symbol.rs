use crate::{intelligence::ScopeGraph, text_range::TextRange};

use serde::{Deserialize, Serialize};
use stack_graphs::serde::{Database, StackGraph};

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

    StackGraph(StackGraph, Database),

    /// no symbol-locations for this file
    #[default]
    Empty,
}

impl SymbolLocations {
    pub fn list(&self) -> Vec<Symbol> {
        match self {
            Self::TreeSitter(graph) => graph.symbols(),
            Self::StackGraph(..) => Vec::new(),
            Self::Empty => Vec::new(),
        }
    }

    pub fn scope_graph(&self) -> Option<&ScopeGraph> {
        match self {
            Self::TreeSitter(graph) => Some(graph),
            Self::StackGraph(..) => None,
            Self::Empty => None,
        }
    }

    pub fn stack_graph(&self) -> Option<(&StackGraph, &Database)> {
        match self {
            Self::TreeSitter(_) => None,
            Self::StackGraph(graph, database) => Some((graph, database)),
            Self::Empty => None,
        }
    }
}
