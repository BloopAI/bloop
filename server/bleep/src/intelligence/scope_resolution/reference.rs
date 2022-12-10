use crate::{intelligence::namespace::SymbolId, text_range::TextRange};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reference {
    pub range: TextRange,
    pub symbol_id: Option<SymbolId>,
}

impl Reference {
    /// Initialize a new reference
    pub fn new(range: TextRange, symbol_id: Option<SymbolId>) -> Self {
        Self { range, symbol_id }
    }

    pub fn name<'a>(&self, buffer: &'a [u8]) -> &'a [u8] {
        &buffer[self.range.start.byte..self.range.end.byte]
    }
}
