use crate::{intelligence::namespace::SymbolId, text_range::TextRange};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct LocalDef {
    pub range: TextRange,
    pub symbol_id: Option<SymbolId>,
}

impl LocalDef {
    /// Initialize a new definition
    pub fn new(range: TextRange, symbol_id: Option<SymbolId>) -> Self {
        Self { range, symbol_id }
    }

    pub fn name<'a>(&self, buffer: &'a [u8]) -> &'a [u8] {
        &buffer[self.range.start.byte..self.range.end.byte]
    }
}
