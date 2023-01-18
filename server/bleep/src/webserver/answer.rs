use axum::{extract::Query, response::IntoResponse, Extension, Json};
use reqwest::StatusCode;
use tracing::{error, info};
use utoipa::ToSchema;

use crate::{
    indexes::reader::ContentDocument, query::parser, segment::QueryEvent, semantic::Semantic,
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
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize)]
    pub struct DecodedResponse {
        pub index: u32,
        pub answer: String,
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize)]
    pub struct Response {
        #[serde(flatten)]
        pub data: DecodedResponse,
        pub id: String,
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
    pub snippets: Vec<api::Snippet>,
    pub selection: api::Response,
}

pub async fn handle(
    Query(params): Query<Params>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    let semantic = app
        .semantic
        .ok_or_else(|| super::error(ErrorKind::Configuration, "Qdrant not configured"))?;

    let query =
        parser::parse_nl(&params.q).map_err(|e| super::error(ErrorKind::User, e.to_string()))?;
    let target = query
        .target()
        .ok_or_else(|| super::error(ErrorKind::User, "missing search target".to_owned()))?;
    let mut snippets = semantic
        .search(&query, params.limit)
        .await
        .map_err(|e| super::error(ErrorKind::Internal, e.to_string()))?
        .into_iter()
        .map(|mut s| {
            use qdrant_client::qdrant::{value::Kind, Value};

            fn value_to_string(value: Value) -> String {
                match value.kind.unwrap() {
                    Kind::StringValue(s) => s,
                    _ => panic!("got non-string value"),
                }
            }

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
            }
        })
        .collect::<Vec<_>>();

    if snippets.is_empty() {
        return Err(super::error(
            ErrorKind::Internal,
            "semantic search returned no snippets",
        ));
    }

    let answer_api_host = format!("{}/q", app.config.answer_api_url);
    let answer_api_client = semantic.build_answer_api_client(answer_api_host.as_str(), target);

    let select_prompt = answer_api_client.build_select_prompt(&snippets);
    let relevant_snippet_index = answer_api_client
        .select_snippet(&select_prompt)
        .await
        .map_err(|e| match e.status() {
            Some(StatusCode::SERVICE_UNAVAILABLE) => super::error(
                ErrorKind::UpstreamService,
                "service is currently overloaded",
            ),
            _ => super::internal_error(e),
        })?
        .text()
        .await
        .map_err(super::internal_error)?
        .trim()
        .parse::<usize>()
        .map_err(super::internal_error)?;

    let relevant_snippet = &snippets[relevant_snippet_index];

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
        }
    };

    let explain_prompt = answer_api_client.build_explain_prompt(&processed_snippet);
    let snippet_explanation = answer_api_client
        .explain_snippet(&explain_prompt)
        .await
        .map_err(|e| match e.status() {
            Some(StatusCode::SERVICE_UNAVAILABLE) => super::error(
                ErrorKind::UpstreamService,
                "service is currently overloaded",
            ),
            _ => super::internal_error(e),
        })?
        .text()
        .await
        .map_err(super::internal_error)?;

    // reorder snippets
    snippets.swap(relevant_snippet_index, 0);

    if let Some(ref segment) = *app.segment {
        segment
            .track_query(QueryEvent {
                user_id: params.user_id.clone(),
                query: params.q.clone(),
                select_prompt,
                relevant_snippet_index,
                explain_prompt,
                explanation: snippet_explanation.clone(),
            })
            .await;
    }

    Ok::<_, Json<super::Response<'static>>>(Json(super::Response::Answer(AnswerResponse {
        snippets,
        selection: api::Response {
            data: api::DecodedResponse {
                index: 0u32, // the relevant snippet is always placed at 0
                answer: snippet_explanation,
            },
            id: params.user_id,
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
}

struct AnswerAPIClient<'s> {
    client: reqwest::Client,
    host: String,
    query: String,
    semantic: &'s Semantic,
}

impl Semantic {
    fn build_answer_api_client<'s>(&'s self, host: &str, query: &str) -> AnswerAPIClient<'s> {
        AnswerAPIClient {
            client: reqwest::Client::new(),
            host: host.to_owned(),
            query: query.to_owned(),
            semantic: self,
        }
    }
}

impl<'s> AnswerAPIClient<'s> {
    async fn send(
        &self,
        prompt: &str,
        max_tokens: u32,
    ) -> Result<reqwest::Response, reqwest::Error> {
        self.client
            .post(self.host.as_str())
            .json(&OpenAIRequest {
                prompt: prompt.to_string(),
                max_tokens,
            })
            .send()
            .await
    }
}

const DELIMITER: &str = "######";
impl<'a> AnswerAPIClient<'a> {
    fn build_select_prompt(&self, snippets: &[api::Snippet]) -> String {
        let mut prompt = snippets
            .iter()
            .enumerate()
            .map(|(i, snippet)| {
                format!(
                    "Repository: {}\nPath: {}\nLanguage: {}\nIndex: {}\n\n{}\n{DELIMITER}\n",
                    snippet.repo_name, snippet.relative_path, snippet.lang, i, snippet.text
                )
            })
            .collect::<String>();

        // the example question/answer pair helps reinforce that we want exactly a single
        // number in the output, with no spaces or punctuation such as fullstops.
        prompt += &format!(
            "\nAbove are {} code snippets separated by \"{DELIMITER}\". \
            Your job is to select the snippet that best answers the question. Reply\
            with a single number indicating the index of the snippet in the list.\
            If none of the snippets seem relevant, reply with \"0\".

            Q:What icon do we use to clear search history?
            A:3

            Q:{}
            A:",
            snippets.len(),
            self.query,
        );
        prompt
    }

    fn build_explain_prompt(&self, snippet: &api::Snippet) -> String {
        let prompt = format!(
            "
            File: {}

            {}

            #####

            Above is a code snippet.\
            Answer the user's question with a detailed response.\
            Separate each function out and explain why it is relevant.\
            Format your response in GitHub markdown with code blocks annotated\
            with programming language. Include the path of the file.

            Q:{}
            A:",
            snippet.relative_path, snippet.text, self.query
        );
        prompt
    }

    async fn select_snippet(&self, prompt: &str) -> Result<reqwest::Response, reqwest::Error> {
        self.send(prompt, 1).await
    }

    async fn explain_snippet(&self, prompt: &str) -> Result<reqwest::Response, reqwest::Error> {
        let tokens_used = self.semantic.gpt2_token_count(prompt);
        info!(%tokens_used, "input prompt token count");
        let max_tokens = 4096usize.saturating_sub(tokens_used);
        if max_tokens == 0 {
            // our prompt has overshot the token count, log an error for now
            // TODO: this should propagte to sentry
            error!(%tokens_used, "prompt overshot token limit");
        }

        // do not let the completion cross 2500 tokens
        let max_tokens = max_tokens.clamp(1, 500);
        info!(%max_tokens, "clamping max tokens");
        self.send(prompt, max_tokens as u32).await
    }
}
