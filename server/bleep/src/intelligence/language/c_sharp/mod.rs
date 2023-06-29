use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static C_SHARP: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["C#"],
    file_extensions: &["cs"],
    grammar: tree_sitter_c_sharp::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r#"
        (identifier) @hoverable
        "#,
    ),
    namespaces: &[&[
        // variables, functions
        "local",
        // types
        "class",
        "struct",
        "enum",
        "typedef",
        "interface",
        "enumerator",
        // methods
        "method",
        // namespaces
        "namespace",
    ]],
};

#[cfg(test)]
mod tests {
    use crate::intelligence::language::test_utils::*;

    // tests the following constructs:
    //
    // - class declarations
    #[test]
    fn trivial() {
        test_scopes(
            "C#",
            r#"
            using System;
            namespace HelloWorldApp {
                class HelloWorld {
                    static void Main(string[] args) {
                        Console.WriteLine("Hello World!");
                    }
                }
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        HelloWorldApp {
                            kind: "namespace",
                            context: "namespace §HelloWorldApp§ {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                HelloWorld {
                                    kind: "class",
                                    context: "class §HelloWorld§ {",
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        Main {
                                            kind: "method",
                                            context: "static void §Main§(string[] args) {",
                                        },
                                    ],
                                    child scopes: [
                                        scope {
                                            definitions: [
                                                args {
                                                    kind: "local",
                                                    context: "static void Main(string[] §args§) {",
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
    fn generics_and_type_constraints() {
        test_scopes(
            "C#",
            r#"
            namespace N {
                public interface I1 {
                    public void F1() {}
                    public void F2() {}
                }

                public class C1<T, U> where T: I1 where U: struct {
                    public string Prop1;

                    public void M1(T t, U u) {
                        this.Prop1 = t;
                    }
                }
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        N {
                            kind: "namespace",
                            context: "namespace §N§ {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                I1 {
                                    kind: "interface",
                                    context: "public interface §I1§ {",
                                    referenced in (1): [
                                        `public class C1<T, U> where T: §I1§ where U: struct {`,
                                    ],
                                },
                                C1 {
                                    kind: "class",
                                    context: "public class §C1§<T, U> where T: I1 where U: struct {",
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        F1 {
                                            kind: "method",
                                            context: "public void §F1§() {}",
                                        },
                                        F2 {
                                            kind: "method",
                                            context: "public void §F2§() {}",
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
                                    definitions: [
                                        T {
                                            kind: "typedef",
                                            context: "public class C1<§T§, U> where T: I1 where U: struct {",
                                            referenced in (2): [
                                                `public class C1<T, U> where §T§: I1 where U: struct {`,
                                                `public void M1(§T§ t, U u) {`,
                                            ],
                                        },
                                        U {
                                            kind: "typedef",
                                            context: "public class C1<T, §U§> where T: I1 where U: struct {",
                                            referenced in (2): [
                                                `public class C1<T, U> where T: I1 where §U§: struct {`,
                                                `public void M1(T t, §U§ u) {`,
                                            ],
                                        },
                                        Prop1 {
                                            kind: "local",
                                            context: "public string §Prop1§;",
                                            referenced in (1): [
                                                `this.§Prop1§ = t;`,
                                            ],
                                        },
                                        M1 {
                                            kind: "method",
                                            context: "public void §M1§(T t, U u) {",
                                        },
                                    ],
                                    child scopes: [
                                        scope {
                                            definitions: [
                                                t {
                                                    kind: "local",
                                                    context: "public void M1(T §t§, U u) {",
                                                    referenced in (1): [
                                                        `this.Prop1 = §t§;`,
                                                    ],
                                                },
                                                u {
                                                    kind: "local",
                                                    context: "public void M1(T t, U §u§) {",
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
}
