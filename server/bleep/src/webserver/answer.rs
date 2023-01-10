use crate::query::parser;
use axum::{extract::Query, response::IntoResponse, Extension, Json};
use utoipa::ToSchema;

use crate::Application;

use super::ErrorKind;

/// Mirrored from `answer_api/lib.rs` to avoid private dependency.
mod api {
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
        pub relative_path: String,
        pub text: String,
        pub start_line: usize,
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

#[derive(Debug, serde::Deserialize)]
pub struct Params {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: u64,
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
    let query =
        parser::parse_nl(&params.q).map_err(|e| super::error(ErrorKind::User, e.to_string()))?;
    let target = query.target().ok_or(super::error(
        ErrorKind::User,
        "missing search target".to_owned(),
    ))?;
    let mut snippets = app
        .semantic
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
                relative_path: value_to_string(s.remove("relative_path").unwrap()),
                text: value_to_string(s.remove("snippet").unwrap()),
                start_line: value_to_string(s.remove("start_line").unwrap())
                    .parse::<usize>()
                    .unwrap(),
            }
        })
        .collect::<Vec<_>>();

    if snippets.len() < 1 {
        super::error(ErrorKind::Internal, "semantic search returned no snippets");
    }

    let answer_api_client = AnswerAPIClient::new(
        &format!("{}/q", app.config.answer_api_base),
        &target,
        &params.user_id,
    );

    let res1 = answer_api_client
        .stage_1(&snippets)
        .await
        .map_err(|e| super::error(ErrorKind::Internal, e.to_string()))?
        .index;

    let processed_snippet = &snippets[res1];

    let res2 = answer_api_client
        .stage_2(processed_snippet)
        .await
        .map_err(|e| super::error(ErrorKind::Internal, e.to_string()))?
        .answer;

    // reorder snippets
    let selected_snippet = snippets.remove(res1);
    snippets.insert(0, selected_snippet);

    Ok::<_, Json<super::Response<'static>>>(Json(super::Response::Answer(AnswerResponse {
        snippets,
        selection: api::Response {
            data: api::DecodedResponse {
                index: res1 as u32,
                answer: res2,
            },
            id: params.user_id,
        },
    })))
}

#[derive(serde::Serialize)]
struct OpenAIRequest {
    prompt: String,
    user_id: String,
}

struct AnswerAPIClient {
    client: reqwest::Client,
    host: String,
    query: String,
    user_id: String,
}

impl AnswerAPIClient {
    fn new(host: &str, query: &str, user_id: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            host: host.to_owned(),
            query: query.to_owned(),
            user_id: user_id.to_owned(),
        }
    }

    async fn send(&self, prompt: String) -> Result<reqwest::Response, reqwest::Error> {
        self.client
            .post(self.host.as_str())
            .json(&OpenAIRequest {
                prompt: prompt.clone(),
                user_id: self.user_id.clone(),
            })
            .send()
            .await
    }
}

#[derive(serde::Deserialize)]
struct Stage1Response {
    index: usize,
}

#[derive(serde::Deserialize)]
struct Stage2Response {
    answer: String,
}

const DELIMITER: &str = "######";
impl AnswerAPIClient {
    async fn stage_1(&self, snippets: &[api::Snippet]) -> Result<Stage1Response, reqwest::Error> {
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

        prompt += &format!(
            "\nAbove are {} code snippets separated by \"{DELIMITER}\". \
            Your job is to answer which snippet index best answers the question. Your\
            reply must obey the JSON schema {{ \"index\": number}}.

            Q: What icon do we use to clear search history?
            A: {{ \"index\": 0 }}

            Q: {}
            A:",
            snippets.len(),
            self.query,
        );

        self.send(prompt).await?.json::<Stage1Response>().await
    }

    async fn stage_2(&self, snippet: &api::Snippet) -> Result<Stage2Response, reqwest::Error> {
        let prompt = format!(
            "
            File: {}

            {}

            #####

            Above is a code snippet.\
            Your job is to answer the questions about the snippet,\
            giving detailed explanations. Cite any code used to\
            answer the question formatted in GitHub markdown and state the file path.\
            Your reply must obey the JSON schema {{ \"answer\": string }}

            Q: What icon do we use to clear search history?
            A: {{ \"answer\": \"We use the left-double chevron icon.\" }}

            Q: {}
            A:",
            snippet.relative_path, snippet.text, self.query
        );

        self.send(prompt).await?.json::<Stage2Response>().await
    }
}
