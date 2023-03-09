use std::fmt;

use crate::{intelligence::ScopeGraph, text_range::TextRange};

use serde::{Deserialize, Serialize};
use stack_graphs::graph::StackGraph;
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct Symbol {
    pub kind: String,
    pub range: TextRange,
}

/// Collection of symbol locations for *single* file
#[derive(Default, Deserialize, Serialize)]
#[non_exhaustive]
pub enum SymbolLocations {
    /// ctags powered symbol-locations
    Ctags(Vec<Symbol>),

    /// tree-sitter powered symbol-locations (and more!)
    TreeSitter(ScopeGraph),

    #[serde(with = "stack_graph")]
    StackGraph(StackGraph),

    /// no symbol-locations for this file
    #[default]
    Empty,
}

impl SymbolLocations {
    pub fn list(&self) -> Vec<Symbol> {
        match self {
            Self::Ctags(symbols) => symbols.to_vec(),
            Self::TreeSitter(graph) => graph.symbols(),
            Self::Empty | Self::StackGraph(_) => Vec::new(),
        }
    }
}

impl fmt::Debug for SymbolLocations {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SymbolLocations {{ .. }}")
    }
}

mod stack_graph {

    use serde::{self, Deserialize, Deserializer, Serializer};
    use stack_graphs::graph::StackGraph;

    pub fn serialize<S>(graph: &StackGraph, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let s = graph.to_serializable();
        serializer.serialize_newtype_variant("SymbolLocations", 2, "StackGraph", &s)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<StackGraph, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = stack_graphs::serde::StackGraph::deserialize(deserializer)?;

        let mut graph = StackGraph::new();
        s.load_into(&mut graph).unwrap();
        Ok(graph)
    }
}
