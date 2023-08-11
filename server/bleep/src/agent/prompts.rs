pub fn functions(add_proc: bool) -> serde_json::Value {
    let mut funcs = serde_json::json!(
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
                        "paths": {
                            "type": "array",
                            "items": {
                                "type": "integer",
                                "description": "The indices of the paths to answer with respect to. Can be empty if the answer is not related to a specific path."
                            }
                        }
                    },
                    "required": ["paths"]
                }
            },
        ]
    );

    if add_proc {
        funcs.as_array_mut().unwrap().push(
            serde_json::json!(
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
            }
            )
        );
    }
    funcs
}

pub fn system<'a>(paths: impl IntoIterator<Item = &'a str>) -> String {
    let mut s = "".to_string();

    let mut paths = paths.into_iter().peekable();

    if paths.peek().is_some() {
        s.push_str("## PATHS ##\nindex, path\n");
        for (i, path) in paths.enumerate() {
            s.push_str(&format!("{}, {}\n", i, path));
        }
        s.push('\n');
    }

    s.push_str(
        r#"Follow these rules at all times:

- ALWAYS call a function, DO NOT answer the question directly, even if the query is not in English
- DO NOT call a function that you've used before with the same arguments
- DO NOT assume the structure of the codebase, or the existence of files or folders
- Call functions to find information that will help answer the user's query, until all relevant information has been found
- Only call functions.proc with path indices that are under the PATHS heading above
- If the output of a function is empty, try calling the function again with different arguments OR try calling a different function
- If functions.code or functions.path did not return any relevant information, call them again with a SIGNIFICANTLY different query. The terms in the new query should not overlap with terms in your old one
- Call functions.proc with paths that you have reason to believe might contain relevant information. Either because of the path name, or to expand on code that's already been returned by functions.code 
- DO NOT pass more than 5 paths to functions.proc at a time
- In most cases call functions.code or functions.path functions before calling functions.none
- When you have enough information to answer the user call functions.none. DO NOT answer the user directly
- If the user is referring to information that is already in your history, call functions.none
- When calling functions.code or functions.path, your query should consist of keywords. E.g. if the user says 'What does contextmanager do?', your query should be 'contextmanager'. If the user says 'How is contextmanager used in app', your query should be 'contextmanager app'. If the user says 'What is in the src directory', your query should be 'src'
- Only call functions.none with paths that might help answer the user's query
- If after attempting to gather information you are still unsure how to answer the query, respond with the functions.none function
- If the query is a greeting, or not a question or an instruction use functions.none
- ALWAYS call a function. DO NOT answer the question directly"#);
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

/*

    format!(
        r#"{context}#####

        A user is looking at the code above, they'd like you to answer their queries.

Your output will be interpreted as bloop-markdown which renders with the following rules:
- All github-markdown rules are accepted
- Lines of code can be referenced using the URL format: [foo.rs](src/foo.rs#L50-L78)
  - In this example, the link is to the file src/foo.rs and the lines 50 to 78
  - Links should be semantically named to help the user understand when they're clicking on
- When referring to lines of code, you must use a link
- When referring to code symbols (functions, methods, fields, classes, structs, types, variables, values, definitions, directories, etc), you must use a link"#
    )

*/

pub fn answer_article_prompt(aliases: &[usize], context: &str) -> String {
    // If there is only one alias, return "one" otherwise return "many"
    let one_prompt = format!(
        r#"{context}#####

A user is looking at the code above, they'd like you to answer their queries.

Your output will be interpreted as bloop-markdown which renders with the following rules:
- Inline code must be expressed as a link to the correct line of code using the URL format: `[bar](src/foo.rs#L50)` or `[bar](src/foo.rs#L50-L54)`
- Do NOT output bare symbols. ALL symbols must include a link
  - E.g. Do not simply write `Bar`, write [`Bar`](src/bar.rs#L100-L105).
  - E.g. Do not simply write "Foos are functions that create `Foo` values out of thin air." Instead, write: "Foos are functions that create [`Foo`](src/foo.rs#L80-L120) values out of thin air."
- Only internal links to the current file work

Here is an example response:

A function [`openCanOfBeans`](src/beans/open.py#L7-L19) is defined. This function is used to handle the opening of beans. It includes the variable [`openCanOfBeans`](src/beans/open.py#L9) which is used to store the value of the tin opener.
"#
    );

    let many_prompt = format!(
        r#"{context}Your job is to answer a query about a codebase using the information above.

Provide only as much information and code as is necessary to answer the query, but be concise. Keep number of quoted lines to a minimum when possible. If you do not have enough information needed to answer the query, do not make up an answer.
When referring to code, you must provide an example in a code block.

Respect these rules at all times:
- Do not refer to paths by alias, expand to the full path
- Link ALL paths AND code symbols (functions, methods, fields, classes, structs, types, variables, values, definitions, directories, etc) by embedding them in a markdown link, with the URL corresponding to the full path, and the anchor following the form `LX` or `LX-LY`, where X represents the starting line number, and Y represents the ending line number, if the reference is more than one line.
  - For example, to refer to lines 50 to 78 in a sentence, respond with something like: The compiler is initialized in [`src/foo.rs`](src/foo.rs#L50-L78)
  - For example, to refer to the `new` function on a struct, respond with something like: The [`new`](src/bar.rs#L26-53) function initializes the struct
  - For example, to refer to the `foo` field on a struct and link a single line, respond with something like: The [`foo`](src/foo.rs#L138) field contains foos. Do not respond with something like [`foo`](src/foo.rs#L138-L138)
  - For example, to refer to a folder `foo`, respond with something like: The files can be found in [`foo`](path/to/foo/) folder
- Do not print out line numbers directly, only in a link
- Do not refer to more lines than necessary when creating a line range, be precise
- Do NOT output bare symbols. ALL symbols must include a link
  - E.g. Do not simply write `Bar`, write [`Bar`](src/bar.rs#L100-L105).
  - E.g. Do not simply write "Foos are functions that create `Foo` values out of thin air." Instead, write: "Foos are functions that create [`Foo`](src/foo.rs#L80-L120) values out of thin air."
- Link all fields
  - E.g. Do not simply write: "It has one main field: `foo`." Instead, write: "It has one main field: [`foo`](src/foo.rs#L193)."
- Link all symbols, even when there are multiple in one sentence
  - E.g. Do not simply write: "Bars are [`Foo`]( that return a list filled with `Bar` variants." Instead, write: "Bars are functions that return a list filled with [`Bar`](src/bar.rs#L38-L57) variants."
- Always begin your answer with an appropriate title
- Always finish your answer with a summary in a [^summary] footnote
  - If you do not have enough information needed to answer the query, do not make up an answer. Instead respond only with a [^summary] f
ootnote that asks the user for more information, e.g. `assistant: [^summary]: I'm sorry, I couldn't find what you were looking for, could you provide more information?`
- Code blocks MUST be displayed to the user using XML in the following formats:
  - Do NOT output plain markdown blocks, the user CANNOT see them
  - To create new code, you MUST mimic the following structure (example given):
###
The following demonstrates logging in JavaScript:
<GeneratedCode>
<Code>
console.log("hello world")
</Code>
<Language>JavaScript</Language>
</GeneratedCode>
###
  - To quote existing code, use the following structure (example given):
###
This is referred to in the Rust code:
<QuotedCode>
<Code>
println!("hello world!");
println!("hello world!");
</Code>
<Language>Rust</Language>
<Path>src/main.rs</Path>
<StartLine>4</StartLine>
<EndLine>5</EndLine>
</QuotedCode>
###
  - `<GeneratedCode>` and `<QuotedCode>` elements MUST contain a `<Language>` value, and `<QuotedCode>` MUST additionally contain `<Path>`, `<StartLine>`, and `<EndLine>`.
  - Note: the line range is inclusive
- When writing example code blocks, use `<GeneratedCode>`, and when quoting existing code, use `<QuotedCode>`.
- You MUST use XML code blocks instead of markdown."#
    );

    let one_or_many = if aliases.len() == 1 {
        one_prompt
    } else {
        many_prompt
    };
    one_or_many.to_string()
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
