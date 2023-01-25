use std::{
    fmt::{Display, Write},
    ops::Range,
};

use crate::text_range::{Point, TextRange};

use clap::{builder::PossibleValue, ValueEnum};
use serde::{Deserialize, Serialize};
use tokenizers::Tokenizer;
use tracing::{debug, error, warn};

#[derive(Debug)]
pub enum ChunkError {
    UnsupportedLanguage(String),
    Query(tree_sitter::QueryError),
}

#[derive(Debug)]
pub struct Chunk<'a> {
    pub data: &'a str,
    pub range: TextRange,
}

impl<'a> Chunk<'a> {
    pub fn new(data: &'a str, start: Point, end: Point) -> Self {
        Self {
            data,
            range: TextRange { start, end },
        }
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.len() < 1
    }
}

// This calculates the line and column for a given byte position. The last_line and last_byte
// parameters can be used to reduce the amount of searching for the line position from quadratic
// to linear. If in doubt, just use `1` for last_line and `0` for last_byte.
fn point(src: &str, byte: usize, last_line: usize, last_byte: usize) -> Point {
    assert!(
        byte >= last_byte,
        "byte={byte} < last_byte={last_byte}, last_line={last_line}"
    );
    let line = src.as_bytes()[last_byte..byte]
        .iter()
        .filter(|&&b| b == b'\n')
        .count()
        + last_line;
    let column = if let Some(last_nl) = src[..byte].rfind('\n') {
        byte - last_nl
    } else {
        byte
    };
    Point { byte, column, line }
}

/// The strategy for overlapping chunks
#[derive(Copy, Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(try_from = "&str", into = "String")]
pub enum OverlapStrategy {
    /// go back _ lines from the end
    ByLines(usize),
    /// A value > 0 and < 1 that indicates the target overlap in tokens.
    Partial(f64),
}

impl Display for OverlapStrategy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ByLines(n) => n.fmt(f),
            Self::Partial(p) => {
                (*p / 100.0).fmt(f)?;
                f.write_char('%')
            }
        }
    }
}

impl From<OverlapStrategy> for String {
    fn from(val: OverlapStrategy) -> Self {
        val.to_string()
    }
}

static OVERLAP_STRATEGY_VARIANTS: &[OverlapStrategy] =
    &[OverlapStrategy::ByLines(1), OverlapStrategy::Partial(0.5)];

impl ValueEnum for OverlapStrategy {
    fn value_variants<'a>() -> &'a [Self] {
        OVERLAP_STRATEGY_VARIANTS
    }

    fn to_possible_value(&self) -> Option<PossibleValue> {
        if self == &OVERLAP_STRATEGY_VARIANTS[0] {
            Some(PossibleValue::new("1"))
        } else if self == &OVERLAP_STRATEGY_VARIANTS[1] {
            Some(PossibleValue::new("50%"))
        } else {
            None
        }
    }

    fn from_str(input: &str, _ignore_case: bool) -> Result<Self, String> {
        Self::try_from(input)
            .map_err(|_| String::from("overlap should be a number of lines or a percentage"))
    }
}

impl TryFrom<&'_ str> for OverlapStrategy {
    type Error = &'static str;

    fn try_from(input: &str) -> Result<Self, &'static str> {
        Ok(if let Some(percentage) = input.strip_suffix('%') {
            Self::Partial(
                str::parse::<f64>(percentage).map_err(|_| "failure parsing overlap strategy")?
                    * 0.01,
            )
        } else {
            Self::ByLines(str::parse(input).map_err(|_| "failure parsing overlap strategy")?)
        })
    }
}

impl OverlapStrategy {
    // returns the next startpoint for overlong lines
    fn next_subdivision(&self, max_tokens: usize) -> usize {
        (match self {
            OverlapStrategy::ByLines(n) => max_tokens - n,
            OverlapStrategy::Partial(part) => ((max_tokens as f64) * part) as usize,
        })
        .max(1) // ensure we make forward progress
    }
}

/// This should take care of [CLS], [SEP] etc. which could be introduced during per-chunk tokenization
pub const DEDUCT_SPECIAL_TOKENS: usize = 2;

fn add_token_range<'s>(
    chunks: &mut Vec<Chunk<'s>>,
    src: &'s str,
    offsets: &[(usize, usize)],
    o: Range<usize>,
    last_line: &mut usize,
    last_byte: &mut usize,
    go_back_to_line_start: bool,
) {
    let start_byte = offsets[o.start].0;
    let line_start_byte = if go_back_to_line_start {
        src[..start_byte]
            .char_indices()
            .rev()
            .find_map(|(i, c)| (c == '\n').then_some(i + 1))
            .unwrap_or(0)
    } else {
        start_byte
    };
    let end_byte = offsets.get(o.end).map_or(src.len(), |&(s, _)| s);
    let Some(trimmed_end_byte) = src[..end_byte]
        .char_indices()
        .rev()
        .find_map(|(i, c)| (!c.is_whitespace()).then_some(i)) else { return };
    if trimmed_end_byte <= start_byte {
        return;
    }
    debug_assert!(
        o.end - o.start < 256,
        "chunk too large: {} tokens in {:?} bytes {:?}",
        o.end - o.start,
        o,
        line_start_byte..trimmed_end_byte
    );
    let start = point(src, line_start_byte, *last_line, *last_byte);
    let end = point(src, trimmed_end_byte, *last_line, *last_byte);
    (*last_line, *last_byte) = (start.line, start.byte);
    chunks.push(Chunk::new(
        &src[line_start_byte..trimmed_end_byte],
        start,
        end,
    ));
}

/// This tries to split the code by lines and add as much tokens as possible until reaching
/// `max_tokens`. Then it'll reduce to the last newline.
pub fn by_tokens<'s>(
    repo: &str,
    file: &str,
    src: &'s str,
    tokenizer: &Tokenizer, // we count from line
    max_tokens: usize,
    max_lines: usize,
    strategy: OverlapStrategy,
) -> Vec<Chunk<'s>> {
    if src.is_empty() {
        return Vec::new();
    }
    let Ok(encoding) = tokenizer.encode(src, true)
    else {
        warn!("Could not encode \"{}\"", src);
        return by_lines(src, max_lines);
    };

    let offsets = encoding.get_offsets();
    if offsets.is_empty() {
        return Vec::new();
    }

    let repo_plus_file = repo.to_owned() + "\t" + file + "\n";
    let repo_tokens = match tokenizer.encode(repo_plus_file, true) {
        Ok(encoding) => encoding.get_ids().len(),
        Err(e) => {
            error!("failure during encoding repo + file {:?}", e);
            return Vec::new();
        }
    };

    if max_tokens <= DEDUCT_SPECIAL_TOKENS + repo_tokens {
        error!("too few tokens");
        return Vec::new();
    }

    let max_tokens = max_tokens - DEDUCT_SPECIAL_TOKENS - repo_tokens;
    let max_newline_tokens = max_tokens * 3 / 4; //TODO: make this configurable
    let max_boundary_tokens = max_tokens * 7 / 8; //TODO: make this configurable
    debug!("max tokens reduced to {max_tokens}");

    let offsets_len = offsets.len() - 1;
    // remove the SEP token which has (0, 0) offsets for some reason
    let offsets = if offsets[offsets_len].0 == 0 {
        &offsets[..offsets_len]
    } else {
        offsets
    };
    let ids = encoding.get_ids();
    let mut chunks = Vec::new();
    let mut start = 0;
    let (mut last_line, mut last_byte) = (0, 0);
    loop {
        let next_limit = start + max_tokens;
        let end_limit = if next_limit >= offsets_len {
            offsets_len
        } else if let Some(next_newline) = (start + max_newline_tokens..next_limit)
            .rfind(|&i| src[offsets[i].0..offsets[i + 1].0].contains('\n'))
        {
            next_newline
        } else if let Some(next_boundary) = (start + max_boundary_tokens..next_limit).rfind(|&i| {
            !tokenizer
                .id_to_token(ids[i + 1])
                .map_or(false, |s| s.starts_with("##"))
        }) {
            next_boundary
        } else {
            next_limit
        };
        add_token_range(
            &mut chunks,
            src,
            offsets,
            start..end_limit,
            &mut last_line,
            &mut last_byte,
            false,
        );
        if end_limit == offsets_len {
            return chunks;
        }
        let diff = strategy.next_subdivision(end_limit - start);
        let mid = start + diff;
        //TODO: find nearest newlines or boundaries, set start accordingly
        let next_newline_diff =
            (mid..end_limit).find(|&i| src[offsets[i].0..offsets[i + 1].0].contains('\n'));
        let prev_newline_diff = (start + (diff / 2)..mid)
            .rfind(|&i| src[offsets[i].0..offsets[i + 1].0].contains('\n'));
        start = match (next_newline_diff, prev_newline_diff) {
            (Some(n), None) | (None, Some(n)) => n,
            (Some(n), Some(p)) => {
                if n - mid < mid - p {
                    n
                } else {
                    p
                }
            }
            (None, None) => (mid..end_limit)
                .find(|&i| {
                    !tokenizer
                        .id_to_token(ids[i + 1])
                        .map_or(false, |s| s.starts_with("##"))
                })
                .unwrap_or(mid),
        };
    }
}

pub fn by_lines(src: &str, size: usize) -> Vec<Chunk<'_>> {
    let ends = std::iter::once(0)
        .chain(src.match_indices('\n').map(|(i, _)| i))
        .enumerate()
        .collect::<Vec<_>>();

    let s = ends.iter().copied();
    let last = src.len().saturating_sub(1);
    let last_line = *ends.last().map(|(idx, _)| idx).unwrap_or(&0);

    ends.iter()
        .copied()
        .step_by(size)
        .zip(s.step_by(size).skip(1).chain([(last_line, last)]))
        .filter(|((_, start_byte), (_, end_byte))| start_byte < end_byte)
        .map(|((start_line, start_byte), (end_line, end_byte))| Chunk {
            data: &src[start_byte..end_byte],
            range: TextRange {
                start: Point {
                    byte: start_byte,
                    line: start_line,
                    column: 0,
                },
                end: Point {
                    byte: end_byte,
                    line: end_line,
                    column: 0,
                },
            },
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    pub fn test_by_tokens() {
        let cur_dir = env::current_dir().unwrap();
        let base_dir = cur_dir.ancestors().nth(2).unwrap();
        let tok_json = base_dir.join("model/tokenizer.json");
        let tokenizer = tokenizers::Tokenizer::from_file(tok_json).unwrap();
        let max_tokens = 256;
        let max_lines = 15;
        let walk = ignore::WalkBuilder::new(base_dir)
            .standard_filters(true)
            .build();
        for file in walk {
            let file = file.unwrap();
            if file.metadata().unwrap().is_dir() {
                continue;
            }
            let Ok(src) = std::fs::read_to_string(file.path()) else { continue };
            let _tokenwise = by_tokens(
                "bloop",
                &file.path().to_string_lossy(),
                &src,
                &tokenizer,
                max_tokens,
                max_lines,
                OverlapStrategy::Partial(0.5),
            );
        }
    }
}
