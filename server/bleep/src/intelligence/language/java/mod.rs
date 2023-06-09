use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static JAVA: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["Java"],
    file_extensions: &["java"],
    grammar: tree_sitter_java::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r#"
        [(identifier)
         (type_identifier)] @hoverable
        "#,
    ),
    namespaces: &[&[
        // variables
        "local",
        // functions
        "method",
        // namespacing, modules
        "package",
        "module",
        // types
        "class",
        "enum",
        "enumConstant",
        "record",
        "interface",
        "typedef",
        // misc.
        "label",
    ]],
};

#[cfg(test)]
mod tests {
    use crate::intelligence::language::test_utils::*;

    // tests the following constructs:
    //
    // - class declarations
    // - method declarations
    // - formal parameters
    // - method invocations
    // - array access
    #[test]
    fn trivial() {
        test_scopes(
            "Java",
            r#"
            class HelloWorld {
                public static void main(string[] args) {
                    System.Out.Println("Hello " + args[0]);
                }
            }
            "#
            .as_bytes(),
            expect![[r#"
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
                                main {
                                    kind: "method",
                                    context: "public static void §main§(string[] args) {",
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        args {
                                            kind: "local",
                                            context: "public static void main(string[] §args§) {",
                                            referenced in (1): [
                                                `System.Out.Println("Hello " + §args§[0]);`,
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

    // tests the following constructs:
    //
    // - class declarations
    // - interface declarations
    // - super classes
    // - interfaces implementations
    // - generics
    #[test]
    fn classes_interfaces_generics() {
        test_scopes(
            "Java",
            r#"
            public class C1 {}
            public class C2 {}

            public interface I1 {}
            public interface I2 {}

            public class C3<T extends C1> extends C2 implements I1, I2 {
                private T element;
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        C1 {
                            kind: "class",
                            context: "public class §C1§ {}",
                            referenced in (1): [
                                `public class C3<T extends §C1§> extends C2 implements I1, I2 {`,
                            ],
                        },
                        C2 {
                            kind: "class",
                            context: "public class §C2§ {}",
                            referenced in (1): [
                                `public class C3<T extends C1> extends §C2§ implements I1, I2 {`,
                            ],
                        },
                        I1 {
                            kind: "interface",
                            context: "public interface §I1§ {}",
                            referenced in (1): [
                                `public class C3<T extends C1> extends C2 implements §I1§, I2 {`,
                            ],
                        },
                        I2 {
                            kind: "interface",
                            context: "public interface §I2§ {}",
                            referenced in (1): [
                                `public class C3<T extends C1> extends C2 implements I1, §I2§ {`,
                            ],
                        },
                        C3 {
                            kind: "class",
                            context: "public class §C3§<T extends C1> extends C2 implements I1, I2 {",
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
                        scope {
                            definitions: [],
                            child scopes: [],
                        },
                        scope {
                            definitions: [
                                T {
                                    kind: "typedef",
                                    context: "public class C3<§T§ extends C1> extends C2 implements I1, I2 {",
                                    referenced in (1): [
                                        `private §T§ element;`,
                                    ],
                                },
                                element {
                                    kind: "local",
                                    context: "private T §element§;",
                                },
                            ],
                            child scopes: [],
                        },
                    ],
                }
            "#]],
        )
    }

    // `this` is specially handled:
    //
    // - `this.member` raises `member` as a reference
    // - `this.method()` raises `method` as a reference
    #[test]
    fn this_keyword() {
        test_scopes(
            "Java",
            r#"
            public class Adder {
                private int a;
                private int b;

                Adder(int first, int second) {
                    this.a = first;
                    this.b = second;
                }

                private int add_helper() {
                    return this.a + this.b;
                }

                public int add() {
                    return this.add_helper();
                }
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        Adder {
                            kind: "class",
                            context: "public class §Adder§ {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                a {
                                    kind: "local",
                                    context: "private int §a§;",
                                    referenced in (2): [
                                        `this.§a§ = first;`,
                                        `return this.§a§ + this.b;`,
                                    ],
                                },
                                b {
                                    kind: "local",
                                    context: "private int §b§;",
                                    referenced in (2): [
                                        `this.§b§ = second;`,
                                        `return this.a + this.§b§;`,
                                    ],
                                },
                                Adder {
                                    kind: "method",
                                    context: "§Adder§(int first, int second) {",
                                },
                                add_helper {
                                    kind: "method",
                                    context: "private int §add_helper§() {",
                                    referenced in (1): [
                                        `return this.§add_helper§();`,
                                    ],
                                },
                                add {
                                    kind: "method",
                                    context: "public int §add§() {",
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        first {
                                            kind: "local",
                                            context: "Adder(int §first§, int second) {",
                                            referenced in (1): [
                                                `this.a = §first§;`,
                                            ],
                                        },
                                        second {
                                            kind: "local",
                                            context: "Adder(int first, int §second§) {",
                                            referenced in (1): [
                                                `this.b = §second§;`,
                                            ],
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
                        },
                    ],
                }
            "#]],
        )
    }
}
