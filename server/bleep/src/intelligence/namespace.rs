use serde::{Deserialize, Serialize};

/// An opaque identifier for every symbol in a language
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct SymbolId {
    pub namespace_idx: usize,
    pub symbol_idx: usize,
}

impl SymbolId {
    pub fn name(&self, namespaces: NameSpaces) -> &'static str {
        namespaces[self.namespace_idx][self.symbol_idx]
    }
}

/// A grouping of symbol kinds that allow references among them.
/// A variable can refer only to other variables, and not types, for example.
pub type NameSpace = &'static [&'static str];

/// A collection of namespaces
pub type NameSpaces = &'static [NameSpace];

/// Helper trait
pub trait NameSpaceMethods {
    fn all_symbols(self) -> Vec<&'static str>;

    fn symbol_id_of(&self, symbol: &str) -> Option<SymbolId>;
}

impl NameSpaceMethods for NameSpaces {
    fn all_symbols(self) -> Vec<&'static str> {
        self.iter().flat_map(|ns| ns.iter().cloned()).collect()
    }

    fn symbol_id_of(&self, symbol: &str) -> Option<SymbolId> {
        self.iter()
            .enumerate()
            .find_map(|(namespace_idx, namespace)| {
                namespace
                    .iter()
                    .position(|s| s == &symbol)
                    .map(|symbol_idx| SymbolId {
                        namespace_idx,
                        symbol_idx,
                    })
            })
    }
}
