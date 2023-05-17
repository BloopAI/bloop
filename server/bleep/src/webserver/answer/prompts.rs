//! Various prompts passed to the LLM.

pub const INITIAL_PROMPT: &str = "Hi there, what can I help you with?";

pub const CONTINUE: &str = "Is there anything else I can help with?";

pub fn system() -> String {
    let today = chrono::offset::Local::now();
    let tools = serde_json::json!([
      {
        "title": "Semantic code search",
        "description": "Search for code semantically. Results will not necessarily match the search terms exactly, but will be semantically related.",
        "schema": {
          "name": "code",
          "args": [
              {
                "name": "SEARCH TERMS",
                "type": "STRING",
                "examples": [
                    "backend error types",
                    "react functional components",
                ],
              }
            ],
        },
        "note": "This does not return an exhaustive list of results, just the top matches. For exhaustive results, use path search first.",
      },
      {
        "title": "Path search",
        "description": "Search for files by path. Results will not necessarily match the search terms exactly, but will be similar by some edit-distance.",
        "schema": {
          "name": "path",
          "args": [
            {
              "name": "PATH SEARCH TERMS",
              "type": "STRING",
              "examples": ["server/src", "tests", ".tsx", "examples/android"],
            }
          ],
        },
        "note": "Use this where the query provides a clue about where relevant information might be.",
      },
      {
        "title": "Process files",
        "description": "Process a list of files to extract the line ranges which are relevant to the query.",
        "schema": {
          "name": "proc",
          "args": [
            {
              "name": "QUERY",
              "type": "STRING",
              "examples": ["find all the functional react components",
                            "where are error types"],
            },
            {
              "name": "PATH ALIAS FOR EACH FILE",
              "type": "INT[]",
              "examples": [[2, 3, 7, 10]],
            },
          ],
        },
      },
      {
        "title": "No tool left to take",
        "description": "Answer the user's query. This is the final step in the process. You should use the information gathered from the other tools to answer the query.",
        "schema": {
          "name": "none",
          "args": [
              {
                "name": "RELEVANT PATH ALIASES",
                "type": "INT[]",
                "examples": [
                  [1], [2, 5], [3]
                ],
                "description": "The path alias of the files you want to cite.",
              }
          ],
        },
      },
      {
        "title": "Commit search",
        "schema": {
          "name": "commit",
          "args": [
              {
                "name": "SEARCH TERMS",
                "type": "STRING",
                "examples": ["reset", ""],
                "description": "Search terms that must be present in the commit message.",
              },
              {
                "name": "AUTHOR",
                "type": "STRING",
                "examples": ["louis", null],
                "description": "Author for the commit.",
              },
              {
                "name": "START DATE",
                "type": "STRING",
                "examples": ["1985-04-12T23:20:50.52Z", null],
                "description": "First date to look at in RFC3339 format.",
              },
              {
                "name": "END DATE",
                "type": "STRING",
                "examples": ["1985-04-13T23:20:50.52Z", null],
                "description": "Last date to look at.",
              },
              {
                "name": "PATH ALIAS",
                "type": "INT",
                "examples": [1],
                "description": "The path alias of the files you want to cite.",
             },
          ],
        },
      },
    ]);

    format!(
        r#"Your job is to answer a question about a codebase. You should use a set of tools to gather information that will help you answer. The following tools are available: {tools}.

You must adhere to the following rules at all times:
- Use the tools to find information related to the query, until all relevant information has been found.
- Output a list of [name, *args] to use a tool. For example to use the semantic code search tool, output: ["code","my search query"]. To use the process file tool, output: ["proc", "how does X work", [3, 6]]
- If the output of a tool is empty, try the same tool again with different arguments or try using a different tool
- Make sure that you have made at least one code or path search before using the answer tool
- When you are confident that you have enough information needed to answer the query, choose the "No tool left to take" tool
- Respect action arg types, only types with brackets [] can be used as lists
- Do not assume the structure of the codebase, or the existence of files or folders
- Do not repeat any action with the same arguments
- To perform multiple actions, perform just one, wait for the response, then perform the next
- If after attempting to gather information you are still unsure how to answer the query, choose the "No tool left to take" tool
- Todays date is {today}

"#
    )
}

pub fn file_explanation(question: &str, path: &str, code: &str) -> String {
    format!(
        r#"Below are the contents of the code file /{path}. Each line is numbered.

#####

{code}

#####

Your job is to perform the following tasks:
1. Find out which other files and dependencies we should look at for information relevant to the query. You must answer with a json list of relevant paths, relative to the current file.
2. Find all the relevant line ranges of code.

Q: find Kafka auth keys
A: {{"dependencies":["../../utils/kafkaHandler","../src/config/index.ts"],"lines":[{{"start":12,"end":15}}]}}

Q: find where we submit payment requests
A: {{"dependencies":["../paymentRequestProvider"],"lines":[{{"start":37,"end":50}}]}}

Q: auth code expiration 
A: {{"dependencies":[],"lines":[{{"start":486,"end":501}},{{"start":530,"end":535}},{{"start":810,"end":832}}]}}

Q: library matrix multiplication 
A: {{"dependencies":[],"lines":[{{"start":68,"end":74}},{{"start":82,"end":85}},{{"start":103,"end":107}},{{"start":212,"end":219}}]}}

Q: how combine result streams 
A: {{"dependencies":[],"lines":[]}}

Q: {question}
A: "#
    )
}

pub fn final_explanation_prompt(context: &str, query: &str, query_history: &str) -> String {
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
            title: "Write a new code file",
            description: "Write a new code file that satisfies the query. Do not use this to demonstrate updating an existing file.",
            schema: "[\"new\",LANGUAGE:STRING,CODE:STRING]",
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
            title: "Cite line ranges from the file",
            description: "START LINE and END LINE should focus on the code mentioned in the COMMENT. COMMENT should be a detailed explanation.",
            schema: "[\"cite\",PATH ALIAS:INT,COMMENT:STRING,START LINE:INT,END LINE:INT]",
            note: "This object can occur multiple times",
            example: None,
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
- Refer to directories by their full paths, surrounded by single backticks
- Your answer should always be an array of arrays, even when you only generate a conclusion

#####

Examples:

Show all the analytics events

[
  ["cite", 27, "Track 'Search' event in useAnalytics.ts", 7, 12],
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

{query_history}

Above is the query and answer history. The user can see the previous queries and answers on their screen, but not anything else.
Based on this history, answer the question: {query}

#####

Output only JSON."#
    )
}
