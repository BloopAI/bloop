use std::collections::HashMap;

use axum::{extract::Query, response::IntoResponse, Extension, Json};
use reqwest::StatusCode;
use thiserror::Error;
use tracing::{error, info, warn};
use utoipa::ToSchema;

use crate::{
    analytics::QueryEvent, indexes::reader::ContentDocument, query::parser, semantic::Semantic,
    state::RepoRef, Application,
};

use super::ErrorKind;

/// Mirrored from `answer_api/lib.rs` to avoid private dependency.
pub mod api {
    #[derive(Debug, serde::Serialize, serde::Deserialize)]
    pub struct Request {
        pub query: String,
        pub snippets: Vec<Snippet>,
        pub user_id: String,
    }

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

    #[derive(Debug, serde::Serialize, serde::Deserialize)]
    pub struct Response {
        pub answer: String,
        pub answer_path: String,
    }
}

fn default_limit() -> u64 {
    10
}

fn default_user_id() -> String {
    String::from("test_user")
}

#[derive(Debug, serde::Deserialize)]
pub struct Params {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: u64,
    #[serde(default = "default_user_id")]
    pub user_id: String,
}

#[derive(serde::Serialize, ToSchema)]
pub struct AnswerResponse {
    pub user_id: String,
    pub query_id: uuid::Uuid,
    pub snippets: Vec<api::Snippet>,
    pub selection: api::Response,
}

const SNIPPET_COUNT: usize = 50;

pub async fn handle(
    Query(params): Query<Params>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    let semantic = app
        .semantic
        .as_ref()
        .ok_or_else(|| super::error(ErrorKind::Configuration, "Qdrant not configured"))?;

    let query =
        parser::parse_nl(&params.q).map_err(|e| super::error(ErrorKind::User, e.to_string()))?;
    let target = query
        .target()
        .ok_or_else(|| super::error(ErrorKind::User, "missing search target".to_owned()))?;

    let all_snippets: Vec<api::Snippet> = semantic
        .search(&query, 4 * SNIPPET_COUNT as u64) // heuristic
        .await
        .map_err(|e| super::error(ErrorKind::Internal, e.to_string()))?
        .into_iter()
        .map(|r| {
            use qdrant_client::qdrant::{value::Kind, Value};

            fn value_to_string(value: Value) -> String {
                match value.kind.unwrap() {
                    Kind::StringValue(s) => s,
                    _ => panic!("got non-string value"),
                }
            }

            let mut s = r.payload;

            api::Snippet {
                lang: value_to_string(s.remove("lang").unwrap()),
                repo_name: value_to_string(s.remove("repo_name").unwrap()),
                repo_ref: value_to_string(s.remove("repo_ref").unwrap()),
                relative_path: value_to_string(s.remove("relative_path").unwrap()),
                text: value_to_string(s.remove("snippet").unwrap()),

                start_line: value_to_string(s.remove("start_line").unwrap())
                    .parse::<usize>()
                    .unwrap(),
                end_line: value_to_string(s.remove("end_line").unwrap())
                    .parse::<usize>()
                    .unwrap(),
                start_byte: value_to_string(s.remove("start_byte").unwrap())
                    .parse::<usize>()
                    .unwrap(),
                end_byte: value_to_string(s.remove("end_byte").unwrap())
                    .parse::<usize>()
                    .unwrap(),
                score: r.score,
            }
        })
        .collect();

    let mut snippets = vec![];
    let mut chunk_ranges_by_file: HashMap<String, Vec<std::ops::Range<usize>>> = HashMap::new();

    for snippet in all_snippets.clone().into_iter() {
        if snippets.len() > SNIPPET_COUNT {
            break;
        }

        let path = &snippet.relative_path;
        if !chunk_ranges_by_file.contains_key(path) {
            chunk_ranges_by_file
                .entry(path.to_string())
                .or_insert_with(Vec::new);
        }

        if chunk_ranges_by_file.get(path).unwrap().len() <= 2 {
            // check if line ranges of any added chunk overlap with current chunk
            let any_overlap = chunk_ranges_by_file
                .get(path)
                .unwrap()
                .iter()
                .any(|r| (snippet.start_line <= r.end) && (r.start <= snippet.end_line));

            // no overlap, add snippet
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
    }

    if snippets.is_empty() {
        warn!("Semantic search returned no snippets");
        return Err(super::internal_error(
            "semantic search returned no snippets",
        ));
    } else {
        info!("Semantic search returned {} snippets", snippets.len());
    }

    // score each result
    let snippet_scores = snippets
        .iter()
        .filter_map(|snippet| semantic.score(&params.q, snippet.text.as_str()).ok())
        .collect::<Vec<f32>>();

    tracing::info!("{:?}", &snippets);
    tracing::info!("{:?}", &snippet_scores);

    let relevant_snippet_index = snippet_scores
        .iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| a.total_cmp(b))
        .map(|(index, _)| index)
        .unwrap();

    info!("Relevant snippet index: {}", &relevant_snippet_index);

    let answer_api_host = format!("{}/q", app.config.answer_api_url);
    let answer_api_client = semantic.build_answer_api_client(answer_api_host.as_str(), target, 5);

    let relevant_snippet = snippets
        .get(relevant_snippet_index)
        .ok_or_else(|| super::internal_error("answer-api returned out-of-bounds index"))?;

    // grow the snippet by 60 lines above and below, we have sufficient space
    // to grow this snippet by 10 times its original size (15 to 150)
    let processed_snippet = {
        let repo_ref = &relevant_snippet
            .repo_ref
            .parse::<RepoRef>()
            .map_err(super::internal_error)?;
        let doc = app
            .indexes
            .file
            .by_path(repo_ref, &relevant_snippet.relative_path)
            .await
            .map_err(super::internal_error)?;

        let mut grow_size = 40;
        let grown_text = loop {
            let grown_text = grow(&doc, relevant_snippet, grow_size);
            let token_count = semantic.gpt2_token_count(&grown_text);
            info!(%grow_size, %token_count, "growing ...");
            if token_count > 2000 || grow_size > 100 {
                break grown_text;
            } else {
                grow_size += 10;
            }
        };
        api::Snippet {
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
            super::error(ErrorKind::UpstreamService, e.to_string())
        })?
        .text()
        .await
        .map_err(super::internal_error)?;

    // reorder snippets
    snippets.swap(relevant_snippet_index, 0);

    let query_id = uuid::Uuid::new_v4();
    app.track_query(QueryEvent {
        user_id: params.user_id.clone(),
        query_id,
        query: params.q.clone(),
        semantic_results: all_snippets,
        filtered_semantic_results: snippets.clone(),
        relevant_snippet_index,
        explain_prompt,
        explanation: snippet_explanation.clone(),
        overlap_strategy: semantic.overlap_strategy(),
    });

    // answering snippet is always at index 0
    let answer_path = snippets.get(0).unwrap().relative_path.to_string();

    Ok::<_, Json<super::Response<'static>>>(Json(super::Response::Answer(AnswerResponse {
        snippets,
        query_id,
        user_id: params.user_id,
        selection: api::Response {
            answer: snippet_explanation,
            answer_path,
        },
    })))
}

// grow the text of this snippet by `size` and return the new text
fn grow(doc: &ContentDocument, snippet: &api::Snippet, size: usize) -> String {
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

#[derive(serde::Serialize)]
struct OpenAIRequest {
    prompt: String,
    max_tokens: u32,
    temperature: f32,
}

struct AnswerAPIClient<'s> {
    client: reqwest::Client,
    host: String,
    query: String,
    semantic: &'s Semantic,
    max_attempts: usize,
}

#[derive(Error, Debug)]
enum AnswerAPIError {
    #[error("max retry attempts reached {0}")]
    MaxAttemptsReached(usize),

    #[error("fatal error {0}")]
    Fatal(reqwest::Error),
}

impl Semantic {
    fn build_answer_api_client<'s>(
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
}

impl<'a> AnswerAPIClient<'a> {
    fn build_explain_prompt(&self, snippet: &api::Snippet) -> String {
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

    async fn explain_snippet(&self, prompt: &str) -> Result<reqwest::Response, AnswerAPIError> {
        let tokens_used = self.semantic.gpt2_token_count(prompt);
        info!(%tokens_used, "input prompt token count");
        let max_tokens = 4096usize.saturating_sub(tokens_used);
        if max_tokens == 0 {
            // our prompt has overshot the token count, log an error for now
            // TODO: this should propagte to sentry
            error!(%tokens_used, "prompt overshot token limit");
        }

        // do not let the completion cross 500 tokens
        let max_tokens = max_tokens.clamp(1, 500);
        info!(%max_tokens, "clamping max tokens");
        self.send_until_success(prompt, max_tokens as u32, 0.9)
            .await
    }
}
