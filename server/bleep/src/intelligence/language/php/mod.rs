use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static PHP: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["PHP"],
    file_extensions: &["php"],
    grammar: tree_sitter_php::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r#"
        (name) @hoverable
        "#,
    ),
    namespaces: &[
        &[
            // variables
            "constant",
            "function",
            "method",
            "parameter",
            "variable",
            // types
            "class",
            "enum",
            "trait",
            "interface",
            // fields
            "field",
            "enumerator",
            // misc
            "label",
        ],
        &[
            // namespacing
            "namespace",
        ],
    ],
};
