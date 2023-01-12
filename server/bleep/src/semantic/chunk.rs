use crate::{
    intelligence::{Language, TSLanguage},
    text_range::{Point, TextRange},
};

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
    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.len() < 1
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
