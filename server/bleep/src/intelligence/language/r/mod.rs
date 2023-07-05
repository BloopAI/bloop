use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static R: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["R"],
    file_extensions: &["R"],
    grammar: tree_sitter_r::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r#"
        (identifier) @hoverable
        "#,
    ),
    namespaces: &[&[
        // variables
        "variable",
    ]],
};

#[cfg(test)]
mod tests {
    use crate::intelligence::language::test_utils::*;
}
