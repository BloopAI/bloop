use crate::text_range::TextRange;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct LocalImport {
    pub range: TextRange,
}

impl LocalImport {
    /// Initialize a new import
    pub fn new(range: TextRange) -> Self {
        Self { range }
    }

    pub fn name<'a>(&self, buffer: &'a [u8]) -> &'a [u8] {
        &buffer[self.range.start.byte..self.range.end.byte]
    }
}
