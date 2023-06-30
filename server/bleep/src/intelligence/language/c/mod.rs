use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static C: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["C"],
    file_extensions: &["c", "h"],
    grammar: tree_sitter_c::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r"
        [(identifier)
        (field_identifier)
        (statement_identifier)
        (type_identifier)] @hoverable
        ",
    ),
    namespaces: &[&[
        // imports
        "header",
        // functions
        "macro",
        "function",
        // types
        "struct",
        "enum",
        "enumerator",
        "union",
        "typedef",
        // variables
        "variable",
        // misc.
        "label",
    ]],
};

#[cfg(test)]
mod tests {
    use crate::intelligence::language::test_utils::*;

    #[test]
    fn trivial() {
        test_scopes(
            "C",
            r#"
            #include <stdio.h>

            #define PI 355/113
            #define AREA(r) PI * r * r

            int main() {
                int radius = 5;
                printf("%d", AREA(radius));
            }
            "#
            .as_bytes(),
            expect![[r##"
                scope {
                    definitions: [
                        <stdio.h> {
                            kind: "header",
                            context: "#include §<stdio.h>§",
                        },
                        PI {
                            kind: "macro",
                            context: "#define §PI§ 355/113",
                        },
                        AREA {
                            kind: "macro",
                            context: "#define §AREA§(r) PI * r * r",
                            referenced in (1): [
                                `printf("%d", §AREA§(radius));`,
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
                            child scopes: [
                                scope {
                                    definitions: [
                                        radius {
                                            kind: "variable",
                                            context: "int §radius§ = 5;",
                                            referenced in (1): [
                                                `printf("%d", AREA(§radius§));`,
                                            ],
                                        },
                                    ],
                                    child scopes: [],
                                },
                            ],
                        },
                    ],
                }
            "##]],
        )
    }

    #[test]
    fn declarations() {
        test_scopes(
            "C",
            r#"
            int main() {
                int a;
                int *b;
                struct S c;
                struct S *d;
                T1 *e(T2);
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
                                        },
                                        b {
                                            kind: "variable",
                                            context: "int *§b§;",
                                        },
                                        c {
                                            kind: "variable",
                                            context: "struct S §c§;",
                                        },
                                        d {
                                            kind: "variable",
                                            context: "struct S *§d§;",
                                        },
                                        e {
                                            kind: "function",
                                            context: "T1 *§e§(T2);",
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

    #[test]
    fn types() {
        test_scopes(
            "C",
            r#"

            // defs
            struct A {
                int e;
            };

            enum B {
                C, D, E
            };

            union F {
                int x;
                char *y;
            };

            typedef struct {
                int x;
            } G;

            // refs
            struct A *main(enum B b, void* g) {
                union F *f = foo((struct G*) g);
                switch (b) {
                    case C:
                    case D:
                    case E:
                }
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        A {
                            kind: "struct",
                            context: "struct §A§ {",
                            referenced in (1): [
                                `struct §A§ *main(enum B b, void* g) {`,
                            ],
                        },
                        B {
                            kind: "enum",
                            context: "enum §B§ {",
                            referenced in (1): [
                                `struct A *main(enum §B§ b, void* g) {`,
                            ],
                        },
                        C {
                            kind: "enumerator",
                            context: "§C§, D, E",
                            referenced in (1): [
                                `case §C§:`,
                            ],
                        },
                        D {
                            kind: "enumerator",
                            context: "C, §D§, E",
                            referenced in (1): [
                                `case §D§:`,
                            ],
                        },
                        E {
                            kind: "enumerator",
                            context: "C, D, §E§",
                            referenced in (1): [
                                `case §E§:`,
                            ],
                        },
                        F {
                            kind: "union",
                            context: "union §F§ {",
                            referenced in (1): [
                                `union §F§ *f = foo((struct G*) g);`,
                            ],
                        },
                        G {
                            kind: "typedef",
                            context: "} §G§;",
                            referenced in (1): [
                                `union F *f = foo((struct §G§*) g);`,
                            ],
                        },
                        main {
                            kind: "function",
                            context: "struct A *§main§(enum B b, void* g) {",
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
                            definitions: [
                                b {
                                    kind: "variable",
                                    context: "struct A *main(enum B §b§, void* g) {",
                                    referenced in (1): [
                                        `switch (§b§) {`,
                                    ],
                                },
                                g {
                                    kind: "variable",
                                    context: "struct A *main(enum B b, void* §g§) {",
                                    referenced in (1): [
                                        `union F *f = foo((struct G*) §g§);`,
                                    ],
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        f {
                                            kind: "variable",
                                            context: "union F *§f§ = foo((struct G*) g);",
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
    fn function_parameters() {
        test_scopes(
            "C",
            r#"
            void main(int argc, char **argv) {}
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        main {
                            kind: "function",
                            context: "void §main§(int argc, char **argv) {}",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                argc {
                                    kind: "variable",
                                    context: "void main(int §argc§, char **argv) {}",
                                },
                                argv {
                                    kind: "variable",
                                    context: "void main(int argc, char **§argv§) {}",
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

    // const sizes in array declarations should be refs
    #[test]
    fn const_dimension_array_declaration_regression() {
        test_scopes(
            "C",
            r#"
            #define CLUSTER_SLOTS 16384

            typedef struct clusterState {
                clusterNode *migrating_slots_to[CLUSTER_SLOTS];
            } clusterState;
            "#
            .as_bytes(),
            expect![[r##"
                scope {
                    definitions: [
                        CLUSTER_SLOTS {
                            kind: "macro",
                            context: "#define §CLUSTER_SLOTS§ 16384",
                            referenced in (1): [
                                `clusterNode *migrating_slots_to[§CLUSTER_SLOTS§];`,
                            ],
                        },
                        clusterState {
                            kind: "struct",
                            context: "typedef struct §clusterState§ {",
                        },
                        clusterState {
                            kind: "typedef",
                            context: "} §clusterState§;",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                migrating_slots_to {
                                    kind: "variable",
                                    context: "clusterNode *§migrating_slots_to§[CLUSTER_SLOTS];",
                                },
                            ],
                            child scopes: [],
                        },
                    ],
                }
            "##]],
        )
    }

    // handle params correctly
    #[test]
    fn unresolved_function_parameters() {
        test_scopes(
            "C",
            r#"
            sds getNewBaseFileNameAndMarkPreAsHistory(aofManifest *am) {
                serverAssert(am != NULL);
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        getNewBaseFileNameAndMarkPreAsHistory {
                            kind: "function",
                            context: "sds §getNewBaseFileNameAndMarkPreAsHistory§(aofManifest *am) {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                am {
                                    kind: "variable",
                                    context: "sds getNewBaseFileNameAndMarkPreAsHistory(aofManifest *§am§) {",
                                    referenced in (1): [
                                        `serverAssert(§am§ != NULL);`,
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

    // rhs of declarators should be references and not defs
    #[test]
    fn declarator_rhs_is_reference() {
        test_scopes(
            "C",
            r#"
            void main(const char *pe) {
                const char *end = pe + ind;
                const char *curr = pe;
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        main {
                            kind: "function",
                            context: "void §main§(const char *pe) {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                pe {
                                    kind: "variable",
                                    context: "void main(const char *§pe§) {",
                                    referenced in (2): [
                                        `const char *end = §pe§ + ind;`,
                                        `const char *curr = §pe§;`,
                                    ],
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        end {
                                            kind: "variable",
                                            context: "const char *§end§ = pe + ind;",
                                        },
                                        curr {
                                            kind: "variable",
                                            context: "const char *§curr§ = pe;",
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
    fn function_prototype_vs_function_definition() {
        test_scopes(
            "C",
            r#"
            void *foo(int *am, int ip);
            void *foo(int *am, int ip) {
                *am + ip;
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        foo {
                            kind: "function",
                            context: "void *§foo§(int *am, int ip);",
                        },
                        foo {
                            kind: "function",
                            context: "void *§foo§(int *am, int ip) {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                am {
                                    kind: "variable",
                                    context: "void *foo(int *§am§, int ip);",
                                },
                                ip {
                                    kind: "variable",
                                    context: "void *foo(int *am, int §ip§);",
                                },
                            ],
                            child scopes: [],
                        },
                        scope {
                            definitions: [
                                am {
                                    kind: "variable",
                                    context: "void *foo(int *§am§, int ip) {",
                                    referenced in (1): [
                                        `*§am§ + ip;`,
                                    ],
                                },
                                ip {
                                    kind: "variable",
                                    context: "void *foo(int *am, int §ip§) {",
                                    referenced in (1): [
                                        `*am + §ip§;`,
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
    fn type_refs_in_field_declarations() {
        test_scopes(
            "C",
            r#"
            typedef enum {
                CONN_STATE_NONE = 0,
            } ConnectionState;

            struct connection {
                ConnectionState state;
            };
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        CONN_STATE_NONE {
                            kind: "enumerator",
                            context: "§CONN_STATE_NONE§ = 0,",
                        },
                        ConnectionState {
                            kind: "typedef",
                            context: "} §ConnectionState§;",
                            referenced in (1): [
                                `§ConnectionState§ state;`,
                            ],
                        },
                        connection {
                            kind: "struct",
                            context: "struct §connection§ {",
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
    fn bug_report_ternary_expression() {
        test_scopes(
            "C",
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
