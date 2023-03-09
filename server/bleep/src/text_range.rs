use std::cmp::{Ord, Ordering};
use utoipa::ToSchema;

use serde::{Deserialize, Serialize};

/// A singular position in a text document
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
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

    // Panics if `byte` is out of bounds of `src`.
    pub fn from_byte(byte: usize, src: &str) -> Self {
        // the line is the number of \n we have seen in the source so far
        let line = src[..byte].chars().filter(|c| *c == '\n').count();
        // the number of characters between the last newline and byte
        let column = src[..byte]
            .rmatch_indices('\n')
            .next()
            .map(|(last_newline, _)| byte.saturating_sub(last_newline))
            .unwrap_or(0);
        Self { byte, line, column }
    }

    pub fn from_line_column(line: usize, column: usize, src: &str) -> Self {
        let byte = src
            .match_indices('\n')
            .skip(line)
            .map(|(idx, _)| idx)
            .next()
            .unwrap()
            .saturating_add(column);
        Self { byte, line, column }
    }
}

impl From<Point> for tree_sitter::Point {
    fn from(value: Point) -> Self {
        Self {
            row: value.line,
            column: value.column,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
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

    pub fn from_byte_range(range: std::ops::Range<usize>, src: &str) -> Self {
        let start = Point::from_byte(range.start, src);
        let end = Point::from_byte(range.end, src);
        Self { start, end }
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
