use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static GO: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["Go"],
    file_extensions: &["go"],
    grammar: tree_sitter_go::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r#"
        [(identifier)
         (type_identifier)
         (package_identifier)
         (field_identifier)] @hoverable
        "#,
    ),
    namespaces: &[
        // variables
        &["const", "var", "func", "module"],
        // types
        &["struct", "interface", "type"],
        // misc.
        &["member"],
        &["label"],
    ],
};

#[cfg(test)]
mod tests {
    use crate::intelligence::language::test_utils::*;

    #[test]
    fn declare_const_no_type() {
        let src = r#"
            const one = 1
            const two, three = 2, 3
            "#;

        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 3);
    }

    #[test]
    fn declare_const_with_type() {
        let src = r#"
            const one uint64 = 1
            const two, three uint64 = 2, 3
            "#;
        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 3);
    }

    #[test]
    fn declare_const_grouped() {
        let src = r#"
            const (
                zero = 0
                one = 1
            )
        "#;
        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 2);
    }

    #[test]
    fn declare_const_implicit_value() {
        let src = r#"
            const (
                zero = iota
                one
            )
        "#;
        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 2);
    }

    #[test]
    fn declare_var_no_type() {
        let src = r#"
            package main

            var zero = 0
            var one, two = 1, 2
            var three, four, five = 3, 4, 5
        "#;
        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 6);
    }

    #[test]
    fn declare_var_with_types() {
        let src = r#"
            package main

            var zero uint64 = 0
            var one, two uint64 = 1, 2
        "#;
        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 3);
    }

    #[test]
    fn declare_var_grouped() {
        let src = r#"
            package main

            var (
                zero = 0
                one = 1
            )
        "#;
        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 2);
    }

    #[test]
    fn declare_short_var() {
        let src = r#"
            func main() {
                x := 2
                res, err := f()
            }
        "#;

        // main, x, res, err
        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 4);
    }

    #[test]
    fn declare_func() {
        let src = r#"
            package main

            func f1() {}
            func f2() int {}
            func f3() (File, Thing) {}
            func f4(result int, err error) {}       // declares result, err
            func f5(x ... uint64, y ... uint64) {}  // declares x, y
        "#;
        let (_, d, _, _) = counts(src, "Go");

        // f1, f2, f3, f4, f5, result, err, x, y
        assert_eq!(d, 9);
    }

    #[test]
    fn declare_type() {
        let src = r#"
            package main

            type a uint64
            type (
                b uint64
                c uint64
            )
            type s struct {}
            type i interface {}
        "#;
        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 5);
    }

    #[test]
    fn declare_type_grouped() {
        let src = r#"
            package main

            type (
                a uint64
                b uint64
            )
        "#;
        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 2);
    }

    #[test]
    fn declare_loop_label() {
        let src = r#"
            func main() {
                loop: for ;; {
                    break loop
                }
            }
        "#;

        // main, loop
        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 2);
    }

    #[test]
    fn declare_func_literal() {
        let src = r#"
            func main() {
                const t := func () {}
            }
        "#;

        // main, t
        let (_, d, _, _) = counts(src, "Go");
        assert_eq!(d, 2);
    }

    #[test]
    fn refer_binary_expr() {
        let src = r#"
            const a = 2
            const b = 2
            const _ = a + b
            const _ = a * b
            const _ = a << b
        "#;

        // 3 refs to a, 3 refs to b
        let (_, _, r, _) = counts(src, "Go");
        assert_eq!(r, 6);
    }

    #[test]
    fn refer_func_call() {
        let src = r#"
            func a() {
                b()
            }
            func b() {
                a()
            }
        "#;

        let (_, _, r, _) = counts(src, "Go");
        assert_eq!(r, 2);
    }

    #[test]
    fn refer_array_index() {
        let src = r#"
            func main() {
                a := [3] int{1, 2, 3}
                a[0] = 3
                a[2] = 1
            }
        "#;

        let (_, _, r, _) = counts(src, "Go");
        assert_eq!(r, 2);
    }

    #[test]
    fn refer_slice_expr() {
        let src = r#"
            func main() {
                a := [3] int{1, 2, 3}
                b := a[0:3]
            }
        "#;

        let (_, _, r, _) = counts(src, "Go");
        assert_eq!(r, 1);
    }

    #[test]
    fn refer_parenthesized_expr() {
        let src = r#"
            func main() {
                a := 2
                (a)
            }
        "#;

        let (_, _, r, _) = counts(src, "Go");
        assert_eq!(r, 1);
    }

    #[test]
    fn refer_selector_expr() {
        let src = r#"
            type person struct {
                name string
                age  int
            }
            func main() {
                p := person{ "bob", 20 };
                p.age = 42
            }
        "#;

        let (_, _, r, _) = counts(src, "Go");

        // p (variable ref), person (type ref)
        assert_eq!(r, 2);
    }

    #[test]
    fn refer_type_assert_expr() {
        let src = r#"
            func main() {
                a := 3
                a.(uint64)
            }
        "#;

        let (_, _, r, _) = counts(src, "Go");
        assert_eq!(r, 1);
    }

    #[test]
    fn refer_unary_expr() {
        let src = r#"
            func main() {
                a := 2
                !a
            }
        "#;

        let (_, _, r, _) = counts(src, "Go");
        assert_eq!(r, 1);
    }

    #[test]
    fn refer_statements() {
        let src = r#"
            func main() {
                a := 3

                a++
                a--
                a = 3

                // control flow
                if a { }
                switch a { }
                defer a 
                go a
                return a

                label:
                continue label
                break label
            }
        "#;

        let (_, _, r, _) = counts(src, "Go");
        assert_eq!(r, 10);
    }

    #[test]
    fn no_ref() {
        let src = r#"
            func f1() {
                a := 3
            }
            func f2() {
                return a
            }
            func f3() {}
        "#;
        let (_, d, r, _) = counts(src, "Go");

        // f1, f1::a, f2, f3
        assert_eq!(d, 4);

        // `a` in f2 found no defs, and is dropped from the graph
        assert_eq!(r, 0);
    }

    #[test]
    fn symbol_consts() {
        let src = r#"
            package main

            const one uint64 = 1
            const (
                two = 2
                three = 2
            )

            func four() {}

            var five = 3

            func six() {
                seven: for ;; {}
            }

            type eight struct {
                nine string
                ten uint64 
            }

            type eleven interface {}
        "#;
        assert_eq_defs(
            src.as_bytes(),
            "Go",
            vec![
                ("one", "const"),
                ("two", "const"),
                ("three", "const"),
                ("four", "func"),
                ("five", "var"),
                ("five", "var"),
                ("six", "func"),
                ("seven", "label"),
                ("eight", "struct"),
                ("nine", "member"),
                ("ten", "member"),
                ("eleven", "interface"),
            ],
        )
    }

    #[test]
    fn scoping_rules() {
        test_scopes(
            "Go",
            r#"
            func main() {
                var args = os.Args;
                var length = len(args);
                fmt.Printf("%d", l);
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        main {
                            kind: "func",
                            context: "func §main§() {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [],
                            child scopes: [
                                scope {
                                    definitions: [
                                        args {
                                            kind: "var",
                                            context: "var §args§ = os.Args;",
                                            referenced in (1): [
                                                `var length = len(§args§);`,
                                            ],
                                        },
                                        length {
                                            kind: "var",
                                            context: "var §length§ = len(args);",
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
    fn function_params() {
        test_scopes(
            "Go",
            r#"
            func main(t string, u string) {
                v := 0
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        main {
                            kind: "func",
                            context: "func §main§(t string, u string) {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                t {
                                    kind: "var",
                                    context: "func main(§t§ string, u string) {",
                                },
                                u {
                                    kind: "var",
                                    context: "func main(t string, §u§ string) {",
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        v {
                                            kind: "var",
                                            context: "§v§ := 0",
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

    // types and variables belong to different namespaces, preventing
    // items in the variable position to resolve to typedefs, and vice-versa
    #[test]
    fn namespacing_of_types_and_variables() {
        test_scopes(
            "Go",
            r#"
            type repoFilters struct {
                topics []string
            }

            func (repoFilters repoFilters) {
                repoFilters + 1
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        repoFilters {
                            kind: "struct",
                            context: "type §repoFilters§ struct {",
                            referenced in (1): [
                                `func (repoFilters §repoFilters§) {`,
                            ],
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [],
                            child scopes: [
                                scope {
                                    definitions: [
                                        topics {
                                            kind: "member",
                                            context: "§topics§ []string",
                                        },
                                    ],
                                    child scopes: [],
                                },
                            ],
                        },
                        scope {
                            definitions: [
                                repoFilters {
                                    kind: "var",
                                    context: "func (§repoFilters§ repoFilters) {",
                                    referenced in (1): [
                                        `§repoFilters§ + 1`,
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

    // modules and variables are in the same namespace, allowing
    // things like module.Type to resolve correctly
    #[test]
    fn namespacing_of_modules_and_variables() {
        test_scopes(
            "Go",
            r#"
            import x "github.com/golang/go/x"

            var t x.Type := 2

            t++
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        t {
                            kind: "var",
                            context: "var §t§ x.Type := 2",
                            referenced in (1): [
                                `§t§++`,
                            ],
                        },
                    ],
                    imports: [
                        x {
                            context: "import §x§ \"github.com/golang/go/x\"",
                            referenced in (1): [
                                `var t §x§.Type := 2`,
                            ],
                        },
                    ],
                    child scopes: [],
                }
            "#]],
        )
    }

    // labels can only be referred to in break and continue statements
    #[test]
    fn namespacing_of_labels() {
        test_scopes(
            "Go",
            r#"
            func main() {
                const OUTER = 2

                OUTER:
                for {
                    continue OUTER
                }
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        main {
                            kind: "func",
                            context: "func §main§() {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [],
                            child scopes: [
                                scope {
                                    definitions: [
                                        OUTER {
                                            kind: "const",
                                            context: "const §OUTER§ = 2",
                                        },
                                        OUTER {
                                            kind: "label",
                                            context: "§OUTER§:",
                                            referenced in (1): [
                                                `continue §OUTER§`,
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
                }
            "#]],
        )
    }

    // bug report: https://www.notion.so/teambloop/Go-Bug-2a82ef59b72548f2ad51bac1ddad62b6
    #[test]
    fn bug_report_type_def_slice_type() {
        test_scopes(
            "Go",
            r#"
            type runeOffsetMap []runeOffsetCorrection

            func makeRuneOffsetMap(off []uint32) runeOffsetMap {

            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        runeOffsetMap {
                            kind: "type",
                            context: "type §runeOffsetMap§ []runeOffsetCorrection",
                            referenced in (1): [
                                `func makeRuneOffsetMap(off []uint32) §runeOffsetMap§ {`,
                            ],
                        },
                        makeRuneOffsetMap {
                            kind: "func",
                            context: "func §makeRuneOffsetMap§(off []uint32) runeOffsetMap {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [],
                            child scopes: [],
                        },
                        scope {
                            definitions: [
                                off {
                                    kind: "var",
                                    context: "func makeRuneOffsetMap(§off§ []uint32) runeOffsetMap {",
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

    // bug report: https://www.notion.so/teambloop/Go-Bug-2a82ef59b72548f2ad51bac1ddad62b6
    #[test]
    fn bug_report_rhs_declaration() {
        test_scopes(
            "Go",
            r#"
            // this used to create 2 definitions: x, y
            x := y
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        x {
                            kind: "var",
                            context: "§x§ := y",
                        },
                    ],
                    child scopes: [],
                }
            "#]],
        )
    }
}
