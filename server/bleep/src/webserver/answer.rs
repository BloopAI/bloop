use axum::{extract::Query, response::IntoResponse, Extension, Json};
use ndarray::Axis;
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
    30
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
    let snippets = app
        .semantic
        .search(&params.q, params.limit)
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

    // rerank results and get the top 5
    let mut snippets = rank(&params.q, snippets, &app, 5);

    let res = reqwest::Client::new()
        .post(format!("{}/q", app.config.answer_api_base))
        .json(&api::Request {
            query: params.q,
            user_id: params.user_id,
            snippets: snippets.clone(),
        })
        .send()
        .await
        .map_err(|e| {
            super::error(
                ErrorKind::Internal,
                format!("failed to make request to answer API: {}", e),
            )
        })?;

    let selection: api::Response = res.json().await.map_err(|e| {
        super::error(
            ErrorKind::Internal,
            format!("answer API was not able to create a valid result: {}", e),
        )
    })?;

    let selected_snippet = snippets.remove(selection.data.index as usize);
    snippets.insert(0, selected_snippet);

    Ok::<_, Json<super::Response<'static>>>(Json(super::Response::Answer(AnswerResponse {
        snippets,
        selection,
    })))
}

fn rank(
    query: &str,
    snippets: Vec<api::Snippet>,
    app: &Application,
    max_results: usize,
) -> Vec<api::Snippet> {
    // number of ranked results
    let k = std::cmp::min(max_results, snippets.len());

    let mut scores: Vec<(usize, (api::Snippet, f32))> = snippets
        .into_iter()
        .map(|snippet| {
            let tokens = app
                .semantic
                .rank_tokenizer
                .encode((query, snippet.text.as_str()), true)
                .unwrap();
            let logit = app
                .semantic
                .encode(&tokens, app.semantic.rank_session.clone())
                .unwrap()
                .remove_axis(Axis(0))[0];
            // normalise snippet score
            let score = 1. / (1. + (logit.exp()));
            (snippet, score)
        })
        .enumerate()
        .collect();

    // sort snippets by reranker score
    scores.sort_by(|a, b| {
        let (_, (_, score_a)) = a;
        let (_, (_, score_b)) = b;
        score_a.partial_cmp(score_b).unwrap()
    });

    scores[..k]
        .into_iter()
        .map(|s| {
            let (_, (snippet, _)) = s;
            snippet.clone()
        })
        .collect()
}
