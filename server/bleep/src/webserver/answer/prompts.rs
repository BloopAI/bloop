pub fn functions() -> serde_json::Value {
    serde_json::json!(
        [
            {
                "name": "code",
                "description":  "Search the contents of files in a codebase semantically. Results will not necessarily match search terms exactly, but should be related.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The query with which to search. This should consist of keywords that might match something in the codebase, e.g. 'react functional components', 'contextmanager', 'bearer token'"
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "path",
                "description": "Search the pathnames in a codebase. Results may not be exact matches, but will be similar by some edit-distance. Use when you want to find a specific file or directory.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The query with which to search. This should consist of keywords that might match a path, e.g. 'server/src'."
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "proc",
                "description": "Read one or more files and extract the line ranges which are relevant to the search terms. Do not proc more than 10 files at a time.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The query with which to search the files."
                        },
                        "paths": {
                            "type": "array",
                            "items": {
                                "type": "integer",
                                "description": "The indices of the paths to search. paths.len() <= 10"
                            }
                        }
                    },
                    "required": ["query", "paths"]
                }
            },
            {
                "name": "none",
                "description": "You have enough information to answer the user's query. This is the final step, and signals that you have enough information to respond to the user's query. Use this if the user has instructed you to modify some code.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "mode": {
                            "type": "string",
                            "enum": ["article", "filesystem"],
                            "description": "The type of answer to provide. If the user's query is best answered with the location of one or multiple files and folders with no explanation choose filesystem. If the user's query is best answered with any explanation, or they're instructing you to write new code choose article. If the user's query is neither, choose filesystem."
                        },
                        "paths": {
                            "type": "array",
                            "items": {
                                "type": "integer",
                                "description": "The indices of the paths to answer with respect to. Can be empty if the answer is not related to a specific path."
                            }
                        }
                    },
                    "required": ["mode", "paths"]
                }
            },
        ]
    )
}

pub fn restricted_functions() -> serde_json::Value {
    serde_json::json!(
        [
            {
                "name": "code",
                "description":  "Search the contents of files in a codebase semantically. Results will not necessarily match search terms exactly, but should be related.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The query with which to search. This should consist of keywords that might match something in the codebase, e.g. 'react functional components', 'contextmanager', 'bearer token'"
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "path",
                "description": "Search the pathnames in a codebase. Results may not be exact matches, but will be similar by some edit-distance. Use when you want to find a specific file or directory.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The query with which to search. This should consist of keywords that might match a path, e.g. 'server/src'."
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "none",
                "description": "You have enough information to answer the user's query. This is the final step, and signals that you have enough information to respond to the user's query. Use this if the user has instructed you to modify some code.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "mode": {
                            "type": "string",
                            "enum": ["article", "filesystem"],
                            "description": "The type of answer to provide. If the user's query is best answered with the location of one or multiple files and folders with no explanation choose filesystem. If the user's query is best answered with any explanation, or they're instructing you to write new code choose article. If the user's query is neither, choose filesystem."
                        },
                        "paths": {
                            "type": "array",
                            "items": {
                                "type": "integer",
                                "description": "The indices of the paths to answer with respect to. Can be empty if the answer is not related to a specific path."
                            }
                        }
                    },
                    "required": ["mode", "paths"]
                }
            },
        ]
    )
}

pub fn system(paths: &Vec<String>) -> String {
    let mut s = "".to_string();

    if !paths.is_empty() {
        s.push_str("## PATHS ##\nalias, path\n");
        for (i, path) in paths.iter().enumerate() {
            s.push_str(&format!("{}, {}\n", i, path));
        }
    }

    s.push_str(
        r#"Follow these rules at all times:

- If the output of a function is empty, try the same function again with different arguments or try using a different function
- When calling functions.code or functions.path, your query should consist of keywords. E.g. if the user says 'What does contextmanager do?', your query should be 'contextmanager'. If the user says 'How is contextmanager used in app', your query should be 'contextmanager app'. If the user says 'What is in the src directory', your query should be 'src'
- In most cases respond with functions.code or functions.path functions before responding with functions.none
- If the user is referring to information that is already in your history, respond with functions.none
- Do not assume the structure of the codebase, or the existence of files or folders
- Do NOT respond with a function that you've used before with the same arguments
- When you have enough information to answer the user's query respond with functions.none
- Only refer to path aliases that are under the PATHS heading above
- Respond with functions to find information related to the query, until all relevant information has been found
- Only call functions.none with paths that contain code that might help answer the user's query, or which answer it directly
- If you have already called functions.code or functions.path but they did not return any relevant information, try again with a substantively different query. The terms in your new query should not overlap with terms in previous queries
- Use functions.proc on paths that you suspect might contain relevant information, or to expand on code that's already been returned by a code search. Do not pass more than 10 paths to functions.proc at a time
- If after attempting to gather information you are still unsure how to answer the query, respond with the functions.none function
- If the query is a greeting, or not a question or an instruction use functions.none
- Always use a function, even if the query is not in English
- Always respond with a function call. Do NOT answer the question directly"#);
    s
}

pub fn file_explanation(question: &str, path: &str, code: &str) -> String {
    format!(
        r#"Below are some lines from the file /{path}. Each line is numbered.

#####

{code}

#####

Your job is to perform the following tasks:
1. Find all the relevant line ranges of code.
2. DO NOT cite line ranges that you are not given above
3. You MUST answer with only line ranges. DO NOT answer the question

Q: find Kafka auth keys
A: [[12,15]]

Q: find where we submit payment requests
A: [[37,50]]

Q: auth code expiration
A: [[486,501],[520,560],[590,631]]

Q: library matrix multiplication
A: [[68,74],[82,85],[103,107],[187,193]]

Q: how combine result streams
A: []

Q: {question}
A: "#
    )
}

pub fn answer_filesystem_prompt(context: &str) -> String {
    struct Rule<'a> {
        title: &'a str,
        description: &'a str,
        note: &'a str,
        schema: &'a str,
        example: Option<&'a str>,
    }

    let rules = [
        Rule {
            title: "Cite a line range from a file",
            description: "COMMENT should refer to the code in in the START LINE and END LINE range. The COMMENT should answer the query with respect to the given line range. It should NOT include information that is not in the code. If the code does not help answer the query, then do not include it in a citation.",
            schema: "[\"cite\",PATH ALIAS:INT,COMMENT:STRING,START LINE:INT,END LINE:INT]",
            note: "This object can occur multiple times",
            example: None,
        },
        Rule {
            title: "Cite a single directory from the codebase",
            description: "When you wish to cite every file in a directory, use this to directly cite the directory instead. The COMMENT should answer the query with respect to the given directory.",
            schema: "[\"dir\",PATH:STRING,COMMENT:STRING]",
            note: "This object can occur multiple times",
            example: Some(r#"The path is a relative path, with no leading slash. You must generate a trailing slash, for example: server/bleep/src/webserver/. On Windows, generate backslash separated components, for example: server\bleep\src\webserver\"#),
        },
        Rule {
            title: "Cite line ranges from the file",
            description: "START LINE and END LINE should focus on the code mentioned in the COMMENT. COMMENT should be a detailed explanation.",
            schema: "[\"cite\",PATH ALIAS:INT,COMMENT:STRING,START LINE:INT,END LINE:INT]",
            note: "This object can occur multiple times",
            example: None,
        },
        Rule {
            title: "Update the code in an existing file",
            description: "Edit an existing code file by generating the diff between old and new versions. Changes should be as small as possible.",
            schema: "[\"mod\",PATH ALIAS:INT,LANGUAGE:STRING,GIT DIFF:STRING]",
            note: "This object can occur multiple times",
            example: Some(r#"Where GIT DIFF describes the diff chunks for the file, including the git diff header.
For example:
@@ -1 +1 @@
-this is a git diff test example
+this is a diff example"#),
        },
        Rule {
            title: "Conclusion",
            description: "Summarise your previous steps. Provide as much information as is necessary to answer the query. If you do not have enough information needed to answer the query, do not make up an answer.",
            schema: "[\"con\",SUMMARY:STRING]",
            note: "This is mandatory and must appear once at the end",
            example: None,
        },
    ];

    let output_rules_str = rules
        .into_iter()
        .zip(1..)
        .map(|(r, i)| {
            let Rule {
                title,
                description,
                schema,
                note,
                example,
                ..
            } = r;
            format!(
                "{i}. {title}\n{description}\n{schema}\n{note}\n{}\n",
                example.unwrap_or("")
            )
        })
        .collect::<String>();

    format!(
        r#"{context}Your job is to answer a query about a codebase using the information above. 
Your answer should be an array of arrays, where each element in the array is an instance of one of the following objects:

{output_rules_str}
Respect these rules at all times:
- Do not refer to paths by alias, quote the full path surrounded by single backticks. E.g. `server/bleep/src/webserver/`
- Refer to directories by their full paths, surrounded by single backticks
- If the query is a greeting, or not a question or an instruction just generate a conclusion
- Your answer should always be an array of arrays, even when you only generate a conclusion

#####

Examples:

Show all the analytics events

[
  ["cite", 27, "Track 'Search' event in `useAnalytics.ts`", 7, 12],
  ["con", "I've found three analytics events"]
]

Where is the webserver code located

[
  ["dir","server/bleep/src/webserver/","This directory contains the webserver module"],
  ["con","The webserver code is located under the server directory"]
]

What's the value of MAX_FILE_LEN?

[
  ["con": "None of files in the context contain the value of MAX_FILE_LEN"]
]


#####

Output only JSON."#
    )
}

pub fn answer_article_prompt(context: &str) -> String {
    format!(
        r#"{context}Your job is to answer a query about a codebase using the information above.

Provide only as much information and code as is necessary to answer the query, but be concise. Keep number of quoted lines to a minimum when possible. If you do not have enough information needed to answer the query, do not make up an answer.
When referring to code, you must provide an example in a code block.

Respect these rules at all times:
- Do not refer to paths by alias, expand to the full path
- Link ALL paths AND code symbols (functions, methods, fields, classes, structs, types, variables, values, definitions, etc) by embedding them in a markdown link, with the URL corresponding to the full path, and the anchor following the form `LX` or `LX-LY`, where X represents the starting line number, and Y represents the ending line number, if the reference is more than one line.
  - For example, to refer to lines 50 to 78 in a sentence, respond with something like: The compiler is initialized in [`src/foo.rs`](src/foo.rs#L50-L78)
  - For example, to refer to the `new` function on a struct, respond with something like: The [`new`](src/bar.rs#L26-53) function initializes the struct
  - For example, to refer to the `foo` field on a struct and link a single line, respond with something like: The [`foo`](src/foo.rs#L138) field contains foos. Do not respond with something like [`foo`](src/foo.rs#L138-L138)
- Do not print out line numbers directly, only in a link
- Do not refer to more lines than necessary when creating a line range, be precise
- Do NOT output bare symbols. ALL symbols must include a link
  - E.g. Do not simply write `Bar`, write [`Bar`](src/bar.rs#L100-L105).
  - E.g. Do not simply write "Foos are functions that create `Foo` values out of thin air." Instead, write: "Foos are functions that create [`Foo`](src/foo.rs#L80-L120) values out of thin air."
- Link all fields
  - E.g. Do not simply write: "It has one main field: `foo`." Instead, write: "It has one main field: [`foo`](src/foo.rs#L193)."
- Link all symbols, even when there are multiple in one sentence
  - E.g. Do not simply write: "Bars are [`Foo`]( that return a list filled with `Bar` variants." Instead, write: "Bars are functions that return a list filled with [`Bar`](src/bar.rs#L38-L57) variants."
- When quoting code in a code block, use the following info string format: language,path:PATH,lines:LX-LY
  - For example, to quote lines 10 to 15 in `src/main.c`, use `c,path:src/main.c,lines:L10-L15`
  - For example, to quote lines 154 to 190 in `index.js`, use `javascript,path:index.js,lines:L154-L190`
- Always begin your answer with an appropriate title
- If your are unable to answer the query using the information above, do NOT make up an answer. Explain that you need more information to answer the question and why"#
    )
}

pub fn hypothetical_document_prompt(query: &str) -> String {
    format!(
        r#"Write a code snippet that could hypothetically be returned by a code search engine as the answer to the query: {query}

- Write the snippets in a programming or markup language that is likely given the query
- The snippet should be between 5 and 10 lines long
- Surround the snippet in triple backticks

For example:

What's the Qdrant threshold?

```rust
SearchPoints {{
    limit,
    vector: vectors.get(idx).unwrap().clone(),
    collection_name: COLLECTION_NAME.to_string(),
    offset: Some(offset),
    score_threshold: Some(0.3),
    with_payload: Some(WithPayloadSelector {{
        selector_options: Some(with_payload_selector::SelectorOptions::Enable(true)),
    }}),
```"#
    )
}

pub fn try_parse_hypothetical_documents(document: &str) -> Vec<String> {
    let pattern = r"```([\s\S]*?)```";
    let re = regex::Regex::new(pattern).unwrap();

    re.captures_iter(document)
        .map(|m| m[1].trim().to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_hypothetical_document() {
        let document = r#"Here is some pointless text

        ```rust
pub fn final_explanation_prompt(context: &str, query: &str, query_history: &str) -> String {
    struct Rule<'a> {
        title: &'a str,
        description: &'a str,
        note: &'a str,
        schema: &'a str,```

Here is some more pointless text

```
pub fn functions() -> serde_json::Value {
    serde_json::json!(
```"#;
        let expected = vec![
            r#"rust
pub fn final_explanation_prompt(context: &str, query: &str, query_history: &str) -> String {
    struct Rule<'a> {
        title: &'a str,
        description: &'a str,
        note: &'a str,
        schema: &'a str,"#,
            r#"pub fn functions() -> serde_json::Value {
    serde_json::json!("#,
        ];

        assert_eq!(try_parse_hypothetical_documents(document), expected);
    }
}
