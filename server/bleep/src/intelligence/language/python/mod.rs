use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static PYTHON: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["Python"],
    file_extensions: &["py"],
    grammar: tree_sitter_python::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r#"
        (identifier) @hoverable
        "#,
    ),
    namespaces: &[&["class", "function", "parameter", "variable"]],
};

#[cfg(test)]
mod tests {
    use crate::intelligence::language::test_utils::*;

    // tests the following constructs:
    // - function definitions
    // - function parameters
    // - default parameters
    // - block scopes
    // - assignments statements
    // - augmented assignment statements
    // - function calls
    #[test]
    fn basic() {
        test_scopes(
            "Python",
            r#"
            def increment(value, by=1):
                value += by

            def main():
                a = 5
                b = 3

                increment(a)
                increment(a, by=b)

            main()
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        increment {
                            kind: "function",
                            context: "def §increment§(value, by=1):",
                            referenced in (2): [
                                `§increment§(a)`,
                                `§increment§(a, by=b)`,
                            ],
                        },
                        main {
                            kind: "function",
                            context: "def §main§():",
                            referenced in (1): [
                                `§main§()`,
                            ],
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                value {
                                    kind: "parameter",
                                    context: "def increment(§value§, by=1):",
                                    referenced in (1): [
                                        `§value§ += by`,
                                    ],
                                },
                                by {
                                    kind: "parameter",
                                    context: "def increment(value, §by§=1):",
                                    referenced in (1): [
                                        `value += §by§`,
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
                            definitions: [],
                            child scopes: [
                                scope {
                                    definitions: [
                                        a {
                                            kind: "variable",
                                            context: "§a§ = 5",
                                            referenced in (2): [
                                                `increment(§a§)`,
                                                `increment(§a§, by=b)`,
                                            ],
                                        },
                                        b {
                                            kind: "variable",
                                            context: "§b§ = 3",
                                            referenced in (1): [
                                                `increment(a, by=§b§)`,
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

    // tests the following constructs:
    // - from imports
    // - imports
    // - list comprehensions
    // - type annotations
    #[test]
    fn complex() {
        test_scopes(
            "Python",
            r#"
            from typings import List
            import math

            def sines(items: List[int]) -> List[int]:
                return [math.sin(item) for item in items]

            list = [1, 2, 3]
            sines(list)
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        sines {
                            kind: "function",
                            context: "def §sines§(items: List[int]) -> List[int]:",
                            referenced in (1): [
                                `§sines§(list)`,
                            ],
                        },
                        list {
                            kind: "variable",
                            context: "§list§ = [1, 2, 3]",
                            referenced in (1): [
                                `sines(§list§)`,
                            ],
                        },
                    ],
                    imports: [
                        List {
                            context: "from typings import §List§",
                            referenced in (2): [
                                `def sines(items: §List§[int]) -> List[int]:`,
                                `def sines(items: List[int]) -> §List§[int]:`,
                            ],
                        },
                        math {
                            context: "import §math§",
                            referenced in (1): [
                                `return [§math§.sin(item) for item in items]`,
                            ],
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                items {
                                    kind: "parameter",
                                    context: "def sines(§items§: List[int]) -> List[int]:",
                                    referenced in (1): [
                                        `return [math.sin(item) for item in §items§]`,
                                    ],
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [],
                                    child scopes: [
                                        scope {
                                            definitions: [
                                                item {
                                                    kind: "variable",
                                                    context: "return [math.sin(item) for §item§ in items]",
                                                    referenced in (1): [
                                                        `return [math.sin(§item§) for item in items]`,
                                                    ],
                                                },
                                            ],
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

    // tests class definitions
    #[test]
    fn classes() {
        test_scopes(
            "Python",
            r#"
            class Foo():
                def bar(self):
                    return self

            def main():
                a = Foo()
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        Foo {
                            kind: "class",
                            context: "class §Foo§():",
                            referenced in (1): [
                                `a = §Foo§()`,
                            ],
                        },
                        main {
                            kind: "function",
                            context: "def §main§():",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                bar {
                                    kind: "function",
                                    context: "def §bar§(self):",
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        self {
                                            kind: "parameter",
                                            context: "def bar(§self§):",
                                            referenced in (1): [
                                                `return §self§`,
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
                            definitions: [],
                            child scopes: [
                                scope {
                                    definitions: [
                                        a {
                                            kind: "variable",
                                            context: "§a§ = Foo()",
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

    // tests edge cases
    #[test]
    fn absurd() {
        // circular assignment
        test_scopes(
            "Python",
            "
            some_list = some_list[0] = [0, 1]
            "
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        some_list {
                            kind: "variable",
                            context: "§some_list§ = some_list[0] = [0, 1]",
                            referenced in (1): [
                                `some_list = §some_list§[0] = [0, 1]`,
                            ],
                        },
                    ],
                    child scopes: [],
                }
            "#]],
        );

        // circular func call
        test_scopes(
            "Python",
            "
            fix = lambda f: fix(f)
            "
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        fix {
                            kind: "variable",
                            context: "§fix§ = lambda f: fix(f)",
                            referenced in (1): [
                                `fix = lambda f: §fix§(f)`,
                            ],
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                f {
                                    kind: "parameter",
                                    context: "fix = lambda §f§: fix(f)",
                                    referenced in (1): [
                                        `fix = lambda f: fix(§f§)`,
                                    ],
                                },
                            ],
                            child scopes: [],
                        },
                    ],
                }
            "#]],
        );
    }

    #[test]
    fn decorators() {
        test_scopes(
            "Python",
            r#"
            from module import decor

            @decor
            def foo():
                pass
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        foo {
                            kind: "function",
                            context: "def §foo§():",
                        },
                    ],
                    imports: [
                        decor {
                            context: "from module import §decor§",
                            referenced in (1): [
                                `@§decor§`,
                            ],
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
                }
            "#]],
        )
    }

    #[test]
    fn types() {
        test_scopes(
            "Python",
            r#"
            MyType = List[int]

            def foo(t: MyType) -> MyType:
                a: MyType = [1, 2, 3]
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        MyType {
                            kind: "variable",
                            context: "§MyType§ = List[int]",
                            referenced in (3): [
                                `def foo(t: §MyType§) -> MyType:`,
                                `def foo(t: MyType) -> §MyType§:`,
                                `a: §MyType§ = [1, 2, 3]`,
                            ],
                        },
                        foo {
                            kind: "function",
                            context: "def §foo§(t: MyType) -> MyType:",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                t {
                                    kind: "parameter",
                                    context: "def foo(§t§: MyType) -> MyType:",
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        a {
                                            kind: "variable",
                                            context: "§a§: MyType = [1, 2, 3]",
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
