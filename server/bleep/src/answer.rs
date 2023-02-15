use std::{borrow::Cow, collections::HashMap};

use dashmap::{mapref::entry::Entry, DashMap};
use reqwest::StatusCode;
use thiserror::Error;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::{
    analytics::QueryEvent,
    indexes::reader::ContentDocument,
    query::parser::{self, NLQuery},
    semantic::Semantic,
    state::RepoRef,
    Application,
};

pub struct AnswerAPIClient<'s> {
    client: reqwest::Client,
    host: String,
    query: String,
    semantic: &'s Semantic,
    max_attempts: usize,
}

#[derive(Error, Debug)]
pub enum AnswerAPIError {
    #[error("max retry attempts reached {0}")]
    MaxAttemptsReached(usize),

    #[error("fatal error {0}")]
    Fatal(reqwest::Error),
}

/// Mirrored from `answer_api/lib.rs` to avoid private dependency.
// #[derive(Debug, serde::Serialize, serde::Deserialize)]
// pub struct Request {
//     pub query: String,
//     pub snippets: Vec<Snippet>,
//     pub user_id: String,
// }

/// Mirrored from `answer_api/lib.rs` to avoid private dependency.
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Snippet {
    pub lang: String,
    pub repo_name: String,
    pub repo_ref: String,
    pub relative_path: String,
    pub text: String,
    pub start_line: usize,
    pub end_line: usize,
    pub start_byte: usize,
    pub end_byte: usize,
    pub score: f32,
}

#[derive(serde::Serialize)]
struct OpenAIRequest {
    prompt: String,
    max_tokens: u32,
    temperature: f32,
}

impl Semantic {
    pub(crate) fn build_answer_api_client<'s>(
        &'s self,
        host: &str,
        query: &str,
        max_attempts: usize,
    ) -> AnswerAPIClient<'s> {
        AnswerAPIClient {
            client: reqwest::Client::new(),
            host: host.to_owned(),
            query: query.to_owned(),
            semantic: self,
            max_attempts,
        }
    }
}

const DELIMITER: &str = "=========";

fn build_action_selection_prompt(query: &str) -> String {
    format!(
        r#"You are bloop, an AI agent designed to help developers navigate codebases and ship to production faster. You can think of bloop as like having an intern sitting next to you, completing menial tasks on your behalf while you get on with solving complex problems and shipping products.

- bloop works by searching your codebase for relevant files using proprietary trained models, and leverages the power of GPT to provide rich explanations.
- The company behind bloop is a startup founded in 2021, based in Farringdon, London. They are a Y Combinator company.
- bloop cannot answer questions unrelated to your codebase.
- bloop does not have feelings or opinions.
- Further information about bloop can be found on the website https://bloop.ai

Your response depends on the type of query that the user has asked. There are four query categories. For each of the four, respond according to the corresponding instruction:

1. If the query is about the codebase or product reply with 0. Your answer MUST be the single integer 0.
2. If the query is about the bloop support agent, answer the query in the first person in a polite and helpful way using only the information above.
3. If the query is an introduction or welcome message respond to the user by introducing yourself in the first person, in a polite and helpful way using only the information above.
4. If the query is something else explain that you can't answer it in a polite and helpful way. Suggest that the user asks a technical question about the codebase, or tries asking their question again in a different way. Do NOT answer the question.

For example:

Q: Hey bloop, do we pin js version numbers?
A: 0
Q: When's your birthday @bloop?
A: I do not know my birthday. The company that started bloop is a startup founded in 2021, based in Farringdon, London.
Q: What color are avocados?
A: I'm sorry, I don't understand what you mean. Please ask a question that's related to the codebase.
Q: Where do we test if GitHub login works?
A: 0
Q: How do we balance eggs on a spoon?
A: I'm sorry, I don't understand what you mean. Please ask a question that's related to the codebase.
Q: What is bloop?
A: bloop is a AI agent designed to help developers with many tasks. You can think of bloop as like having an intern sitting next to you, completing menial tasks on your behalf while you get on with solving complex problems and shipping products.
Q: Introduce yourself.
A: It's great to meet you! I'm an AI agent, here to help you find code from your codebase and ship to production faster.
Q: It's great to meet you.
A: Nice to meet you too! I'm looking forward to helping you with your everyday tasks and menial work!
Q: How does bloop work?
A: bloop works by searching your codebase for relevant files using proprietary trained models, and leverages the power of GPT to provide rich explanations.
Q: Where do we check if Kafka is running?
A: 0
Q: Which investors have invested in bloop?
A: Y Combinator has invested in bloop.
Q: What's the best way to update the search icon @bloop?
A: 0
Q: Hey bloop, I have a question - Where do we test if GitHub login works?
A: 0
{DELIMITER}
Q: {query}
A:"#,
    )
}

fn build_rephrase_query_prompt(query: &str, history: &[PriorConversationEntry]) -> String {
    debug_assert!(!history.is_empty());
    let history = history
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        r#"You are a customer support agent called bloop. Given a question and an optional conversational history, extract a standalone question. IGNORE any information in the conversational history which is not relevant to the question. \
H: []
Q: Hey bloop, do we pin js version numbers?
A: do we pin js version numbers?

H: []
Q: Hey bloop, I have a question - Where do we test if GitHub login works?
A: Where do we test if GitHub login works?

H: []
Q: What's the best way to update the search icon @bloop?
A: What's the best way to update the search icon?

H: [Where do we test if GitHub login works?]
Q: No that's not a unit test
A: Where is a unit test for GitHub login?

H: [Where do we test if GitHub login works?, No that's not a unit test]
Q: With Jest
A: Where is there a Jest test for GitHub login?

H: [I love bananas, Where do we test if GitHub login works?, No that's not a unit test]
Q: With Jest
A: Where is there a Jest test for GitHub login?

{DELIMITER}

H: [{history}]
Q: {query}
A:`"#
    )
}

impl<'s> AnswerAPIClient<'s> {
    async fn send(
        &self,
        prompt: &str,
        max_tokens: u32,
        temperature: f32,
    ) -> Result<reqwest::Response, reqwest::Error> {
        self.client
            .post(self.host.as_str())
            .json(&OpenAIRequest {
                prompt: prompt.to_string(),
                max_tokens,
                temperature,
            })
            .send()
            .await
    }

    async fn send_until_success(
        &self,
        prompt: &str,
        max_tokens: u32,
        temperature: f32,
    ) -> Result<reqwest::Response, AnswerAPIError> {
        for attempt in 0..self.max_attempts {
            let response = self.send(prompt, max_tokens, temperature).await;
            match response {
                Ok(r) if r.status() == StatusCode::OK => return Ok(r),
                Err(e) => return Err(AnswerAPIError::Fatal(e)),
                _ => (),
            };
            warn!(%attempt, "answer-api returned {} ... retrying", response.unwrap().status());
        }
        Err(AnswerAPIError::MaxAttemptsReached(self.max_attempts))
    }

    pub(crate) fn build_select_prompt(&self, snippets: &[Snippet]) -> String {
        // snippets are 1-indexed so we can use index 0 where no snippets are relevant
        let mut prompt = snippets
            .iter()
            .enumerate()
            .map(|(i, snippet)| {
                format!(
                    "Repository: {}\nPath: {}\nLanguage: {}\nIndex: {}\n\n{}\n{DELIMITER}\n",
                    snippet.repo_name,
                    snippet.relative_path,
                    snippet.lang,
                    i + 1,
                    snippet.text
                )
            })
            .collect::<String>();

        // the example question/answer pair helps reinforce that we want exactly a single
        // number in the output, with no spaces or punctuation such as fullstops.
        prompt += &format!(
            "Above are {} code snippets separated by \"{DELIMITER}\". \
Your job is to select the snippet that best answers the question. Reply \
with a single number indicating the index of the snippet in the list. \
If none of the snippets are relevant, reply with \"0\". Do NOT return a non-numeric answer.

Q:What icon do we use to clear search history?
A:3

Q:{}
A:",
            snippets.len(),
            self.query,
        );

        let tokens_used = self.semantic.gpt2_token_count(&prompt);
        debug!(%tokens_used, "select prompt token count");
        prompt
    }

    fn build_explain_prompt(&self, snippet: &Snippet) -> String {
        let prompt = format!(
            "You are an AI assistant for a repo. You are given an extract from a file and a question. \
Use the file to write a detailed answer to the question. Copy relevant parts of the file into the answer and explain why they are relevant. \
Do NOT include code that is not in the file. If the file doesn't contain enough information to answer the question, or you don't know the answer, just say \"Sorry, I'm not sure\". \
Do NOT try to make up an answer. Format your response in GitHub markdown with code blocks annotated with programming language.
Question: {}
=========
File: {}
=========
Answer in GitHub Markdown:",
            self.query, snippet.text,
        );
        prompt
    }

    async fn select_snippet(&self, prompt: &str) -> Result<reqwest::Response, AnswerAPIError> {
        self.send_until_success(prompt, 1, 0.0).await
    }

    async fn explain_snippet(&self, prompt: &str) -> Result<reqwest::Response, AnswerAPIError> {
        let tokens_used = self.semantic.gpt2_token_count(prompt);
        info!(%tokens_used, "input prompt token count");
        let max_tokens = 4096usize.saturating_sub(tokens_used);
        if max_tokens == 0 {
            // our prompt has overshot the token count, log an error for now
            // TODO: this should propagate to sentry
            error!(%tokens_used, "prompt overshot token limit");
        }

        // do not let the completion cross 500 tokens
        let max_tokens = max_tokens.clamp(1, 500);
        info!(%max_tokens, "clamping max tokens");
        self.send_until_success(prompt, max_tokens as u32, 0.9)
            .await
    }
}

fn deduplicate_snippets(all_snippets: &[Snippet], limit: usize) -> Vec<Snippet> {
    let mut snippets = vec![];
    let mut chunk_ranges_by_file: HashMap<String, Vec<std::ops::Range<usize>>> = HashMap::new();

    for snippet in all_snippets.iter().cloned() {
        if snippets.len() > limit {
            break;
        }

        let path = &snippet.relative_path;

        let any_overlap = if let Some(ranges) = chunk_ranges_by_file.get(path) {
            ranges.len() <= 2
                && ranges
                    .iter()
                    .any(|r| (snippet.start_line < r.end) && (r.start <= snippet.end_line))
        } else {
            false
        };
        if !any_overlap {
            chunk_ranges_by_file
                .entry(path.to_string())
                .or_insert_with(Vec::new)
                .push(std::ops::Range {
                    start: snippet.start_line,
                    end: snippet.end_line,
                });
            snippets.push(snippet);
        }
    }
    snippets
}

// grow the text of this snippet by `size` and return the new text
fn grow(doc: &ContentDocument, snippet: &Snippet, size: usize) -> String {
    let content = &doc.content;

    // skip upwards `size` number of lines
    let new_start_byte = content[..snippet.start_byte]
        .rmatch_indices('\n')
        .map(|(idx, _)| idx)
        .nth(size)
        .unwrap_or(0);

    // skip downwards `size` number of lines
    let new_end_byte = content[snippet.end_byte..]
        .match_indices('\n')
        .map(|(idx, _)| idx)
        .nth(size)
        .map(|s| s.saturating_add(snippet.end_byte)) // the index is off by `snippet.end_byte`
        .unwrap_or(content.len());

    content[new_start_byte..new_end_byte].to_owned()
}

#[derive(Debug)]
pub enum AnswerError {
    Configuration(&'static str),
    User(String),
    Internal(Cow<'static, str>),
    UpstreamService(AnswerAPIError),
}

fn internal(e: impl Into<Cow<'static, str>>) -> AnswerError {
    AnswerError::Internal(e.into())
}

pub async fn answer(
    q: &str,
    user_id: &str,
    limit: u64,
    app: Application,
    query_id: Uuid,
) -> Result<(Vec<Snippet>, String), AnswerError> {
    let semantic = app
        .semantic
        .as_ref()
        .ok_or_else(|| AnswerError::Configuration("qdrant not configured"))?;

    let query = parser::parse_nl(q).map_err(|e| AnswerError::User(e.to_string()))?;
    let target = query
        .target()
        .ok_or_else(|| AnswerError::User("missing search target".to_owned()))?;

    // we keep the borrow on the store short to avoid contention
    // TODO: Add a maximum of prior history entries (e.g. 20)
    let rephrase_query: Option<String> = (*app.prior_conversation_store).with_prior_conversation(
        user_id,
        // check how much history we can afford to create up to the token limit
        |history| {
            let n = history.len().saturating_sub(20);
            build_rephrase_query_prompt(target, &history[n..])
        },
    );
    //TODO: Reuse the client, perhaps as part of the app, set up on startup?
    let answer_api_host = format!("{}/q", app.config.answer_api_url);
    let answer_api_client = semantic.build_answer_api_client(answer_api_host.as_str(), target, 5);

    let rephrase_answer;
    //if rephrased_query-is_none(), select action
    let query = if let Some(q) = rephrase_query {
        rephrase_answer = answer_api_client
            .send_until_success(&q, 2000, 0.0)
            .await
            .map_err(|e| {
                sentry::capture_message(
                    format!("answer-api failed to respond: {e}").as_str(),
                    sentry::Level::Error,
                );
                AnswerError::UpstreamService(e)
            })?
            .text()
            .await
            .map_err(|e| internal(e.to_string()))?;
        parser::parse_nl(&rephrase_answer).map_err(|e| internal(e.to_string()))?
    } else {
        // select action
        let response = answer_api_client
            .send_until_success(&build_action_selection_prompt(target), 2000, 0.0)
            .await
            .map_err(|e| {
                sentry::capture_message(
                    format!("answer-api failed to respond: {e}").as_str(),
                    sentry::Level::Error,
                );
                AnswerError::UpstreamService(e)
            })?;
        let text = response.text().await.map_err(|_| internal("no answer"))?;
        if text == "0" {
            query // this was a real question, so go on
        } else {
            // introduction or info without snippets
            return Ok((Vec::new(), text));
        }
    };

    let all_snippets = fetch_snippets(semantic, &query, limit)
        .await
        .map_err(|e| internal(e.to_string()))?;
    let mut snippets = deduplicate_snippets(&all_snippets, limit as _);

    if snippets.is_empty() {
        warn!("Semantic search returned no snippets");
        return Err(AnswerError::Internal(Cow::Borrowed(
            "semantic search returned no snippets",
        )));
    } else {
        info!("Semantic search returned {} snippets", snippets.len());
    }

    let select_prompt = answer_api_client.build_select_prompt(&snippets);
    let relevant_snippet_index = answer_api_client
        .select_snippet(&select_prompt)
        .await
        .map_err(|e| {
            sentry::capture_message(
                format!("answer-api failed to respond: {e}").as_str(),
                sentry::Level::Error,
            );
            AnswerError::UpstreamService(e)
        })?
        .text()
        .await
        .map_err(|e| internal(e.to_string()))?
        .trim()
        .to_string()
        .clone();

    info!("Relevant snippet index: {}", &relevant_snippet_index);

    let mut relevant_snippet_index = relevant_snippet_index
        .parse::<usize>()
        .map_err(|e| internal(e.to_string()))?;

    if relevant_snippet_index == 0 {
        return Err(internal("None of the snippets help answer the question"));
    }

    relevant_snippet_index -= 1; // return to 0-indexing
    let relevant_snippet = snippets
        .get(relevant_snippet_index)
        .ok_or_else(|| internal("answer-api returned out-of-bounds index"))?;

    // grow the snippet by 60 lines above and below, we have sufficient space
    // to grow this snippet by 10 times its original size (15 to 150)
    let processed_snippet = {
        let repo_ref = &relevant_snippet
            .repo_ref
            .parse::<RepoRef>()
            .map_err(|e| internal(e.to_string()))?;
        let doc = app
            .indexes
            .file
            .by_path(repo_ref, &relevant_snippet.relative_path)
            .await
            .map_err(|e| internal(e.to_string()))?;

        let mut grow_size = 40;
        let grown_text = loop {
            let grown_text = grow(&doc, relevant_snippet, grow_size);
            let token_count = semantic.gpt2_token_count(&grown_text);
            info!(%grow_size, %token_count, "growing ...");
            if token_count > 2000 || grow_size > 100 {
                break grown_text;
            }
            grow_size += 10;
        };
        Snippet {
            lang: relevant_snippet.lang.clone(),
            repo_name: relevant_snippet.repo_name.clone(),
            repo_ref: relevant_snippet.repo_ref.clone(),
            relative_path: relevant_snippet.relative_path.clone(),
            text: grown_text,
            start_line: relevant_snippet.start_line,
            end_line: relevant_snippet.end_line,
            start_byte: relevant_snippet.start_byte,
            end_byte: relevant_snippet.end_byte,
            score: relevant_snippet.score,
        }
    };

    let explain_prompt = answer_api_client.build_explain_prompt(&processed_snippet);
    let snippet_explanation = answer_api_client
        .explain_snippet(&explain_prompt)
        .await
        .map_err(|e| {
            sentry::capture_message(
                format!("answer-api failed to respond: {e}").as_str(),
                sentry::Level::Error,
            );
            AnswerError::UpstreamService(e)
        })?
        .text()
        .await
        .map_err(|e| internal(e.to_string()))?;

    // reorder snippets
    snippets.swap(relevant_snippet_index, 0);

    app.track_query(QueryEvent {
        user_id: user_id.to_owned(),
        query_id,
        query: q.to_owned(),
        semantic_results: all_snippets,
        filtered_semantic_results: snippets.clone(),
        select_prompt,
        relevant_snippet_index,
        explain_prompt,
        explanation: snippet_explanation.clone(),
        overlap_strategy: semantic.overlap_strategy(),
    });

    // add to history
    app.prior_conversation_store.add_conversation_entry(
        user_id.to_owned(),
        q.to_owned(),
        snippet_explanation.clone(),
    );

    Ok((snippets, snippet_explanation))
}

async fn fetch_snippets(
    semantic: &Semantic,
    query: &NLQuery<'_>,
    limit: u64,
) -> anyhow::Result<Vec<Snippet>> {
    Ok(semantic
        .search(query, 4 * limit) // heuristic
        .await?
        //.map_err(|e| error(ErrorKind::Internal, e.to_string()))?
        .into_iter()
        .map(|r| {
            use qdrant_client::qdrant::{value::Kind, Value};

            fn get(key: &str, payload: &mut HashMap<String, Value>) -> String {
                if let Some(v) = payload.remove(key) {
                    if let Kind::StringValue(s) = v.kind.unwrap() {
                        return s;
                    }
                }
                panic!("{key} is not a string");
            }

            fn get_usize(key: &str, payload: &mut HashMap<String, Value>) -> usize {
                get(key, payload).parse::<usize>().unwrap()
            }

            let mut s = r.payload;
            Snippet {
                lang: get("lang", &mut s),
                repo_name: get("repo_name", &mut s),
                repo_ref: get("repo_ref", &mut s),
                relative_path: get("relative_path", &mut s),
                text: get("snippet", &mut s),

                start_line: get_usize("start_line", &mut s),
                end_line: get_usize("end_line", &mut s),
                start_byte: get_usize("start_byte", &mut s),
                end_byte: get_usize("end_byte", &mut s),
                score: r.score,
            }
        })
        .collect())
}

/// We store the previous queries and responses
#[allow(unused)]
pub struct PriorConversationEntry {
    query: String,
    response: String,
}

impl std::fmt::Display for PriorConversationEntry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let Self { query, response: _ } = self;
        write!(f, "{query}") //TODO: add the response to the history string?
    }
}

#[derive(Default)]
/// This is just a stand in for a later dedicated solution
pub struct PriorConversationStore {
    conversations: DashMap<String, Vec<PriorConversationEntry>>,
}

impl PriorConversationStore {
    /// This gets the prior conversation. Be sure to drop the borrow before calling
    /// [`add_conversation_entry`], lest we deadlock.
    pub fn with_prior_conversation<T>(
        &self,
        user_id: &str,
        f: impl Fn(&[PriorConversationEntry]) -> T,
    ) -> Option<T> {
        self.conversations.get(user_id).map(|r| f(&r.value()[..]))
    }

    /// add a new conversation entry to the store
    pub fn add_conversation_entry(&self, user_id: String, query: String, response: String) {
        let entry = PriorConversationEntry { query, response };
        match self.conversations.entry(user_id) {
            Entry::Occupied(mut o) => o.get_mut().push(entry),
            Entry::Vacant(v) => {
                v.insert(vec![entry]);
            }
        }
    }

    /// clear the conversation history for a user
    pub fn purge_prior_conversation(&self, user_id: &str) {
        self.conversations.remove(user_id);
    }
}
