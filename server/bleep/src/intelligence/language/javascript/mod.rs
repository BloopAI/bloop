use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static JAVASCRIPT: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["JavaScript", "JSX"],
    file_extensions: &["js", "jsx"],
    grammar: tree_sitter_javascript::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r#"
        [(identifier)
         (property_identifier)
         (shorthand_property_identifier)
         (shorthand_property_identifier_pattern)
         (private_property_identifier)
         (statement_identifier)] @hoverable
        "#,
    ),
    namespaces: &[&[
        //variables
        "constant",
        "variable",
        "property",
        "function",
        "method",
        "generator",
        // types
        "class",
        // misc.
        "label",
    ]],
};

#[cfg(test)]
mod test {
    use crate::intelligence::language::test_utils::*;

    #[test]
    fn declare_lexical() {
        let src = r#"
            const a = 2;
            var b = 2;
            let c = 2;

            // this is an "assignment", but introduces `d`
            // if if does not exist, and hence counted as a decl.
            d = a;
        "#;

        let (_, def_count, _, _) = counts(src, "JavaScript");

        // a, b, c, d
        assert_eq!(def_count, 4);
    }

    #[test]
    fn declare_functions() {
        let src = r#"
            function one() {}
            {
                two() {},
                get three() {},
                set four() {}
            };

            function* five() {}
        "#;

        let (_, def_count, _, _) = counts(src, "JavaScript");

        assert_eq!(def_count, 5);
    }

    #[test]
    fn declare_destructuring() {
        let src = r#"
            var [a, b] = 5;

            function(c, ...d) {}
            function(e, f = y) {}

            const g = (h) => {}
            const i = (j, k) => {}

            // TODO: object patterns with shorthand patterns are 
            // not handled in every situation right now (only in const/var decls.)
            // function({field: {l, m}}) {}

            function({...n}) {}
        "#;

        let (_, def_count, _, _) = counts(src, "JavaScript");

        assert_eq!(def_count, 12);
    }

    #[test]
    fn declare_class() {
        let src = r#"
            class One {
                #two
                static #three
            }
        "#;

        let (_, def_count, _, _) = counts(src, "JavaScript");

        // class, prop, prop
        assert_eq!(def_count, 3);
    }

    #[test]
    fn declare_imports() {
        let src = r#"
            import defaultOne from "module";
            import { two, three } from "module";
            import { four, member as five } from "module";
        "#;

        let (_, _, _, import_count) = counts(src, "JavaScript");

        assert_eq!(import_count, 5);
    }

    #[test]
    fn declare_misc() {
        let src = r#"
            for (one in items)
                thing();

            for (var two = 0; a <= 0; a++)
                thing();

            three:
                for (;;)
                    break three;
        "#;

        let (_, def_count, _, _) = counts(src, "JavaScript");

        assert_eq!(def_count, 3);
    }

    #[test]
    fn refer_primitive_expressions() {
        let src = r#"
            var a = 2;

            a;
            { "field": a };
            [ a ];
            (a);
            a.length();
        "#;

        let (_, _, ref_count, _) = counts(src, "JavaScript");

        assert_eq!(ref_count, 5);
    }

    #[test]
    fn refer_statements() {
        let src = r#"
            var a = 2;

            return a;
            yield a;
            await a;
        "#;

        let (_, _, ref_count, _) = counts(src, "JavaScript");

        assert_eq!(ref_count, 3);
    }

    #[test]
    fn refer_operators() {
        let src = r#"
            var a = 2;
            var b = 3;
            var c = 4;

            // update expr
            a++;

            // unary
            -a;

            // binary
            a + b;

            // ternary
            c ? a : b;

            // spread
            {a, b, ...c};

            // index
            a[b];

            // member
            // `b` is not a reference here
            a.b
        "#;

        let (_, _, ref_count, _) = counts(src, "JavaScript");

        assert_eq!(ref_count, 13);
    }

    #[test]
    fn refer_exports() {
        let src = r#"
            var a = 2;
            var b = 3;
            var c = 4;

            export { a, b };

            // `alias` is ignored
            export { a as alias, b };
            export default c;
        "#;

        let (_, _, ref_count, _) = counts(src, "JavaScript");

        assert_eq!(ref_count, 5);
    }

    #[test]
    fn refer_misc() {
        let src = r#"
            function foo() {}

            var a = 2;

            for (item in a)  // ref a
                foo(a);      // ref a, foo

            for (var b = 0; b <= 5; b++)  // ref b, b
                foo(a);                   // ref a, foo

        "#;

        let (_, _, ref_count, _) = counts(src, "JavaScript");

        assert_eq!(ref_count, 7);
    }

    #[test]
    fn refer_embedded_jsx() {
        let src = r#"
            const a = 5;
            b = <Foo.Bar>{string(a)}<span>b</span> c</Foo.Bar>;
        "#;

        let (_, _, ref_count, _) = counts(src, "JavaScript");

        assert_eq!(ref_count, 1);
    }

    #[test]
    fn refer_jsx_opening_element() {
        let src = r#"
        import Button from '../../Button';
        import ChevronRightIcon from '../../../icons/ChevronRightIcon';

        const NavBarNoUser = () => {
            return (
                <span className="flex gap-2 justify-self-end">
                    <Button size={'medium'} variant={'tertiary'}>
                    Sign in
                    </Button>
                    <Button size={'medium'} variant={'secondary'}>
                    Sign Up <ChevronRightIcon />
                    </Button>
                </span>
            );
        };
        export default NavBarNoUser;
        "#;

        // Button           x 4,
        // ChevronRightIcon x 1,
        // NavBarNoUser     x 1
        let (_, _, ref_count, _) = counts(src, "JSX");

        assert_eq!(ref_count, 6);
    }

    // https://github.com/BloopAI/bloop/issues/213
    #[test]
    fn function_params() {
        test_scopes(
            "JavaScript",
            r#"
            function main(a, b) { }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        main {
                            kind: "function",
                            context: "function §main§(a, b) { }",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                a {
                                    kind: "variable",
                                    context: "function main(§a§, b) { }",
                                },
                                b {
                                    kind: "variable",
                                    context: "function main(a, §b§) { }",
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
    fn new_expression_regression() {
        test_scopes(
            "JavaScript",
            r#"
            const { Client } = require("@elastic/elasticsearch");
            const elasticClient = new Client({node: ELASTIC_CONNECTION_STRING});
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        elasticClient {
                            kind: "constant",
                            context: "const §elasticClient§ = new Client({node: ELASTIC_CONNECTION_STRING});",
                        },
                    ],
                    imports: [
                        Client {
                            context: "const { §Client§ } = require(\"@elastic/elasticsearch\");",
                            referenced in (1): [
                                `const elasticClient = new §Client§({node: ELASTIC_CONNECTION_STRING});`,
                            ],
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [],
                            child scopes: [],
                        },
                    ],
                }
            "#]],
        )
    }

    #[test]
    fn catch_clause_regression() {
        test_scopes(
            "JavaScript",
            r#"
            try {
                someFn();
            } catch (err) {
                return err;
            } finally {
                return 0;
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [],
                    child scopes: [
                        scope {
                            definitions: [],
                            child scopes: [],
                        },
                        scope {
                            definitions: [
                                err {
                                    kind: "variable",
                                    context: "} catch (§err§) {",
                                    referenced in (1): [
                                        `return §err§;`,
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
                            child scopes: [],
                        },
                    ],
                }
            "#]],
        )
    }
}
