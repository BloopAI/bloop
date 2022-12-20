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
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
    pub struct Snippet {
        pub path: String,
        pub text: String,
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize)]
    pub struct Response {
        pub index: u32,
        pub answer: String,
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct Params {
    pub q: String,
}

#[derive(serde::Serialize, ToSchema)]
pub struct AnswerResponse {
    pub snippets: Vec<api::Snippet>,
    pub selection: api::Response,
}

fn sample_snippets() -> Vec<api::Snippet> {
    vec![
        api::Snippet {
            path: "server/bleep/Cargo.toml".into(),
            text: r#"[dependencies]
git2 = "0.15.0"
serde = "1.0.147"
regex = "1.7.0"
regex-syntax = "0.6.28"
smallvec = { version = "1.10.0", features = ["serde"]}
async-trait = "0.1.58"
flume = "0.10.14"
dashmap = { version = "5.4.0", features = ["serde"] }
either = "1.8.0"
compact_str = "0.6.1"
bincode = "1.3.3"
directories = "4.0.1"
chrono = { version = "0.4.23", features = ["serde"], default-features = false }
phf = "0.11.1"
rand = "0.8.5"
once_cell = "1.16.0"
replace_with = "0.1.7"
relative-path = "1.7.2"
dunce = "1.0.3""#
                .into(),
        },
        api::Snippet {
            path: "client/package.json".into(),
            text: r#""dependencies": {
    "@segment/analytics-next": "^1.46.3",
    "@sentry/react": "^7.23.0",
    "@sentry/tracing": "^7.23.0",
    "@tailwindcss/line-clamp": "^0.4.2",
    "@tippyjs/react": "^4.2.6",
    "axios": "^1.1.3",
    "chart.js": "^3.9.1",
    "date-fns": "^2.29.3",
    "downshift": "^6.1.10",
    "file-icons-js": "^1.1.0",
    "framer-motion": "^7.6.2",
    "lodash.debounce": "^4.0.8",
    "lodash.throttle": "^4.1.1",
    "msw-storybook-addon": "^1.6.3",
    "prismjs": "^1.29.0",
    "react": "^18.2.0",
    "react-chartjs-2": "^4.3.1",
    "react-dom": "^18.2.0",
    "react-draggable": "^4.4.5",
    "react-router-dom": "^6.4.1",
    "react-virtualized": "^9.22.3",
    "remarkable": "^2.0.1",
    "textarea-caret": "^3.1.0",
    "timeago.js": "^4.0.2"
  },"#
            .into(),
        },
        api::Snippet {
            path: "server/bleep/src/bin/bleep.rs".into(),
            text: r#"use anyhow::Result;
use bleep::{Application, Configuration, Environment};

#[tokio::main]
async fn main() -> Result<()> {
    let app = Application::initialize(Environment::Server, Configuration::from_cli()?)?;
    app.run().await
}"#
            .into(),
        },
    ]
}

pub async fn handle(
    Query(params): Query<Params>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    let snippets = sample_snippets();

    let res = reqwest::Client::new()
        .post(format!("http://{}/q", app.config.answer_api_host))
        .json(&api::Request {
            query: params.q,
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

    Ok::<_, Json<super::Response<'static>>>(Json(super::Response::Answer(AnswerResponse {
        snippets,
        selection: res.json().await.map_err(|e| {
            super::error(
                ErrorKind::Internal,
                format!("got bad answer API response: {}", e),
            )
        })?,
    })))
}
