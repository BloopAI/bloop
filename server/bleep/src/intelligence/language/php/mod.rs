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
    namespaces: &[&[
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
        // namespacing
        "namespace",
    ]],
    stack_graph_config: None,
};

#[cfg(test)]
mod tests {
    use crate::intelligence::language::test_utils::*;

    #[test]
    fn declarations() {
        test_scopes(
            "PHP",
            r#"
            <?php
            $a = 2;
            const A = 2;
            ?>
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        a {
                            kind: "variable",
                            context: "$§a§ = 2;",
                        },
                        A {
                            kind: "constant",
                            context: "const §A§ = 2;",
                        },
                    ],
                    child scopes: [],
                }
            "#]],
        )
    }

    #[test]
    fn functions() {
        test_scopes(
            "PHP",
            r#"
            <?php
            $default_value = 2;
            function foo(A $a, B $b = $default_value) {
                return $a + $b
            }
            ?>
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        default_value {
                            kind: "variable",
                            context: "$§default_value§ = 2;",
                            referenced in (1): [
                                `function foo(A $a, B $b = $§default_value§) {`,
                            ],
                        },
                        foo {
                            kind: "function",
                            context: "function §foo§(A $a, B $b = $default_value) {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                a {
                                    kind: "parameter",
                                    context: "function foo(A $§a§, B $b = $default_value) {",
                                    referenced in (1): [
                                        `return $§a§ + $b`,
                                    ],
                                },
                                b {
                                    kind: "parameter",
                                    context: "function foo(A $a, B $§b§ = $default_value) {",
                                    referenced in (1): [
                                        `return $a + $§b§`,
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
                }
            "#]],
        )
    }

    #[test]
    fn lambdas() {
        test_scopes(
            "PHP",
            r#"
            <?php
            $double = $x -> $x * 2;
            $quadruple = fn($x) => $double($double($x));
            ?>
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        double {
                            kind: "variable",
                            context: "$§double§ = $x -> $x * 2;",
                        },
                        quadruple {
                            kind: "variable",
                            context: "$§quadruple§ = fn($x) => $double($double($x));",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                x {
                                    kind: "parameter",
                                    context: "$quadruple = fn($§x§) => $double($double($x));",
                                    referenced in (1): [
                                        `$quadruple = fn($x) => $double($double($§x§));`,
                                    ],
                                },
                            ],
                            child scopes: [],
                        },
                    ],
                }
            "#]],
        )
    }

    #[test]
    fn classes() {
        test_scopes(
            "PHP",
            r#"
            <?php
            interface Identity {
                function id($arg) {
                    return $arg;
                }
            }

            class Set
            implements Identity
            {
                Array $items;

                function n(): Set {
                    return (new Set());
                }
            }
            ?>
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        Identity {
                            kind: "interface",
                            context: "interface §Identity§ {",
                            referenced in (1): [
                                `implements §Identity§`,
                            ],
                        },
                        Set {
                            kind: "class",
                            context: "class §Set§",
                            referenced in (2): [
                                `function n(): §Set§ {`,
                                `return (new §Set§());`,
                            ],
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                id {
                                    kind: "method",
                                    context: "function §id§($arg) {",
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        arg {
                                            kind: "parameter",
                                            context: "function id($§arg§) {",
                                            referenced in (1): [
                                                `return $§arg§;`,
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
                        scope {
                            definitions: [
                                items {
                                    kind: "field",
                                    context: "Array $§items§;",
                                },
                                n {
                                    kind: "method",
                                    context: "function §n§(): Set {",
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [],
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
                }
            "#]],
        )
    }

    #[test]
    fn control_flow() {
        test_scopes(
            "PHP",
            r#"
            <?php
            $a = TRUE;
            $b = FALSE;
            $c = 2;
            $xs = [];

            if ($a) $c;
            if ($a) {
                return $c;
            } else {
                return $c;
            }
            if ($a) {
                return $c;
            } else if ($b) {
                return $c;
            } else {
                return $c;
            }

            for ($i = 0; $i < 10; $i++) {
                return $c;
            }

            foreach($xs as $x) {
                return $x;
            }
            ?>
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        a {
                            kind: "variable",
                            context: "$§a§ = TRUE;",
                            referenced in (3): [
                                `if ($§a§) $c;`,
                                `if ($§a§) {`,
                                `if ($§a§) {`,
                            ],
                        },
                        b {
                            kind: "variable",
                            context: "$§b§ = FALSE;",
                            referenced in (1): [
                                `} else if ($§b§) {`,
                            ],
                        },
                        c {
                            kind: "variable",
                            context: "$§c§ = 2;",
                            referenced in (7): [
                                `if ($a) $§c§;`,
                                `return $§c§;`,
                                `return $§c§;`,
                                `return $§c§;`,
                                `return $§c§;`,
                                `return $§c§;`,
                                `return $§c§;`,
                            ],
                        },
                        xs {
                            kind: "variable",
                            context: "$§xs§ = [];",
                            referenced in (1): [
                                `foreach($§xs§ as $x) {`,
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
                            child scopes: [
                                scope {
                                    definitions: [],
                                    child scopes: [],
                                },
                                scope {
                                    definitions: [],
                                    child scopes: [
                                        scope {
                                            definitions: [],
                                            child scopes: [],
                                        },
                                    ],
                                },
                            ],
                        },
                        scope {
                            definitions: [],
                            child scopes: [
                                scope {
                                    definitions: [],
                                    child scopes: [],
                                },
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
                                                    definitions: [],
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
                        },
                        scope {
                            definitions: [
                                i {
                                    kind: "variable",
                                    context: "for ($§i§ = 0; $i < 10; $i++) {",
                                    referenced in (2): [
                                        `for ($i = 0; $§i§ < 10; $i++) {`,
                                        `for ($i = 0; $i < 10; $§i§++) {`,
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
                        scope {
                            definitions: [
                                x {
                                    kind: "variable",
                                    context: "foreach($xs as $§x§) {",
                                    referenced in (1): [
                                        `return $§x§;`,
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
                }
            "#]],
        )
    }
}
