use crate::query::parser::SemanticQuery;
use std::fmt;

use chrono::prelude::{DateTime, Utc};
use rand::seq::SliceRandom;

/// A continually updated conversation exchange.
///
/// This contains the query from the user, the intermediate steps the model takes, and the final
/// conclusion from the model alongside the answer, if any.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Default)]
pub struct Exchange {
    pub id: uuid::Uuid,
    pub query: SemanticQuery<'static>,
    pub answer: Option<String>,
    pub search_steps: Vec<SearchStep>,
    pub paths: Vec<String>,
    pub code_chunks: Vec<CodeChunk>,

    /// A specifically chosen "focused" code chunk.
    ///
    /// This is different from the `code_chunks` list, as focused code chunks also contain the full
    /// surrounding context from the source file, not just the relevant snippet.
    ///
    /// In the context of the app, this can be used to show code side-by-side with an outcome, such
    /// as when displaying an article.
    pub focused_chunk: Option<FocusedChunk>,

    #[serde(skip_serializing_if = "Option::is_none")]
    query_timestamp: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_timestamp: Option<DateTime<Utc>>,

    conclusion: Option<String>,
}

impl Exchange {
    pub fn new(id: uuid::Uuid, query: SemanticQuery<'static>) -> Self {
        Self {
            id,
            query,
            query_timestamp: Some(Utc::now()),
            ..Default::default()
        }
    }

    /// Advance this exchange.
    ///
    /// An update should not result in fewer search results or fewer search steps.
    pub fn apply_update(&mut self, update: Update) {
        match update {
            Update::StartStep(search_step) => self.search_steps.push(search_step),
            Update::ReplaceStep(search_step) => match (self.search_steps.last_mut(), search_step) {
                (Some(l @ SearchStep::Path { .. }), r @ SearchStep::Path { .. }) => *l = r,
                (Some(l @ SearchStep::Code { .. }), r @ SearchStep::Code { .. }) => *l = r,
                (Some(l @ SearchStep::Proc { .. }), r @ SearchStep::Proc { .. }) => *l = r,
                (Some(l @ SearchStep::Symbol { .. }), r @ SearchStep::Symbol { .. }) => *l = r,
                _ => panic!("Tried to replace a step that was not found"),
            },
            Update::Article(full_text) => {
                *self.answer.get_or_insert_with(String::new) = full_text;
            }
            Update::Conclude(conclusion) => {
                self.response_timestamp = Some(Utc::now());
                self.conclusion = Some(conclusion);
            }
            Update::Focus(chunk) => {
                self.focused_chunk = Some(chunk);
            }
            Update::Cancel => {
                let conclusion = [
                    "The article wasn't completed. See what's available",
                    "Your article stopped before completion. Check out the available content",
                    "The content stopped generating early. Review the initial response",
                ]
                .choose(&mut rand::thread_rng())
                .copied()
                .unwrap()
                .to_owned();

                self.conclusion = Some(conclusion);
                self.response_timestamp = Some(Utc::now());
            }
        }
    }

    /// Get the query associated with this exchange, if it has been made.
    pub fn query(&self) -> Option<String> {
        self.query.target().map(|q| q.to_string())
    }

    /// Get the answer and conclusion associated with this exchange, if a conclusion has been made.
    ///
    /// This returns a tuple of `(full_text, conclusion)`.
    pub fn answer(&self) -> Option<(&str, &str)> {
        match (&self.answer, &self.conclusion) {
            (Some(answer), Some(conclusion)) => Some((answer.as_str(), conclusion.as_str())),
            _ => None,
        }
    }

    /// Return a copy of this exchange, with all function call responses redacted.
    ///
    /// This is used to reduce the size of an exchange when we send it over the wire, by removing
    /// data that the front-end does not use.
    pub fn compressed(mut self) -> Self {
        self.code_chunks.clear();
        self.paths.clear();
        self.search_steps = self
            .search_steps
            .into_iter()
            .map(|step| step.compressed())
            .collect();

        self
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase", tag = "type", content = "content")]
#[non_exhaustive]
pub enum SearchStep {
    Path {
        query: String,
        response: String,
    },
    Code {
        query: String,
        response: String,
    },
    Proc {
        query: String,
        paths: Vec<String>,
        response: String,
    },
    Symbol {
        symbol: String,
        path: String,
        response: String,
    }
}

impl SearchStep {
    /// Create a "compressed" clone of this step, by redacting all response data.
    ///
    /// Used in `Exchange::compressed`.
    fn compressed(&self) -> Self {
        match self {
            Self::Path { query, .. } => Self::Path {
                query: query.clone(),
                response: "[hidden, compressed]".into(),
            },
            Self::Code { query, .. } => Self::Code {
                query: query.clone(),
                response: "[hidden, compressed]".into(),
            },
            Self::Proc { query, paths, .. } => Self::Proc {
                query: query.clone(),
                paths: paths.clone(),
                response: "[hidden, compressed]".into(),
            },
            Self::Symbol { symbol, path,.. } => Self::Symbol {
                symbol: symbol.clone(),
                path: path.clone(),
                response: "[hidden, compressed]".into(),
            },
        }
    }

    pub fn get_response(&self) -> String {
        match self {
            Self::Path { response, .. } => response.clone(),
            Self::Code { response, .. } => response.clone(),
            Self::Proc { response, .. } => response.clone(),
            Self::Symbol { response, .. } => response.clone(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct CodeChunk {
    pub path: String,
    #[serde(rename = "alias")]
    pub alias: usize,
    #[serde(rename = "snippet")]
    pub snippet: String,
    #[serde(rename = "start")]
    pub start_line: usize,
    #[serde(rename = "end")]
    pub end_line: usize,
}

impl CodeChunk {
    /// Returns true if a code-chunk contains an empty snippet or a snippet with only whitespace
    pub fn is_empty(&self) -> bool {
        self.snippet.trim().is_empty()
    }
}

impl fmt::Display for CodeChunk {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}: {}\n{}", self.alias, self.path, self.snippet)
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Default)]
pub struct FocusedChunk {
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
}

#[derive(Debug)]
pub enum Update {
    StartStep(SearchStep),
    ReplaceStep(SearchStep),
    Article(String),
    Conclude(String),
    Focus(FocusedChunk),
    Cancel,
}
