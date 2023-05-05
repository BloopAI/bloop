//! Various prompts passed to the LLM.

pub const INITIAL_PROMPT: &str = r#"["ask","Hi there, what can I help you with?"]"#;

pub const CONTINUE: &str = "Is there anything else I can help with?";

pub fn system() -> String {
    let today = chrono::offset::Local::now();
    let tools = serde_json::json!([
      {
        "title": "Semantic code search",
        "schema": {
          "name": "code",
          "args": [
            {
              "name": "SEARCH TERMS",
              "type": "STRING"
            }
          ]
        },
        "note": "This does not return an exhaustive list of result, just the top matches. For exhaustive results, use path search first."
      },
      {
        "title": "Fuzzy path search",
        "schema": {
          "name": "path",
          "args": [
            {
              "name": "SEARCH TERMS",
              "type": "STRING",
              "examples": [
                "src",
                "tests",
                ".css",
                ".tsx"
              ]
            }
          ]
        }
      },
      {
        "title": "Process files for information or answers",
        "schema": {
          "name": "proc",
          "args": [
            {
              "name": "FIND INFORMATION",
              "type": "STRING",
              "example": "the user wants to find all the functional react components"
            },
            {
              "name": "PATH ALIAS FOR EACH FILE",
              "type": "INT[]"
            }
          ]
        }
      },
      {
        "title": "No tool left to take",
        "schema": {
          "name": "none",
          "args": [],
        }
      }
    ]);

    format!(
        r#"The following tools are available: {tools}.

You must adhere to the following rules at all times:
- Your job is to use the tools to find information related to the query, until all information has been found.
- Output a JSON list to use a tool. For example to use the semantic code search tool, output: ["code","search terms here"]
- Respect action arg types, only types with brackets [] can be used as lists.
- You will need to use multiple tools before using the none tool.
- Do not repeat any action.
- If you are following a path search with a proc, and there are more than 10 path aliases to proc, instead return none and see if the user asks a follow up question.
- Do not assume the structure of the codebase, or the existence of files or folders.
- If a query is too complicated to answer, ask the user to ask a simpler question.
- To perform multiple actions, perform just one, wait for the response, then perform the next.
- Todays date is {today}.
        "#
    )
}

pub fn file_explanation(question: &str, path: &str, code: &str) -> String {
    format!(
        r#"Here's the contents of the code file /{path}:

#####

{code}

#####

Your job is to perform the following tasks:
1. Find out which other files and dependencies we should look at for information relevant to the query. You must answer with a json list of relevant paths, relative to the current file.
2. Find all the relevant line ranges of code.

Q: find Kafka auth keys
A: {{"dependencies":["../../utils/kafkaHandler","../src/config/index.ts"],"lines":[{{"start":12,"end":15}}]}}

Q: find where we submit payment requests
A: {{"dependencies":["../paymentRequestProvider"],"lines":[{{"start":12,"end":15}}]}}

ANSWER ONLY IN JSON
Q: {question}
A: "#
    )
}

pub fn final_explanation_prompt(context: &str, query_history: &str) -> String {
    format!(
        r#"{context}#####
Above are several pieces of information that can help you answer a user query.

Your job is to answer the user's query. Your answer should be in the following JSON format: a list of objects, where each object represents one instance of:

1. citing a single file from the codebase (this object can appear multiple times, in the form of a JSON array)
START LINE and END LINE should focus on the code mentioned in the COMMENT.

[["cite",INT: §ALIAS,STRING: COMMENT,INT: START LINE,INT: END LINE],
["cite",INT: §ALIAS,STRING: COMMENT,INT: START LINE,INT: END LINE]]

2. write a new code file (this object can appear multiple times)
Do not use this to demonstrate updating an existing file.

["new",STRING: LANGUAGE,STRING: CODE]

3. update the code in an existing file (this object can appear multiple times)
This is the best way to demonstrate updating an existing file.
Changes should be as small as possible.

["mod",INT: §ALIAS,STRING: LANGUAGE,STRING: GIT DIFF]
Where GIT DIFF describes the diff chunks for the file, including the git diff header.
For example:
@@ -1 +1 @@
-this is a git diff test example
+this is a diff example

4. conclusion (this object is mandatory and must appear once at the end)

["con",STRING: COMMENT]

Your response should be a JSON array of objects.
Refer to directories by their full paths, surrounded by single backticks.

#####

{query_history}

Above is the query and answer history. The user can see the previous queries and answers on their screen, but not anything else.
Based on this history, answer the user's last question.

#####

Output only JSON.

"#
    )
}
