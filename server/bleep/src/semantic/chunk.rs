use crate::{
    intelligence::{Language, TSLanguage},
    text_range::{Point, TextRange},
};

use tokenizers::Tokenizer;
use tracing::warn;
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

fn point(src: &str, byte: usize) -> Point {
    let line = src.as_bytes()[..byte].iter().filter(|&&b| b == b'\n').count();
    let column = if let Some(last_nl) = src[..byte].rfind('\n') {
        byte - last_nl
    } else {
        byte
    };
    Point { byte, column, line }
}

fn add_chunks<'s>(results: &mut Vec<Chunk<'s>>, src: &'s str, offsets: &[(usize, usize)], start: usize, end: usize, _max_tokens: usize) {
    //TODO: split if more than _max_tokens
    let startpoint = point(src, offsets[start].0);
    let endpoint = point(src, offsets[end].1);
    if endpoint.byte > startpoint.byte { 
        results.push(Chunk::new(&src[startpoint.byte .. endpoint.byte], startpoint, endpoint));        
    }
}

/// This tries to split the code by lines and add as much tokens as possible until reaching
/// `max_tokens`. Then it'll reduce to the last newline.
pub fn by_tokens<'s>(
    src: &'s str,
    tokenizer: &Tokenizer,
    max_tokens: usize,
    max_lines: usize,
) -> Vec<Chunk<'s>> {
    if src.is_empty() {
        return Vec::new();
    }
    let Ok(encoding) = tokenizer.encode(src, false)
    else {
        warn!("Could not encode \"{}\"", src);
        return trivial(src, max_lines);
    };
    // FIXME: This unfortunately is the char offset, not the byte offset!
    // We need to take care of non-ascii unicode at some point
    // another reason for aleph-alpha-tokenizer...
    let offsets = encoding.get_offsets();
    let offset_len = offsets.len();
    let mut first_newline = 0;
    let mut last_newline = 0;
    let mut result = Vec::new();
    for newline in (0..(offset_len - 1)).filter(|&i| src[offsets[i].1 .. offsets[i + 1].0].contains('\n')) {
        if newline - first_newline > max_tokens {
            add_chunks(&mut result, src, offsets, first_newline, last_newline, max_tokens);
            first_newline = (last_newline + 1).min(offset_len);
        }
        last_newline = newline;
    }
    if first_newline < offset_len {
        add_chunks(&mut result, src, offsets, first_newline, offset_len - 1, max_tokens);
    }
    result
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
    #[test]
    pub fn test_by_tokens() {
        let src = include_str!("chunk.rs"); // tokenize yourself!
        let tokenizer = tokenizers::Tokenizer::from_file("../../model/tokenizer.json")
        .unwrap();
        let max_tokens = 128;
        let max_lines = 15;
        dbg!(super::by_tokens(src, &tokenizer, max_tokens, max_lines));
    }
}