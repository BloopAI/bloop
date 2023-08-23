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

    // Self::method and self.method can be raised as references
    #[test]
    fn declarations() {
        test_scopes(
            "R",
            r#"
            x <- value
            value -> y
            x[0] <<- value
            value ->> y[0]
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        x {
                            kind: "variable",
                            context: "§x§ <- value",
                            referenced in (1): [
                                `§x§[0] <<- value`,
                            ],
                        },
                        y {
                            kind: "variable",
                            context: "value -> §y§",
                            referenced in (1): [
                                `value ->> §y§[0]`,
                            ],
                        },
                    ],
                    child scopes: [],
                }
            "#]],
        )
    }

    #[test]
    fn control_if() {
        test_scopes(
            "R",
            r#"
            x <- TRUE
            y <- value
            if (x)
                return(y)
            else 
                return(y)
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        x {
                            kind: "variable",
                            context: "§x§ <- TRUE",
                            referenced in (1): [
                                `if (§x§)`,
                            ],
                        },
                        y {
                            kind: "variable",
                            context: "§y§ <- value",
                            referenced in (2): [
                                `return(§y§)`,
                                `return(§y§)`,
                            ],
                        },
                    ],
                    child scopes: [],
                }
            "#]],
        )
    }

    #[test]
    fn control_loop() {
        test_scopes(
            "R",
            r#"
            x <- TRUE
            repeat x

            while (x) return

            y <- c(1, 2, 3)
            for (item in y) {
                y <- item + 1
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        x {
                            kind: "variable",
                            context: "§x§ <- TRUE",
                            referenced in (2): [
                                `repeat §x§`,
                                `while (§x§) return`,
                            ],
                        },
                        y {
                            kind: "variable",
                            context: "§y§ <- c(1, 2, 3)",
                            referenced in (1): [
                                `for (item in §y§) {`,
                            ],
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                item {
                                    kind: "variable",
                                    context: "for (§item§ in y) {",
                                    referenced in (1): [
                                        `y <- §item§ + 1`,
                                    ],
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        y {
                                            kind: "variable",
                                            context: "§y§ <- item + 1",
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

    #[test]
    fn control_switch() {
        test_scopes(
            "R",
            r#"
            x <- "add"

            y <- 2
            z <- 1
            switch(x, "add" = y + z, "subtract" = y - z)
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        x {
                            kind: "variable",
                            context: "§x§ <- \"add\"",
                            referenced in (1): [
                                `switch(§x§, "add" = y + z, "subtract" = y - z)`,
                            ],
                        },
                        y {
                            kind: "variable",
                            context: "§y§ <- 2",
                            referenced in (2): [
                                `switch(x, "add" = §y§ + z, "subtract" = y - z)`,
                                `switch(x, "add" = y + z, "subtract" = §y§ - z)`,
                            ],
                        },
                        z {
                            kind: "variable",
                            context: "§z§ <- 1",
                            referenced in (2): [
                                `switch(x, "add" = y + §z§, "subtract" = y - z)`,
                                `switch(x, "add" = y + z, "subtract" = y - §z§)`,
                            ],
                        },
                    ],
                    child scopes: [],
                }
            "#]],
        )
    }

    #[test]
    fn indexing() {
        test_scopes(
            "R",
            r#"
            x <- c(1, 2, 3)

            idx <- 1

            y <- x[i]
            z <- x $ i
            w <- x[[i]]
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        x {
                            kind: "variable",
                            context: "§x§ <- c(1, 2, 3)",
                            referenced in (3): [
                                `y <- §x§[i]`,
                                `z <- §x§ $ i`,
                                `w <- §x§[[i]]`,
                            ],
                        },
                        idx {
                            kind: "variable",
                            context: "§idx§ <- 1",
                        },
                        y {
                            kind: "variable",
                            context: "§y§ <- x[i]",
                        },
                        z {
                            kind: "variable",
                            context: "§z§ <- x $ i",
                        },
                        w {
                            kind: "variable",
                            context: "§w§ <- x[[i]]",
                        },
                    ],
                    child scopes: [],
                }
            "#]],
        )
    }

    #[test]
    fn value_of_function_definition() {
        let src = r#"foo <- function (a, b, c) { // 0
                        a <- a + 1               // 1
                        b <- a + 1               // 2
                        c <- a + 1               // 3
                    }                            // 4"#;

        let sg = build_graph("R", src.as_bytes());
        let foo_function = sg.find_node_by_name(src.as_bytes(), b"foo").unwrap();
        let function_node = &sg.graph[sg.value_of_definition(foo_function).unwrap()];

        assert_eq!(function_node.range().start.line, 0);
        assert_eq!(function_node.range().end.line, 4);
    }
}
