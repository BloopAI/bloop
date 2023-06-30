use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static RUBY: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["Ruby"],
    file_extensions: &["rb"],
    grammar: tree_sitter_ruby::language,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r#"
        [(identifier)
        (class_variable)
        (instance_variable)
        (constant)
        (global_variable)
        (hash_key_symbol)] @hoverable
        "#,
    ),
    namespaces: &[
        // everything is an object
        &["variable", "constant", "class", "method", "module"],
    ],
};

#[cfg(test)]
mod tests {
    use crate::intelligence::language::test_utils::*;

    // tests the following constructs
    //
    // - variable assignment
    // - if-then
    #[test]
    fn basic_decl() {
        test_scopes(
            "Ruby",
            r#"
            favoriteNumber = 5
            if favoriteNumber == 5
                puts "My favorite number is 5!"
            end
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        favoriteNumber {
                            kind: "variable",
                            context: "§favoriteNumber§ = 5",
                            referenced in (1): [
                                `if §favoriteNumber§ == 5`,
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

    // tests the following constructs:
    //
    // - const decl.
    // - class decl.
    // - instance variable decl.
    // - method decl.
    // - method param decl.
    // - default method params
    #[test]
    fn const_and_class_decl() {
        test_scopes(
            "Ruby",
            r#"
            X, Y = 2, 3
            class Human
                @age, @height = 0, 0
                def age(age=@age)
                    @age
                end
            end
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        X {
                            kind: "constant",
                            context: "§X§, Y = 2, 3",
                        },
                        Y {
                            kind: "constant",
                            context: "X, §Y§ = 2, 3",
                        },
                        Human {
                            kind: "class",
                            context: "class §Human§",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                @age {
                                    kind: "variable",
                                    context: "§@age§, @height = 0, 0",
                                    referenced in (1): [
                                        `§@age§`,
                                    ],
                                },
                                @height {
                                    kind: "variable",
                                    context: "@age, §@height§ = 0, 0",
                                },
                                age {
                                    kind: "method",
                                    context: "def §age§(age=@age)",
                                },
                            ],
                            child scopes: [
                                scope {
                                    definitions: [
                                        age {
                                            kind: "variable",
                                            context: "def age(§age§=@age)",
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

    // tests the following constructs
    //
    // - lambda assignment
    // - lambda param decl.
    // - lambda body
    // - method decl.
    // - method param decl.
    #[test]
    fn methods_and_lambdas() {
        test_scopes(
            "Ruby",
            r#"
            l = -> (x) { x + 1 }
            def update(l, v)
                l.call v
            end
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        l {
                            kind: "variable",
                            context: "§l§ = -> (x) { x + 1 }",
                            referenced in (1): [
                                `§l§.call v`,
                            ],
                        },
                        update {
                            kind: "method",
                            context: "def §update§(l, v)",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                x {
                                    kind: "variable",
                                    context: "l = -> (§x§) { x + 1 }",
                                    referenced in (1): [
                                        `l = -> (x) { §x§ + 1 }`,
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
                                l {
                                    kind: "variable",
                                    context: "def update(§l§, v)",
                                    referenced in (1): [
                                        `§l§.call v`,
                                    ],
                                },
                                v {
                                    kind: "variable",
                                    context: "def update(l, §v§)",
                                    referenced in (1): [
                                        `l.call §v§`,
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

    // tests the following constructs:
    //
    // - until
    // - case-when-else
    // - interpolation
    // - binary ops
    // - operator-assignment
    #[test]
    fn control_flow() {
        test_scopes(
            "Ruby",
            r#"
            counter = 1
            until counter > 10
                case 
                    when (counter % 3 == 0) && (counter % 5 == 0)
                        both_3_and_5 = true
                        puts " #{counter} is divisible by both 3 and 5!"
                    when counter % 3 == 0
                        only_3 = true
                        puts " #{counter} is divisible by 3!"
                    when counter % 5 == 0
                        only_5 = true
                        puts " #{counter} is divisible by 5!"
                    else
                        neither = true
                        puts " #{counter} is not divisible by 3 or 5!"
                end

                counter +=1
            end
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        counter {
                            kind: "variable",
                            context: "§counter§ = 1",
                            referenced in (10): [
                                `until §counter§ > 10`,
                                `when (§counter§ % 3 == 0) && (counter % 5 == 0)`,
                                `when (counter % 3 == 0) && (§counter§ % 5 == 0)`,
                                `puts " #{§counter§} is divisible by both 3 and 5!"`,
                                `when §counter§ % 3 == 0`,
                                `puts " #{§counter§} is divisible by 3!"`,
                                `when §counter§ % 5 == 0`,
                                `puts " #{§counter§} is divisible by 5!"`,
                                `puts " #{§counter§} is not divisible by 3 or 5!"`,
                                `§counter§ +=1`,
                            ],
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
                                            child scopes: [
                                                scope {
                                                    definitions: [
                                                        both_3_and_5 {
                                                            kind: "variable",
                                                            context: "§both_3_and_5§ = true",
                                                        },
                                                    ],
                                                    child scopes: [],
                                                },
                                            ],
                                        },
                                        scope {
                                            definitions: [],
                                            child scopes: [
                                                scope {
                                                    definitions: [
                                                        only_3 {
                                                            kind: "variable",
                                                            context: "§only_3§ = true",
                                                        },
                                                    ],
                                                    child scopes: [],
                                                },
                                            ],
                                        },
                                        scope {
                                            definitions: [],
                                            child scopes: [
                                                scope {
                                                    definitions: [
                                                        only_5 {
                                                            kind: "variable",
                                                            context: "§only_5§ = true",
                                                        },
                                                    ],
                                                    child scopes: [],
                                                },
                                            ],
                                        },
                                        scope {
                                            definitions: [
                                                neither {
                                                    kind: "variable",
                                                    context: "§neither§ = true",
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

    // tests global decls
    #[test]
    fn globals() {
        test_scopes(
            "Ruby",
            r#"
            def foo()
                $var = 2
            end
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        foo {
                            kind: "method",
                            context: "def §foo§()",
                        },
                        $var {
                            kind: "constant",
                            context: "§$var§ = 2",
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
}
