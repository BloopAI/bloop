use std::{sync::Arc, time::Duration};

use super::prelude::*;
use crate::{
    env::Feature,
    indexes::{reader::ContentDocument, Indexes},
    intelligence::{code_navigation, NodeKind, ScopeGraph},
    remotes,
    repo::RepoRef,
    semantic::Semantic,
    snippet::{Snipper, Snippet},
    symbol::SymbolLocations,
    text_range::TextRange,
    Application,
};

use super::answer::api;
use super::answer::{AnswerAPIClient, AnswerAPIError, AnswerState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{sse::Event, IntoResponse, Sse},
    Extension,
};
use futures::{stream, Stream, StreamExt, TryStreamExt};
use petgraph::graph::NodeIndex;
use secrecy::ExposeSecret;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use utoipa::{IntoParams, ToSchema};

/// The request made to the `local-intel` endpoint.
#[derive(Debug, Deserialize, IntoParams)]
pub(super) struct TraceRequest {
    /// The repo_ref of the file of interest
    repo_ref: String,

    /// The path to the file of interest, relative to the repo root
    relative_path: String,

    /// The byte range to look for
    start: usize,
    end: usize,
}

#[derive(Debug, Serialize, ToSchema, Clone)]
pub(super) struct FileSymbols {
    // FIXME: choose a better name
    /// The file to which the following occurrences belong
    file: String,

    /// A collection of symbol locations with context in this file
    data: Vec<SymbolOccurrence>,
}

impl FileSymbols {
    fn is_populated(&self) -> bool {
        !self.data.is_empty()
    }

    // a range spanning the first to the last symbol in this file
    fn expanse(&self) -> Option<TextRange> {
        self.data
            .iter()
            .map(|occurrence| occurrence.range)
            .reduce(|acc, r| acc.cover(r))
    }
}

/// An occurrence of a single symbol in a document, along with some context
#[derive(Debug, Serialize, ToSchema, Clone)]
pub(super) struct SymbolOccurrence {
    /// The precise range of this symbol
    #[serde(flatten)]
    pub(super) range: TextRange,

    /// A few lines of surrounding context
    pub(super) snippet: Snippet,
}

fn handle_definition_local(
    scope_graph: &ScopeGraph,
    idx: NodeIndex<u32>,
    doc: &ContentDocument,
) -> FileSymbols {
    let file = doc.relative_path.clone();
    let handler = code_navigation::CurrentFileHandler {
        scope_graph,
        idx,
        doc,
    };
    let data = handler
        .handle_definition()
        .into_iter()
        .map(|range| to_occurrence(doc, range))
        .collect();
    FileSymbols { file, data }
}

fn handle_definition_repo_wide(
    token: &[u8],
    kind: Option<&str>,
    start_file: &str,
    all_docs: &[ContentDocument],
) -> Vec<FileSymbols> {
    all_docs
        .iter()
        .filter(|doc| doc.relative_path != start_file) // do not look in the current file
        .filter_map(|doc| match &doc.symbol_locations {
            SymbolLocations::TreeSitter(scope_graph) => {
                let file = doc.relative_path.clone();
                let handler = code_navigation::RepoWideHandler {
                    token,
                    kind,
                    scope_graph,
                    doc,
                };
                let data = handler
                    .handle_definition()
                    .into_iter()
                    .map(|range| to_occurrence(doc, range))
                    .collect();
                Some(FileSymbols { file, data })
            }
            _ => None,
        })
        .collect()
}

fn handle_reference_local(
    scope_graph: &ScopeGraph,
    idx: NodeIndex<u32>,
    doc: &ContentDocument,
) -> (FileSymbols, FileSymbols) {
    let file = &doc.relative_path;
    let handler = code_navigation::CurrentFileHandler {
        scope_graph,
        idx,
        doc,
    };
    let (defs, refs) = handler.handle_reference();
    let def_data = FileSymbols {
        file: file.clone(),
        data: defs
            .into_iter()
            .map(|range| to_occurrence(doc, range))
            .collect(),
    };
    let ref_data = FileSymbols {
        file: file.clone(),
        data: refs
            .into_iter()
            .map(|range| to_occurrence(doc, range))
            .collect(),
    };

    (def_data, ref_data)
}

fn handle_reference_repo_wide(
    token: &[u8],
    kind: Option<&str>,
    start_file: &str,
    all_docs: &[ContentDocument],
) -> (Vec<FileSymbols>, Vec<FileSymbols>) {
    all_docs
        .iter()
        .filter(|doc| doc.relative_path != start_file) // do not look in the current file
        .filter_map(|doc| match &doc.symbol_locations {
            SymbolLocations::TreeSitter(scope_graph) => {
                let file = doc.relative_path.clone();
                let handler = code_navigation::RepoWideHandler {
                    token,
                    kind,
                    scope_graph,
                    doc,
                };
                let (defs, refs) = handler.handle_reference();

                let def_data = FileSymbols {
                    file: file.clone(),
                    data: defs
                        .into_iter()
                        .map(|range| to_occurrence(doc, range))
                        .collect(),
                };
                let ref_data = FileSymbols {
                    file,
                    data: refs
                        .into_iter()
                        .map(|range| to_occurrence(doc, range))
                        .collect(),
                };

                Some((def_data, ref_data))
            }
            _ => None,
        })
        .unzip()
}

fn to_occurrence(doc: &ContentDocument, range: TextRange) -> SymbolOccurrence {
    let src = &doc.content;
    let line_end_indices = &doc.line_end_indices;
    let highlight = range.start.byte..range.end.byte;
    let snippet = Snipper::default()
        .expand(highlight, src, line_end_indices)
        .reify(src, &[]);

    SymbolOccurrence { range, snippet }
}

// helper to merge two sets of file-symbols and omit the empty results
fn merge(
    a: impl IntoIterator<Item = FileSymbols>,
    b: impl IntoIterator<Item = FileSymbols>,
) -> Vec<FileSymbols> {
    a.into_iter()
        .chain(b.into_iter())
        .filter(FileSymbols::is_populated)
        .collect()
}

#[utoipa::path(
    get,
    path = "/token-info",
    params(TraceRequest),
    responses(
        (status = 200, description = "Execute query successfully", body = TraceResponse),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn handle(
    Query(payload): Query<TraceRequest>,
    State(state): State<Arc<AnswerState>>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoResponse> {
    let repo_ref = &payload.repo_ref.parse::<RepoRef>().map_err(Error::user)?;

    let indexes = Arc::clone(&app.indexes);
    let content = &indexes
        .file
        .by_path(repo_ref, &payload.relative_path)
        .await
        .map_err(Error::user)?;

    let scope_graph = content
        .symbol_locations
        .scope_graph()
        .ok_or(Error::user("Intelligence is unavailable for this language"))?;

    let idx = scope_graph
        .node_by_range(payload.start, payload.end)
        .ok_or(Error::user("provided range is not a valid token"))?;

    let src = &content.content;
    let current_file = &content.relative_path;
    let kind = scope_graph.symbol_name_of(idx);
    let lang = content.lang.as_deref();
    let all_docs = indexes.file.by_repo(repo_ref, lang).await;

    match &scope_graph.graph[idx] {
        // if this a locally defined variable, we can produce a trace
        NodeKind::Def(d) if !scope_graph.is_top_level(idx) => {
            // the string for this definition
            let token = src[d.range.start.byte..d.range.end.byte].to_owned();
            // fetch local references with scope-graphs
            let local_references = handle_definition_local(scope_graph, idx, &content);

            let expanse_range = local_references.expanse().unwrap();

            // grow this expanse by 1 line
            //
            // TODO: reuse webserver::answer::grow
            let expanse = {
                let new_start_byte = src
                    .get(..expanse_range.start.byte)
                    .unwrap()
                    .rmatch_indices('\n')
                    .map(|(idx, _)| idx)
                    .next()
                    .unwrap_or(0);

                // skip downwards `size` number of lines
                let new_end_byte = src
                    .get(expanse_range.end.byte..)
                    .unwrap()
                    .match_indices('\n')
                    .map(|(idx, _)| idx)
                    .next()
                    .map(|s| s.saturating_add(expanse_range.end.byte)) // the index is off by `snippet.end_byte`
                    .unwrap_or(src.len());

                src.get(new_start_byte..new_end_byte)
                    .unwrap()
                    .lines()
                    .zip(expanse_range.start.line.saturating_sub(1)..)
                    .map(|(l, idx)| format!("{idx} {l}"))
                    .collect::<Vec<_>>()
                    .join("\n")
            };

            let stream = gpt_handler(
                &app,
                Arc::clone(&state),
                &[to_occurrence(&content, d.range)],
                local_references.data.as_slice(),
                expanse.as_str(),
            )
            .await;

            return Ok(Sse::new(stream));
        }

        // we are at a reference, do the following:
        //
        // - find local defs,
        NodeKind::Ref(r) => {
            // the string for this ref
            let token = src[r.range.start.byte..r.range.end.byte].to_owned();

            let (local_definitions, local_references) =
                handle_reference_local(scope_graph, idx, &content);

            let expanse_range = local_references
                .expanse()
                .and_then(|r_expanse| {
                    local_definitions
                        .expanse()
                        .map(|d_expanse| r_expanse.cover(d_expanse))
                })
                .unwrap();

            // grow this expanse by 1 line
            //
            // TODO: reuse webserver::answer::grow
            let expanse = {
                let new_start_byte = src
                    .get(..expanse_range.start.byte)
                    .unwrap()
                    .rmatch_indices('\n')
                    .map(|(idx, _)| idx)
                    .next()
                    .unwrap_or(0);

                // skip downwards `size` number of lines
                let new_end_byte = src
                    .get(expanse_range.end.byte..)
                    .unwrap()
                    .match_indices('\n')
                    .map(|(idx, _)| idx)
                    .next()
                    .map(|s| s.saturating_add(expanse_range.end.byte)) // the index is off by `snippet.end_byte`
                    .unwrap_or(src.len());

                src.get(new_start_byte..new_end_byte)
                    .unwrap()
                    .lines()
                    .zip(expanse_range.start.line.saturating_sub(1)..)
                    .map(|(l, idx)| format!("{idx} {l}"))
                    .collect::<Vec<_>>()
                    .join("\n")
            };

            let stream = gpt_handler(
                &app,
                Arc::clone(&state),
                local_definitions.data.as_slice(),
                local_references.data.as_slice(),
                expanse.as_str(),
            )
            .await;

            return Ok(Sse::new(stream));
        }
        _ => Err(Error::user(
            "provided range is not eligible for intelligence",
        )),
    }
}

async fn build_trace_prompt(
    definitions: &[SymbolOccurrence],
    references: &[SymbolOccurrence],
    expanse: &str,
) -> api::Messages {
    let symbol_listing = definitions
        .iter()
        .map(|d| {
            format!(
                "`{}` defined or imported in line {}: `{}`",
                d.snippet.highlight_strs()[0],
                d.snippet.line_range.start,
                d.snippet.data.trim()
            )
        })
        .chain(references.iter().map(|r| {
            format!(
                "`{}` referenced in line {}: `{}`",
                r.snippet.highlight_strs()[0],
                r.snippet.line_range.start,
                r.snippet.data.trim()
            )
        }))
        .zip(1..)
        .map(|(s, idx)| format!("{idx}. {s}\n"))
        .collect::<String>();

    let mut prompt = r#"Below is an excerpt from a file along with a list of occurrences of a variable of interest. \
Trace the variable step-by-step. \
Each step must not be more than a sentence in length. \
For example:
Excerpt:
1 let mut grow_size = 40;
2 let grown_text = loop {
3     if let Some(grown_text) = grow(&doc, relevant_snippet, grow_size) {
4         let token_count = semantic.gpt2_token_count(&grown_text);
5         info!(%grow_size, %token_count, "growing ...");
6         if token_count > 6000 || grow_size > 100 {
7             break grown_text;
8         } else {
9             grow_size += 10;
===========
Occurrences:
1. `grow_size` defined or imported in line 1: `let mut grow_size = 40;`
2. `grow_size` referenced in line 3: `if let Some(grown_text) = grow(&doc, relevant_snippet, grow_size) {`
3. `grow_size` referenced in line 6: `if token_count > 6000 || grow_size > 100 {`
4. `grow_size` referenced in line 9: `grow_size += 10;`
===========
Output:
1. `grow_size` is initialized to 40.
2. Then it is passed to the `grow` function to produce `grown_text`.
3. We then check if `grow_size` has exceeded 100 in a loop.
4. If it has, we break out of the loop, if not, we increment it by 10 and continue.

Now, complete the answer for the given excerpt.
"#.to_string();

    prompt.push_str("Excerpt:\n");
    prompt.push_str(expanse);

    prompt.push_str("\n===========\n");
    prompt.push_str("Occurrences:\n");
    prompt.push_str(&symbol_listing);
    prompt.push_str("\n===========\n");
    prompt.push_str("Output:\n");

    let messages = vec![api::Message {
        role: "user".into(),
        content: prompt,
    }];

    api::Messages { messages }
}

async fn gpt_handler(
    app: &Application,
    state: Arc<AnswerState>,
    definitions: &[SymbolOccurrence],
    references: &[SymbolOccurrence],
    expanse: &str,
) -> impl Stream<Item = Result<Event, AnswerAPIError>> {
    let answer_bearer = if app.env.allow(Feature::GithubDeviceFlow) {
        let Some(cred) = app.credentials.github() else {
            panic!("no gh token");
        };

        use remotes::github::{Auth, State};
        match cred {
            State {
                auth:
                    Auth::OAuth {
                        access_token: token,
                        ..
                    },
                ..
            } => Some(token.expose_secret().clone()),

            State {
                auth: Auth::App { .. },
                ..
            } => {
                panic!("cannot connect to answer API using installation token")
            }
        }
    } else {
        None
    };

    let semantic = app.semantic.clone().expect("qdrant not configured");

    let answer_api_client = semantic.build_answer_api_client(
        &*state,
        format!("{}/v1/q", app.config.answer_api_url).as_str(),
        5,
        answer_bearer.clone(),
    );

    let prompt = build_trace_prompt(definitions, references, expanse).await;
    answer_api_client
        .send(prompt, 200, 0.0, api::Provider::OpenAi, vec![])
        .await
        .unwrap()
        .map(|result| {
            Ok(Event::default()
                .json_data(result.as_ref().map_err(|e| e.to_string()))
                .unwrap())
        })
        .chain(futures::stream::once(async {
            Ok(Event::default().data("[DONE]"))
        }))
}
