use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static CPP: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["C++"],
    file_extensions: &["cpp", "cc", "h"],
    grammar: tree_sitter_cpp::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r#"
        [(identifier)
        (field_identifier)
        (type_identifier)
        (statement_identifier)
        (qualified_identifier)
        (namespace_identifier)] @hoverable
        "#,
    ),
    namespaces: &[&[
        // imports
        "header",
        // namespacing
        "namespace",
        // functions
        "macro",
        "function",
        // types
        "class",
        "struct",
        "enum",
        "enumerator",
        "union",
        "typedef",
        "concept",
        // variables
        "variable",
        // misc.
        "label",
        "alias",
    ]],
};

#[cfg(test)]
mod tests {

    use crate::intelligence::language::test_utils::*;

    // tests the following constructs:
    //
    // - templates on classes
    // - classes
    // - class props
    #[test]
    fn trivial() {
        test_scopes(
            "C++",
            r#"
            template <typename T>
            class AdvancedColumnFamilyOptions {
                private:
                    const std::vector<T>& options;
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        AdvancedColumnFamilyOptions {
                            kind: "class",
                            context: "class §AdvancedColumnFamilyOptions§ {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                T {
                                    kind: "typedef",
                                    context: "template <typename §T§>",
                                    referenced in (1): [
                                        `const std::vector<§T§>& options;`,
                                    ],
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        options {
                                            kind: "variable",
                                            context: "const std::vector<T>& §options§;",
                                        },
                                    ],
                                    child scopes: [],
                                },
                            ],
                        },
                    ],
                }
            "#]],
        )
    }

    // this syntax is not present in C
    #[test]
    fn for_range_loops() {
        test_scopes(
            "C++",
            r#"
            struct I {
            };

            int main() {
                struct I *items = {};
                for(I item: items) {
                    print(item);
                }
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        I {
                            kind: "struct",
                            context: "struct §I§ {",
                            referenced in (2): [
                                `struct §I§ *items = {};`,
                                `for(§I§ item: items) {`,
                            ],
                        },
                        main {
                            kind: "function",
                            context: "int §main§() {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [],
                            child scopes: [],
                        },
                        scope {
                            definitions: [],
                            child scopes: [
                                scope {
                                    definitions: [
                                        items {
                                            kind: "variable",
                                            context: "struct I *§items§ = {};",
                                            referenced in (1): [
                                                `for(I item: §items§) {`,
                                            ],
                                        },
                                    ],
                                    child scopes: [
                                        scope {
                                            definitions: [
                                                item {
                                                    kind: "variable",
                                                    context: "for(I §item§: items) {",
                                                    referenced in (1): [
                                                        `print(§item§);`,
                                                    ],
                                                },
                                            ],
                                            child scopes: [
                                                scope {
                                                    definitions: [],
                                                    child scopes: [],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }
            "#]],
        )
    }

    // the syntax nodes seem to have changed from the C impl.
    #[test]
    fn if_while_switch() {
        test_scopes(
            "C++",
            r#"
            int main() {
                int a;
                if (a == 0) {};
                switch (a) {};
                while (a) {};
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        main {
                            kind: "function",
                            context: "int §main§() {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [],
                            child scopes: [
                                scope {
                                    definitions: [
                                        a {
                                            kind: "variable",
                                            context: "int §a§;",
                                            referenced in (3): [
                                                `if (§a§ == 0) {};`,
                                                `switch (§a§) {};`,
                                                `while (§a§) {};`,
                                            ],
                                        },
                                    ],
                                    child scopes: [
                                        scope {
                                            definitions: [],
                                            child scopes: [],
                                        },
                                        scope {
                                            definitions: [],
                                            child scopes: [],
                                        },
                                        scope {
                                            definitions: [],
                                            child scopes: [],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }
            "#]],
        )
    }

    #[test]
    fn concepts() {
        test_scopes(
            "C++",
            r#"
            template<typename T> concept C2 =
            requires(T x) {
                {*x} -> std::convertible_to<typename T::inner>;
                {x + 1} -> std::same_as<int>;
                {x * 1} -> std::convertible_to<T>;
            };
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        C2 {
                            kind: "concept",
                            context: "template<typename T> concept §C2§ =",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                T {
                                    kind: "typedef",
                                    context: "template<typename §T§> concept C2 =",
                                    referenced in (3): [
                                        `requires(§T§ x) {`,
                                        `{*x} -> std::convertible_to<typename §T§::inner>;`,
                                        `{x * 1} -> std::convertible_to<§T§>;`,
                                    ],
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        x {
                                            kind: "variable",
                                            context: "requires(T §x§) {",
                                            referenced in (3): [
                                                `{*§x§} -> std::convertible_to<typename T::inner>;`,
                                                `{§x§ + 1} -> std::same_as<int>;`,
                                                `{§x§ * 1} -> std::convertible_to<T>;`,
                                            ],
                                        },
                                    ],
                                    child scopes: [],
                                },
                            ],
                        },
                    ],
                }
            "#]],
        )
    }

    // variables in throw statements do not resolve, reported by @ggordonhall
    #[test]
    fn bug_report_throw_statement() {
        test_scopes(
            "C++",
            r#"
            int main() {
                try 
                { } 
                catch (Exception ex)
                { throw ex; }
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        main {
                            kind: "function",
                            context: "int §main§() {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [],
                            child scopes: [
                                scope {
                                    definitions: [],
                                    child scopes: [
                                        scope {
                                            definitions: [],
                                            child scopes: [],
                                        },
                                        scope {
                                            definitions: [
                                                ex {
                                                    kind: "variable",
                                                    context: "catch (Exception §ex§)",
                                                    referenced in (1): [
                                                        `{ throw §ex§; }`,
                                                    ],
                                                },
                                            ],
                                            child scopes: [
                                                scope {
                                                    definitions: [],
                                                    child scopes: [],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }
            "#]],
        )
    }

    // ternary expressions do not resolve correctly, reported by @ggordonhall
    #[test]
    fn bug_report_ternary_expression() {
        test_scopes(
            "C++",
            r#"
            int main() {
                int a, b, c;
                a ? b : c;
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        main {
                            kind: "function",
                            context: "int §main§() {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [],
                            child scopes: [
                                scope {
                                    definitions: [
                                        a {
                                            kind: "variable",
                                            context: "int §a§, b, c;",
                                            referenced in (1): [
                                                `§a§ ? b : c;`,
                                            ],
                                        },
                                        b {
                                            kind: "variable",
                                            context: "int a, §b§, c;",
                                            referenced in (1): [
                                                `a ? §b§ : c;`,
                                            ],
                                        },
                                        c {
                                            kind: "variable",
                                            context: "int a, b, §c§;",
                                            referenced in (1): [
                                                `a ? b : §c§;`,
                                            ],
                                        },
                                    ],
                                    child scopes: [],
                                },
                            ],
                        },
                    ],
                }
            "#]],
        )
    }
}
