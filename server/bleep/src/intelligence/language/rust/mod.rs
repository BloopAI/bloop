use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static RUST: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["Rust"],
    file_extensions: &["rs"],
    grammar: tree_sitter_rust::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r#"
        [(identifier)
         (shorthand_field_identifier)
         (field_identifier)
         (type_identifier)] @hoverable
        "#,
    ),
    namespaces: &[&[
        // variables
        "const",
        "function",
        "variable",
        // types
        "struct",
        "enum",
        "union",
        "typedef",
        "interface",
        // fields
        "field",
        "enumerator",
        // namespacing
        "module",
        // misc
        "label",
        "lifetime",
    ]],
};

#[cfg(test)]
mod tests {
    use crate::intelligence::language::test_utils::*;

    #[test]
    fn declare_const_and_static() {
        let src = r#"
            const a: () = ();
            static b: () = ();
        "#;

        let (_, def_count, _, _) = counts(src, "Rust");

        // a, b
        assert_eq!(def_count, 2);
    }

    #[test]
    fn declare_let_statement() {
        let src = r#"
            fn main() {
                let a = ();
                let (b, c) = ();
                let S { d, e } = ();
                let S { field: f, g } = ();
                let S { h, .. } = ();
                let S { i, field: _ } = ();
            }
        "#;
        let (_, def_count, _, _) = counts(src, "Rust");

        // main, a, b, c, d, e, f, g, h, i
        assert_eq!(def_count, 10);
    }

    #[test]
    fn declare_function_params() {
        let src = r#"
            fn f1(a: T) {}
            fn f2(b: T, c: T) {}
            fn f3((d, e): (T, U)) {}
            fn f4(S {f, g}: S) {}
            fn f5(S {h, ..}: S) {}
            fn f6(S { field: i }: S) {}
        "#;
        let (_, def_count, _, _) = counts(src, "Rust");

        // f1, f2, f3, f4, f5, f6, a, b, c, d, e, f, g, h, i
        assert_eq!(def_count, 15);
    }

    #[test]
    fn declare_closure_params() {
        let src = r#"
            fn main() {
                let _ = |x| {};
                let _ = |x, y| {};
                let _ = |x: ()| {};
                let _ = |(x, y): ()| {};
            }
        "#;
        let (_, def_count, _, _) = counts(src, "Rust");

        // main,
        // x,
        // x, y,
        // x,
        // x, y
        assert_eq!(def_count, 7);
    }

    #[test]
    fn declare_labels() {
        let src = r#"
            fn main() {
                'loop: loop {};
                'loop: for _ in () {}
                'loop: while true {}
            }
        "#;
        let (_, def_count, _, _) = counts(src, "Rust");

        // main, 'loop x3
        assert_eq!(def_count, 4);
    }

    #[test]
    fn declare_types() {
        let src = r#"
            struct One {
                two: T,
                three: T,
            }

            enum Four {
                Five,
                Six(T),
                Seven {
                    eight: T
                }
            }

            union Nine {}

            type Ten = ();
        "#;
        let (_, def_count, _, _) = counts(src, "Rust");

        assert_eq!(def_count, 10);
    }

    #[test]
    fn declare_namespaces() {
        let src = r#"
            mod one {}
            pub mod two {}
            mod three {
                mod four {}
            }
        "#;
        let (_, def_count, _, _) = counts(src, "Rust");

        assert_eq!(def_count, 4);
    }

    #[test]
    fn declare_let_expr() {
        let src = r#"
            if let a = () {}
            if let Some(a) = () {}

            while let a = () {}
            while let Some(a) = () {}
        "#;
        let (_, def_count, _, _) = counts(src, "Rust");

        assert_eq!(def_count, 4);
    }

    #[test]
    fn refer_unary_expr() {
        let src = r#"
            fn main() {
                let a = 2;
                !a;
                -a;
                *a;
            }
        "#;
        let (_, _, ref_count, _) = counts(src, "Rust");

        assert_eq!(ref_count, 3);
    }

    #[test]
    fn refer_binary_expr() {
        let src = r#"
            fn main() {
                let a = 2;
                let b = 3;
                a + b;
                a >> b;
            }
        "#;
        let (_, _, ref_count, _) = counts(src, "Rust");

        assert_eq!(ref_count, 4);
    }

    #[test]
    fn refer_control_flow() {
        let src = r#"
            fn main() {
                let a = 2;

                // 1
                if a {}

                // 2
                if _ {} else if a {}

                // 3
                while a {
                    // 4
                    break a;
                }

                // 5
                a?;

                // 6
                return a;

                // 7
                a.await;

                // 8
                yield a;
            }
        "#;
        let (_, _, ref_count, _) = counts(src, "Rust");

        assert_eq!(ref_count, 8);
    }

    #[test]
    fn refer_assignment() {
        let src = r#"
            fn main() {
                let mut a = 2;
                a += 2;
                a = 2;
                a *= 2;
            }
        "#;
        let (_, _, ref_count, _) = counts(src, "Rust");

        assert_eq!(ref_count, 3);
    }

    #[test]
    fn refer_struct_expr() {
        let src = r#"
            fn main() {
                let a = 2;
                let b = 2;
                S { a, b };
                S { ..a };
                S { field: a, b };
            }
        "#;
        let (_, _, ref_count, _) = counts(src, "Rust");

        assert_eq!(ref_count, 5);
    }

    #[test]
    fn refer_dot() {
        let src = r#"
            fn main() {
                let a = S {};

                a.b;
                a.foo();
            }
        "#;
        let (_, _, ref_count, _) = counts(src, "Rust");

        assert_eq!(ref_count, 2);
    }

    #[test]
    fn refer_arguments() {
        let src = r#"
            fn main() {
                let a = 2;
                let b = 3;
                foo(a, b);
            }
        "#;
        let (_, _, ref_count, _) = counts(src, "Rust");

        assert_eq!(ref_count, 2);
    }

    #[test]
    fn symbols() {
        let src = r#"
            fn one() {
                let two = 1;
                let (three, four) = (2, 3);
                let T { field: five} = t;
                let _ = |six| {};
                const seven: () = ();
                static eight: () = ();
            }

            struct Nine {
                ten: (),
            }

            union Eleven {}
            enum Twelve {
                Thirteen,
                Fourteen(T)
            }
            "#;
        assert_eq_defs(
            src.as_bytes(),
            "Rust",
            vec![
                ("one", "function"),
                ("two", "variable"),
                ("three", "variable"),
                ("four", "variable"),
                ("five", "variable"),
                ("six", "variable"),
                ("seven", "const"),
                ("eight", "const"),
                ("Nine", "struct"),
                ("ten", "field"),
                ("Eleven", "union"),
                ("Twelve", "enum"),
                ("Thirteen", "enumerator"),
                ("Fourteen", "enumerator"),
            ],
        );
    }

    #[test]
    fn function_params() {
        test_scopes(
            "Rust",
            r#"
            fn foo(t: T, u: U) -> R {}
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        foo {
                            kind: "function",
                            context: "fn §foo§(t: T, u: U) -> R {}",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                t {
                                    kind: "variable",
                                    context: "fn foo(§t§: T, u: U) -> R {}",
                                },
                                u {
                                    kind: "variable",
                                    context: "fn foo(t: T, §u§: U) -> R {}",
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
        );
    }

    #[test]
    fn use_statements() {
        test_scopes(
            "Rust",
            r#"
            mod intelligence;

            use bleep;
            use super::test_utils;
            use intelligence::language as lang;
            use crate::text_range::{TextRange, Point};
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        intelligence {
                            kind: "module",
                            context: "mod §intelligence§;",
                            referenced in (1): [
                                `use §intelligence§::language as lang;`,
                            ],
                        },
                    ],
                    imports: [
                        bleep {
                            context: "use §bleep§;",
                        },
                        test_utils {
                            context: "use super::§test_utils§;",
                        },
                        lang {
                            context: "use intelligence::language as §lang§;",
                        },
                        TextRange {
                            context: "use crate::text_range::{§TextRange§, Point};",
                        },
                        Point {
                            context: "use crate::text_range::{TextRange, §Point§};",
                        },
                    ],
                    child scopes: [],
                }
            "#]],
        )
    }

    #[test]
    fn lifetimes() {
        test_scopes(
            "Rust",
            r#"
            impl<'a, T> Trait for Struct<'a, T> {
                fn foo<'b>(&'a self) -> &'b T { }
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [],
                    child scopes: [
                        scope {
                            definitions: [
                                'a {
                                    kind: "lifetime",
                                    context: "impl<§'a§, T> Trait for Struct<'a, T> {",
                                    referenced in (2): [
                                        `impl<'a, T> Trait for Struct<§'a§, T> {`,
                                        `fn foo<'b>(&§'a§ self) -> &'b T { }`,
                                    ],
                                },
                                T {
                                    kind: "typedef",
                                    context: "impl<'a, §T§> Trait for Struct<'a, T> {",
                                    referenced in (2): [
                                        `impl<'a, T> Trait for Struct<'a, §T§> {`,
                                        `fn foo<'b>(&'a self) -> &'b §T§ { }`,
                                    ],
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        foo {
                                            kind: "function",
                                            context: "fn §foo§<'b>(&'a self) -> &'b T { }",
                                        },
                                    ],
                                    child scopes: [
                                        scope {
                                            definitions: [
                                                'b {
                                                    kind: "lifetime",
                                                    context: "fn foo<§'b§>(&'a self) -> &'b T { }",
                                                    referenced in (1): [
                                                        `fn foo<'b>(&'a self) -> &§'b§ T { }`,
                                                    ],
                                                },
                                                self {
                                                    kind: "variable",
                                                    context: "fn foo<'b>(&'a §self§) -> &'b T { }",
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

    #[test]
    fn generics_and_traits() {
        test_scopes(
            "Rust",
            r#"
            trait Foo {}

            fn foo<'a, 'b, T, U: Foo<T> + 'a>(t: T, u: U) 
              where T: Foo + 'b,
            { }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        Foo {
                            kind: "interface",
                            context: "trait §Foo§ {}",
                            referenced in (2): [
                                `fn foo<'a, 'b, T, U: §Foo§<T> + 'a>(t: T, u: U)`,
                                `where T: §Foo§ + 'b,`,
                            ],
                        },
                        foo {
                            kind: "function",
                            context: "fn §foo§<'a, 'b, T, U: Foo<T> + 'a>(t: T, u: U)",
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
                        scope {
                            definitions: [
                                'a {
                                    kind: "lifetime",
                                    context: "fn foo<§'a§, 'b, T, U: Foo<T> + 'a>(t: T, u: U)",
                                    referenced in (1): [
                                        `fn foo<'a, 'b, T, U: Foo<T> + §'a§>(t: T, u: U)`,
                                    ],
                                },
                                'b {
                                    kind: "lifetime",
                                    context: "fn foo<'a, §'b§, T, U: Foo<T> + 'a>(t: T, u: U)",
                                    referenced in (1): [
                                        `where T: Foo + §'b§,`,
                                    ],
                                },
                                T {
                                    kind: "typedef",
                                    context: "fn foo<'a, 'b, §T§, U: Foo<T> + 'a>(t: T, u: U)",
                                    referenced in (3): [
                                        `fn foo<'a, 'b, T, U: Foo<§T§> + 'a>(t: T, u: U)`,
                                        `fn foo<'a, 'b, T, U: Foo<T> + 'a>(t: §T§, u: U)`,
                                        `where §T§: Foo + 'b,`,
                                    ],
                                },
                                U {
                                    kind: "typedef",
                                    context: "fn foo<'a, 'b, T, §U§: Foo<T> + 'a>(t: T, u: U)",
                                    referenced in (1): [
                                        `fn foo<'a, 'b, T, U: Foo<T> + 'a>(t: T, u: §U§)`,
                                    ],
                                },
                                t {
                                    kind: "variable",
                                    context: "fn foo<'a, 'b, T, U: Foo<T> + 'a>(§t§: T, u: U)",
                                },
                                u {
                                    kind: "variable",
                                    context: "fn foo<'a, 'b, T, U: Foo<T> + 'a>(t: T, §u§: U)",
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
    fn type_constructors() {
        test_scopes(
            "Rust",
            r#"
            struct Highlight {}

            enum Direction { Incoming, Outgoing }

            fn foo() -> Highlight {
                Highlight { }
            }

            fn bar() -> Direction {
                Direction::Incoming
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        Highlight {
                            kind: "struct",
                            context: "struct §Highlight§ {}",
                            referenced in (2): [
                                `fn foo() -> §Highlight§ {`,
                                `§Highlight§ { }`,
                            ],
                        },
                        Direction {
                            kind: "enum",
                            context: "enum §Direction§ { Incoming, Outgoing }",
                            referenced in (2): [
                                `fn bar() -> §Direction§ {`,
                                `§Direction§::Incoming`,
                            ],
                        },
                        foo {
                            kind: "function",
                            context: "fn §foo§() -> Highlight {",
                        },
                        bar {
                            kind: "function",
                            context: "fn §bar§() -> Direction {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [],
                            child scopes: [],
                        },
                        scope {
                            definitions: [
                                Incoming {
                                    kind: "enumerator",
                                    context: "enum Direction { §Incoming§, Outgoing }",
                                },
                                Outgoing {
                                    kind: "enumerator",
                                    context: "enum Direction { Incoming, §Outgoing§ }",
                                },
                            ],
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
    fn macros() {
        test_scopes(
            "Rust",
            r#"
            fn main() {
                let (a, b, c) = ();
                // top-level tokens
                assert_eq!(a, b + c);

                // nested tokens
                println!("{}", if a { b } then { c });
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        main {
                            kind: "function",
                            context: "fn §main§() {",
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
                                            context: "let (§a§, b, c) = ();",
                                            referenced in (2): [
                                                `assert_eq!(§a§, b + c);`,
                                                `println!("{}", if §a§ { b } then { c });`,
                                            ],
                                        },
                                        b {
                                            kind: "variable",
                                            context: "let (a, §b§, c) = ();",
                                            referenced in (2): [
                                                `assert_eq!(a, §b§ + c);`,
                                                `println!("{}", if a { §b§ } then { c });`,
                                            ],
                                        },
                                        c {
                                            kind: "variable",
                                            context: "let (a, b, §c§) = ();",
                                            referenced in (2): [
                                                `assert_eq!(a, b + §c§);`,
                                                `println!("{}", if a { b } then { §c§ });`,
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

    // Self::method and self.method can be raised as references
    #[test]
    fn handle_self_type_and_var() {
        test_scopes(
            "Rust",
            r#"
            struct MyStruct {}

            impl MyStruct {
                fn foo() {
                    Self::foo()
                }

                fn bar(&self) {
                    self.bar()
                }
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        MyStruct {
                            kind: "struct",
                            context: "struct §MyStruct§ {}",
                            referenced in (1): [
                                `impl §MyStruct§ {`,
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
                                    definitions: [
                                        foo {
                                            kind: "function",
                                            context: "fn §foo§() {",
                                            referenced in (1): [
                                                `Self::§foo§()`,
                                            ],
                                        },
                                        bar {
                                            kind: "function",
                                            context: "fn §bar§(&self) {",
                                            referenced in (1): [
                                                `self.§bar§()`,
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
                                        scope {
                                            definitions: [
                                                self {
                                                    kind: "variable",
                                                    context: "fn bar(&§self§) {",
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

    #[test]
    fn let_else_1_65_support() {
        test_scopes(
            "Rust",
            r#"
            fn main() {
                let a = 3;
                if let b = a 
                && let c = b 
                && let d = c {
                    d
                } else {
                    return;
                }
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        main {
                            kind: "function",
                            context: "fn §main§() {",
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
                                            context: "let §a§ = 3;",
                                            referenced in (1): [
                                                `if let b = §a§`,
                                            ],
                                        },
                                    ],
                                    child scopes: [
                                        scope {
                                            definitions: [
                                                b {
                                                    kind: "variable",
                                                    context: "if let §b§ = a",
                                                    referenced in (1): [
                                                        `&& let c = §b§`,
                                                    ],
                                                },
                                                c {
                                                    kind: "variable",
                                                    context: "&& let §c§ = b",
                                                    referenced in (1): [
                                                        `&& let d = §c§ {`,
                                                    ],
                                                },
                                                d {
                                                    kind: "variable",
                                                    context: "&& let §d§ = c {",
                                                    referenced in (1): [
                                                        `§d§`,
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

    #[test]
    fn value_of_function_definition() {
        let src = r#"fn main() {   // 0
                        let a = 2; // 1
                        let b = 2; // 2
                        let c = 2; // 3
                     }             // 4"#;

        let sg = build_graph("Rust", src.as_bytes());
        let main_function = sg.find_node_by_name(src.as_bytes(), b"main").unwrap();
        let function_node = &sg.graph[sg.value_of_definition(main_function).unwrap()];

        assert_eq!(function_node.range().start.line, 0);
        assert_eq!(function_node.range().end.line, 4);
    }

    #[test]
    fn value_of_function_with_generics() {
        let src = r#"fn main<P, Q, R, S, T>(p: P, q: Q) { // 0
                        let a = 2;                        // 1
                        let b = 2;                        // 2
                        let c = 2;                        // 3
                        let d = 2;                        // 4
                     }                                    // 5"#;

        let sg = build_graph("Rust", src.as_bytes());
        let main_function = sg.find_node_by_name(src.as_bytes(), b"main").unwrap();
        let function_node = &sg.graph[sg.value_of_definition(main_function).unwrap()];

        assert_eq!(function_node.range().start.line, 0);
        assert_eq!(function_node.range().end.line, 5);
    }

    #[test]
    fn value_of_struct_definition() {
        let src = r#"struct P { // 0
                        s: Y,   // 1
                        c: H,   // 2
                    }           // 3"#;

        let sg = build_graph("Rust", src.as_bytes());
        let struct_p = sg.find_node_by_name(src.as_bytes(), b"P").unwrap();
        let struct_node = &sg.graph[sg.value_of_definition(struct_p).unwrap()];

        assert_eq!(struct_node.range().start.line, 0);
        assert_eq!(struct_node.range().end.line, 3);
    }

    #[test]
    fn value_of_let_definition() {
        let src = r#"fn main() {
                        let a = 2;
                        let b = 2;
                    }"#;

        let sg = build_graph("Rust", src.as_bytes());
        let let_def_a = sg.find_node_by_name(src.as_bytes(), b"a").unwrap();

        // no range produced for variable definitions
        assert!(sg.value_of_definition(let_def_a).is_none());
    }

    #[test]
    fn value_of_let_def_closures() {
        let src = r#"fn main() {       // 0
                        let a = |x| {  // 1
                            foo_bar(); // 2
                        };             // 3
                    }                  // 4"#;

        let sg = build_graph("Rust", src.as_bytes());
        let let_def_a = sg.find_node_by_name(src.as_bytes(), b"a").unwrap();
        let let_def_node = &sg.graph[sg.value_of_definition(let_def_a).unwrap()];

        assert_eq!(let_def_node.range().start.line, 1);
        assert_eq!(let_def_node.range().end.line, 3);
    }
}
