use crate::{
    intelligence::{Language, TSLanguage},
    text_range::{Point, TextRange},
};

use tokenizers::Tokenizer;
use tracing::{warn, error};
use tree_sitter::{Parser, QueryCursor};

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
}

pub fn tree_sitter<'a, 'l>(src: &'a str, lang_id: &'l str) -> Result<Vec<Chunk<'a>>, ChunkError> {
    let (language, query) = match TSLanguage::from_id(lang_id) {
        Language::Supported(config) => {
            let language = config.grammar;
            let query = config
                .chunk_query
                .as_ref()
                .ok_or_else(|| ChunkError::UnsupportedLanguage(lang_id.to_owned()))?
                .query(language)
                .map_err(ChunkError::Query)?;
            (language, query)
        }
        Language::Unsupported => return Err(ChunkError::UnsupportedLanguage(lang_id.to_owned())),
    };

    let mut parser = Parser::new();
    parser.set_language(language()).unwrap();
    let tree = parser.parse(src, None).unwrap();

    let chunks = QueryCursor::new()
        .matches(query, tree.root_node(), src.as_bytes())
        .filter_map(|m| {
            if m.captures.is_empty() {
                // if we have no captures, the chunk-query is malformed
                None
            } else {
                // if we have two or more captures, we found docs + content, merge them
                m.captures
                    .iter()
                    .map(|c| c.node.range())
                    .reduce(|mut acc, x| {
                        acc.start_point.column =
                            usize::min(x.start_point.column, acc.start_point.column);
                        acc.start_point.row = usize::min(x.start_point.row, acc.start_point.row);
                        acc.start_byte = usize::min(x.start_byte, acc.start_byte);

                        acc.end_point.column = usize::max(x.end_point.column, acc.end_point.column);
                        acc.end_point.row = usize::max(x.end_point.row, acc.end_point.row);
                        acc.end_byte = usize::max(x.end_byte, acc.end_byte);

                        acc
                    })
            }
        })
        .map(|r| Chunk {
            data: &src[r.start_byte..r.end_byte],
            range: r.into(),
        })
        .collect();

    Ok(chunks)
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

/// The strategy for overlapping
pub enum OverlapStrategy {
    /// go back _ lines from the end
    ByLines(usize),
    /// A value > 0 and < 1 that indicates the target overlap in tokens.
    Partial(f64),
}

impl OverlapStrategy {
    /// returns the index into the `starts` array according to the strategy
    fn next_start(&self, starts: &[usize], start: usize, end: usize) -> usize {
        (match self {
            Self::ByLines(n) => starts.partition_point(|&x| x <= end).saturating_sub(*n),
            Self::Partial(part) => {
                let mid = start + (((end - start) as f64) * part) as usize;
                starts.partition_point(|&x| x <= mid)
            }
        }) + 1
    }

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
    start: usize,
    end: usize,
    last_line: &mut usize,
    last_byte: &mut usize,
) {
    let start_byte = offsets[start].0;
    let end_byte = offsets.get(end).map_or(src.len(), |&(s, _)| s);
    let Some(trimmed_end_byte) = src[..end_byte]
        .char_indices()
        .rev()
        .find_map(|(i, c)| (!c.is_whitespace()).then_some(i)) else { return };
    if trimmed_end_byte <= start_byte {
        return;
    }
    let start = point(&src, start_byte, *last_line, *last_byte);
    let end = point(&src, trimmed_end_byte, *last_line, *last_byte);
    (*last_line, *last_byte) = (start.line, start.byte);
    chunks.push(Chunk::new(
        &src[start_byte..trimmed_end_byte],
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
        return trivial(src, max_lines);
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
        },
    };

    if max_tokens <= DEDUCT_SPECIAL_TOKENS + repo_tokens {
        tracing::error!("too little tokens");
        return Vec::new();
    }

    let max_tokens = max_tokens - DEDUCT_SPECIAL_TOKENS - repo_tokens;
    tracing::info!("max tokens reduced to {max_tokens}");
    // all indices into tokens/offsets at which a new line might begin.
    let mut starts: Vec<_> = vec![0];
    starts.extend((1..offsets.len()).filter(|&i| {
        let (from, until) = (offsets[i - 1].0, offsets[i].0);
        from < until && src[from..until].contains('\n')
    }));

    // calculate the start/end indices into tokens/offsets for the chunk starts/ends
    let mut chunks = Vec::new();
    let mut s = 0;
    let mut offset = 0;
    let (mut last_line, mut last_byte) = (1, 0);
    while let Some(index_diff) = starts[s..].iter().position(|&p| p - offset > max_tokens) {
        let next_s = s + index_diff - 1;
        // add (offset, end) to token_ranges, split if necessary
        if next_s == s {
            // overlong line
            let end_offset = starts.get(s + 1).map_or_else(|| offsets.len(), |&o| o);
            loop {
                let end = offset + max_tokens;
                if end > end_offset {
                    add_token_range(
                        &mut chunks,
                        src,
                        offsets,
                        offset,
                        end_offset,
                        &mut last_line,
                        &mut last_byte,
                    );
                    break;
                }
                add_token_range(
                    &mut chunks,
                    src,
                    offsets,
                    offset,
                    end,
                    &mut last_line,
                    &mut last_byte,
                );
                offset += strategy.next_subdivision(max_tokens);
            }
            s += 1;
        } else {
            let end = starts[next_s];
            add_token_range(
                &mut chunks,
                src,
                offsets,
                offset,
                end,
                &mut last_line,
                &mut last_byte,
            );
            s = strategy.next_start(&starts, offset, end);
        }
        offset = starts[s];
    }
    if offset < offsets.len() {
        add_token_range(
            &mut chunks,
            src,
            offsets,
            offset,
            offsets.len(),
            &mut last_line,
            &mut last_byte,
        );
    }
    chunks
}

pub fn trivial(src: &str, size: usize) -> Vec<Chunk<'_>> {
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
    use std::path::Path;

    #[test]
    pub fn test_by_tokens() {
        let base_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap();
        let tok_json = base_dir.join("model/tokenizer.json");
        let tokenizer = tokenizers::Tokenizer::from_file(tok_json).unwrap();
        let max_tokens = 256;
        let max_lines = 15;
        let walk = ignore::WalkBuilder::new(base_dir)
            .standard_filters(true)
            .build();
        let (mut tokensum, mut linesum) = (0, 0);
        for file in walk {
            let file = file.unwrap();
            if file.metadata().unwrap().is_dir() {
                continue;
            }
            let Ok(src) = std::fs::read_to_string(file.path()) else { continue };
            let path = file.path().to_string_lossy();
            let tokenwise = by_tokens(
                &file.path().to_string_lossy(),
                &src,
                &tokenizer,
                max_tokens,
                max_lines,
                OverlapStrategy::Partial(0.5),
            )
            .len();
            let linewise = trivial(&src, 15).len();
            dbg!((path, tokenwise, linewise));
            tokensum += tokenwise;
            linesum += linewise;
        }
        dbg!(tokensum, linesum);
    }
}
