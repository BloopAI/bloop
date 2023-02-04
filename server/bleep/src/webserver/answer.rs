use std::collections::HashMap;

use axum::{
    extract::Query,
    http::StatusCode,
    response::{sse::Event, IntoResponse, Sse},
    Extension, Json,
};
use futures::{Stream, StreamExt, TryStreamExt};
use thiserror::Error;
use tracing::{debug, error, info, warn};
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
        pub prompt: String,
        pub max_tokens: Option<u32>,
        pub temperature: Option<f32>,
    }
}

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

#[derive(serde::Serialize, ToSchema, Debug)]
pub struct AnswerResponse {
    pub user_id: String,
    pub query_id: uuid::Uuid,
    pub snippets: Vec<Snippet>,
    pub answer_path: String,
}

const SNIPPET_COUNT: usize = 13;

pub(super) async fn handle(
    Query(params): Query<Params>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse, (StatusCode, Json<super::Response<'static>>)> {
    let semantic = app.semantic.clone().ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            super::error(ErrorKind::Configuration, "Qdrant not configured"),
        )
    })?;

    let query = parser::parse_nl(&params.q).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            super::error(ErrorKind::User, e.to_string()),
        )
    })?;
    let target = query.target().ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            super::error(ErrorKind::User, "missing search target".to_owned()),
        )
    })?;

    let all_snippets: Vec<Snippet> = semantic
        .search(&query, 4 * SNIPPET_COUNT as u64) // heuristic
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                super::error(ErrorKind::Internal, e.to_string()),
            )
        })?
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

            Snippet {
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
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            (super::internal_error("semantic search returned no snippets")),
        ));
    } else {
        info!("Semantic search returned {} snippets", snippets.len());
    }

    let answer_api_host = format!("{}/q", app.config.answer_api_url);
    let answer_api_client = semantic.build_answer_api_client(answer_api_host.as_str(), target, 5);

    let select_prompt = answer_api_client.build_select_prompt(&snippets);
    let relevant_snippet_index = answer_api_client
        .select_snippet(&select_prompt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?
        .trim()
        .to_string()
        .clone();

    info!("Relevant snippet index: {}", &relevant_snippet_index);

    let mut relevant_snippet_index = relevant_snippet_index
        .parse::<usize>()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, super::internal_error(e)))?;

    if relevant_snippet_index == 0 {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            super::internal_error("None of the snippets help answer the question"),
        ));
    }

    relevant_snippet_index -= 1; // return to 0-indexing
    let relevant_snippet = snippets.get(relevant_snippet_index).ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            super::internal_error("answer-api returned out-of-bounds index"),
        )
    })?;

    // grow the snippet by 60 lines above and below, we have sufficient space
    // to grow this snippet by 10 times its original size (15 to 150)
    let processed_snippet = {
        let repo_ref = &relevant_snippet
            .repo_ref
            .parse::<RepoRef>()
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, super::internal_error(e)))?;
        let doc = app
            .indexes
            .file
            .by_path(repo_ref, &relevant_snippet.relative_path)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, super::internal_error(e)))?;

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

    // reorder snippets
    snippets.swap(relevant_snippet_index, 0);

    let query_id = uuid::Uuid::new_v4();

    // answering snippet is always at index 0
    let answer_path = snippets.get(0).unwrap().relative_path.to_string();

    let initial_event = Event::default()
        .json_data(super::Response::Answer(AnswerResponse {
            snippets: snippets.clone(),
            query_id,
            user_id: params.user_id.clone(),
            answer_path,
        }))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, super::internal_error(e)))?;

    let explain_prompt = answer_api_client.build_explain_prompt(&processed_snippet);

    let mut snippet_explanation = answer_api_client
        .explain_snippet(&explain_prompt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, super::internal_error(e)))
        .map(Box::pin)?;

    let stream = async_stream::stream! {
        yield anyhow::Result::<_>::Ok(initial_event);

        let mut explanation = String::new();
        while let Some(s) = snippet_explanation.try_next().await? {
            explanation += &s;
            yield Ok(Event::default().data(s));
        }

        app.track_query(QueryEvent {
            user_id: params.user_id,
            query_id,
            query: params.q.clone(),
            semantic_results: all_snippets,
            filtered_semantic_results: snippets,
            select_prompt,
            relevant_snippet_index,
            explain_prompt,
            explanation,
            overlap_strategy: semantic.overlap_strategy(),
        });
    };

    Ok(Sse::new(stream))
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

    #[error("event source error {0}")]
    EventSource(#[from] reqwest_eventsource::Error),

    #[error("failed to open stream")]
    StreamFail,
}

impl From<AnswerAPIError> for super::Error {
    fn from(e: AnswerAPIError) -> super::Error {
        sentry::capture_message(
            format!("answer-api failed to respond: {e}").as_str(),
            sentry::Level::Error,
        );
        super::error(ErrorKind::UpstreamService, e.to_string())
    }
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
    ) -> Result<impl Stream<Item = Result<String, AnswerAPIError>>, AnswerAPIError> {
        let mut stream = Box::pin(
            reqwest_eventsource::EventSource::new(self.client.post(self.host.as_str()).json(
                &api::Request {
                    prompt: prompt.to_string(),
                    max_tokens: Some(max_tokens),
                    temperature: Some(temperature),
                },
            ))
            // We don't have a `Stream` body so this can't fail.
            .expect("couldn't clone requestbuilder")
            // `reqwest_eventsource` returns an error to signify a stream end, instead of simply ending
            // the stream. So we catch the error here and close the stream.
            .take_while(|result| {
                let is_end = matches!(result, Err(reqwest_eventsource::Error::StreamEnded));
                async move { !is_end }
            }),
        );

        match stream.next().await {
            Some(Ok(reqwest_eventsource::Event::Open)) => {}
            Some(Err(e)) => return Err(AnswerAPIError::EventSource(e)),
            _ => return Err(AnswerAPIError::StreamFail),
        }

        Ok(stream
            .filter_map(|result| async move {
                match result {
                    Ok(reqwest_eventsource::Event::Message(msg)) => Some(Ok(msg.data)),
                    Ok(reqwest_eventsource::Event::Open) => None,
                    Err(reqwest_eventsource::Error::StreamEnded) => None,
                    Err(e) => Some(Err(e)),
                }
            })
            .map_err(AnswerAPIError::EventSource))
    }

    async fn send_until_success(
        &self,
        prompt: &str,
        max_tokens: u32,
        temperature: f32,
    ) -> Result<String, AnswerAPIError> {
        for attempt in 0..self.max_attempts {
            let result = self
                .send(prompt, max_tokens, temperature)
                .await?
                .try_collect::<String>()
                .await;

            match result {
                Ok(r) => return Ok(r),
                Err(e) => warn!(%attempt, "answer-api returned {e:?} ... retrying"),
            }
        }
        Err(AnswerAPIError::MaxAttemptsReached(self.max_attempts))
    }
}

const DELIMITER: &str = "=========";
impl<'a> AnswerAPIClient<'a> {
    fn build_select_prompt(&self, snippets: &[Snippet]) -> String {
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

    async fn select_snippet(&self, prompt: &str) -> super::Result<String> {
        self.send_until_success(prompt, 1, 0.0).await.map_err(|e| {
            sentry::capture_message(
                format!("answer-api failed to respond: {e}").as_str(),
                sentry::Level::Error,
            );
            super::error(ErrorKind::UpstreamService, e.to_string())
        })
    }

    async fn explain_snippet(
        &self,
        prompt: &str,
    ) -> Result<impl Stream<Item = Result<String, AnswerAPIError>>, AnswerAPIError> {
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
        self.send(prompt, max_tokens as u32, 0.9).await
    }
}
