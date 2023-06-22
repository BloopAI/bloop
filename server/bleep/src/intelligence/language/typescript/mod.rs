use crate::intelligence::{MemoizedQuery, TSLanguageConfig};

pub static TYPESCRIPT: TSLanguageConfig = TSLanguageConfig {
    language_ids: &["TypeScript", "TSX"],
    file_extensions: &["ts", "tsx"],
    grammar: tree_sitter_typescript::language_tsx,
    scope_query: MemoizedQuery::new(include_str!("./scopes.scm")),
    hoverable_query: MemoizedQuery::new(
        r#"
        [(identifier)
         (property_identifier)
         (shorthand_property_identifier)
         (shorthand_property_identifier_pattern)
         (statement_identifier)
         (type_identifier)] @hoverable
        "#,
    ),
    namespaces: &[&[
        //variables
        "constant",
        "variable",
        "property",
        "parameter",
        // functions
        "function",
        "method",
        "generator",
        // types
        "alias",
        "enum",
        "enumerator",
        "class",
        "interface",
        // misc.
        "label",
    ]],
};

#[cfg(test)]
mod test {
    use crate::intelligence::language::test_utils::*;

    // tests the following constructs:
    // - imports (inherited from js)
    // - type aliases
    // - type constructs (union types, nested types, function types)
    // - generics
    // - object property (should create an empty scope)
    #[test]
    fn simple() {
        test_scopes(
            "TypeScript",
            r#"
            import React, { createContext } from 'react';
            import { ExtendedItemType, ItemType } 
                from '../components/ContextMenu/ContextMenuItem/Item';

            type SearchHistoryType = {
                text: string;
                type: ItemType | ExtendedItemType;
                icon?: React.ReactElement;
            };

            type ContextType = {
                inputValue: string;
                setInputValue: (v: string) => void;
                searchHistory: SearchHistoryType[];
                setSearchHistory: (s: SearchHistoryType[]) => void;
            };

            export const SearchContext = createContext<ContextType>({
                inputValue: '',
                setInputValue: (value) => {},
                searchHistory: [],
                setSearchHistory: (newHistory) => {},
            });
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        SearchHistoryType {
                            kind: "alias",
                            context: "type §SearchHistoryType§ = {",
                            referenced in (2): [
                                `searchHistory: §SearchHistoryType§[];`,
                                `setSearchHistory: (s: §SearchHistoryType§[]) => void;`,
                            ],
                        },
                        ContextType {
                            kind: "alias",
                            context: "type §ContextType§ = {",
                            referenced in (1): [
                                `export const SearchContext = createContext<§ContextType§>({`,
                            ],
                        },
                        SearchContext {
                            kind: "constant",
                            context: "export const §SearchContext§ = createContext<ContextType>({",
                        },
                    ],
                    imports: [
                        React {
                            context: "import §React§, { createContext } from 'react';",
                            referenced in (1): [
                                `icon?: §React§.ReactElement;`,
                            ],
                        },
                        createContext {
                            context: "import React, { §createContext§ } from 'react';",
                            referenced in (1): [
                                `export const SearchContext = §createContext§<ContextType>({`,
                            ],
                        },
                        ExtendedItemType {
                            context: "import { §ExtendedItemType§, ItemType }",
                            referenced in (1): [
                                `type: ItemType | §ExtendedItemType§;`,
                            ],
                        },
                        ItemType {
                            context: "import { ExtendedItemType, §ItemType§ }",
                            referenced in (1): [
                                `type: §ItemType§ | ExtendedItemType;`,
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
                                v {
                                    kind: "parameter",
                                    context: "setInputValue: (§v§: string) => void;",
                                },
                            ],
                            child scopes: [],
                        },
                        scope {
                            definitions: [],
                            child scopes: [],
                        },
                        scope {
                            definitions: [
                                s {
                                    kind: "parameter",
                                    context: "setSearchHistory: (§s§: SearchHistoryType[]) => void;",
                                },
                            ],
                            child scopes: [],
                        },
                        scope {
                            definitions: [],
                            child scopes: [
                                scope {
                                    definitions: [
                                        value {
                                            kind: "parameter",
                                            context: "setInputValue: (§value§) => {},",
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
                                        newHistory {
                                            kind: "parameter",
                                            context: "setSearchHistory: (§newHistory§) => {},",
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
    fn tsx() {
        test_scopes(
            "TSX",
            br#"
            import React from 'react';
            import ReactDOM from 'react-dom/client';
            import App from './App';
            import './index.css';

            ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
                <React.StrictMode>
                <App />
                </React.StrictMode>,
            );
            "#,
            expect![[r#"
                scope {
                    definitions: [],
                    imports: [
                        React {
                            context: "import §React§ from 'react';",
                            referenced in (2): [
                                `<§React§.StrictMode>`,
                                `</§React§.StrictMode>,`,
                            ],
                        },
                        ReactDOM {
                            context: "import §ReactDOM§ from 'react-dom/client';",
                            referenced in (1): [
                                `§ReactDOM§.createRoot(document.getElementById('root') as HTMLElement).render(`,
                            ],
                        },
                        App {
                            context: "import §App§ from './App';",
                            referenced in (1): [
                                `<§App§ />`,
                            ],
                        },
                    ],
                    child scopes: [],
                }
            "#]],
        )
    }

    // https://github.com/BloopAI/bloop/issues/213
    //
    // type parameters and function parameters should belong to a scope
    // that is smaller that the function definition itself.
    #[test]
    fn function_and_type_params() {
        test_scopes(
            "TypeScript",
            r#"
            function foo<T, U>(t: T, u: U) {}
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        foo {
                            kind: "function",
                            context: "function §foo§<T, U>(t: T, u: U) {}",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                T {
                                    kind: "none",
                                    context: "function foo<§T§, U>(t: T, u: U) {}",
                                    referenced in (1): [
                                        `function foo<T, U>(t: §T§, u: U) {}`,
                                    ],
                                },
                                U {
                                    kind: "none",
                                    context: "function foo<T, §U§>(t: T, u: U) {}",
                                    referenced in (1): [
                                        `function foo<T, U>(t: T, u: §U§) {}`,
                                    ],
                                },
                                t {
                                    kind: "parameter",
                                    context: "function foo<T, U>(§t§: T, u: U) {}",
                                },
                                u {
                                    kind: "parameter",
                                    context: "function foo<T, U>(t: T, §u§: U) {}",
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
    fn optional_param_regression() {
        test_scopes(
            "TypeScript",
            r#"
            function foo(a?: string, b: string) {
                return (a, b)
            }
            "#
            .as_bytes(),
            expect![[r#"
                scope {
                    definitions: [
                        foo {
                            kind: "function",
                            context: "function §foo§(a?: string, b: string) {",
                        },
                    ],
                    child scopes: [
                        scope {
                            definitions: [
                                a {
                                    kind: "parameter",
                                    context: "function foo(§a§?: string, b: string) {",
                                    referenced in (1): [
                                        `return (§a§, b)`,
                                    ],
                                },
                                b {
                                    kind: "parameter",
                                    context: "function foo(a?: string, §b§: string) {",
                                    referenced in (1): [
                                        `return (a, §b§)`,
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
                        },
                    ],
                }
            "#]],
        );
    }
}
