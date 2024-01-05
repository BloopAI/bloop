use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static COBOL: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["COBOL"],
    file_extensions: &["cbl", "cpy", "cob", "ccp", "cobol"],
    grammar: tree_sitter_COBOL::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r"
        [(program_name)
        (entry_name)
        (WORD)] @hoverable
        ",
    ),
    namespaces: &[&["program", "file", "data", "paragraph"]],
};
