use std::cmp::{Ord, Ordering};

use serde::{Deserialize, Serialize};

/// A singular position in a text document
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Point {
    /// The byte index
    pub byte: usize,

    /// 0-indexed line number
    pub line: usize,

    /// Position within the line
    pub column: usize,
}

impl PartialOrd for Point {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Point {
    fn cmp(&self, other: &Self) -> Ordering {
        self.byte.cmp(&other.byte)
    }
}

impl Point {
    pub fn new(byte: usize, line: usize, column: usize) -> Self {
        Self { byte, line, column }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TextRange {
    pub start: Point,
    pub end: Point,
}

impl PartialOrd for TextRange {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for TextRange {
    fn cmp(&self, other: &Self) -> Ordering {
        let compare_start_byte = self.start.byte.cmp(&other.start.byte);
        let compare_size = self.size().cmp(&other.size());

        compare_start_byte.then(compare_size)
    }
}

impl TextRange {
    pub fn new(start: Point, end: Point) -> Self {
        assert!(start <= end);
        Self { start, end }
    }

    pub fn contains(&self, other: TextRange) -> bool {
        // (self.start ... [other.start ... other.end] ... self.end)
        self.start <= other.start && other.end <= self.end
    }

    #[allow(unused)]
    pub fn contains_strict(&self, other: TextRange) -> bool {
        // (self.start ... (other.start ... other.end) ... self.end)
        self.start < other.start && other.end <= self.end
    }

    pub fn size(&self) -> usize {
        self.end.byte.saturating_sub(self.start.byte)
    }
}

impl From<tree_sitter::Range> for TextRange {
    fn from(r: tree_sitter::Range) -> Self {
        Self {
            start: Point {
                byte: r.start_byte,
                line: r.start_point.row,
                column: r.start_point.column,
            },
            end: Point {
                byte: r.end_byte,
                line: r.end_point.row,
                column: r.end_point.column,
            },
        }
    }
}

impl From<TextRange> for std::ops::Range<usize> {
    fn from(r: TextRange) -> std::ops::Range<usize> {
        r.start.byte..r.end.byte
    }
}
