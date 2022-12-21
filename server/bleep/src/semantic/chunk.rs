use crate::intelligence::{Language, TSLanguage};
use tree_sitter::{Parser, QueryCursor};

#[derive(Debug)]
pub enum ChunkError {
    UnsupportedLanguage(String),
    Query(tree_sitter::QueryError),
}

pub fn tree_sitter<'a, 'l>(src: &'a str, lang_id: &'l str) -> Result<Vec<&'a str>, ChunkError> {
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
                    .map(|c| c.node.byte_range())
                    .reduce(|acc, x| usize::min(x.start, acc.start)..usize::max(x.end, acc.end))
            }
        })
        .map(|r| &src[r])
        .collect();

    Ok(chunks)
}

pub fn trivial(src: &str, size: usize) -> Vec<&str> {
    let last = src.len() - 1;
    let ends = std::iter::once(0)
        .chain(src.match_indices('\n').map(|(i, _)| i))
        .step_by(size)
        .collect::<Vec<_>>();

    ends.iter()
        .copied()
        .zip(ends.iter().copied().skip(1).chain([last]))
        .filter(|(start, end)| start < end)
        .map(|(start, end)| &src[start..end])
        .collect()
}
