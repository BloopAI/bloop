use std::{collections::HashMap, sync::Arc, time::Duration};

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
pub(super) struct TokenInfoRequest {
    /// The repo_ref of the file of interest
    repo_ref: String,

    /// The path to the file of interest, relative to the repo root
    relative_path: String,

    /// The byte range to look for
    start: usize,
    end: usize,
}

/// The response from the `local-intel` endpoint.
#[derive(Serialize, ToSchema, Clone)]
pub(super) struct TokenInfoResponse {
    data: Vec<FileSymbols>,
}

impl super::ApiResponse for TokenInfoResponse {}

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
    fn flatten(&self) -> Vec<(String, SymbolOccurrence)> {
        let mut data = vec![];
        for item in &self.data {
            data.push((self.file.clone(), item.clone()))
        }
        data
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

    pub(super) kind: Option<OccurrenceKind>,
}

impl SymbolOccurrence {
    fn set_kind(&mut self, kind: OccurrenceKind) {
        self.kind = Some(kind);
    }
}

#[derive(Debug, Serialize, ToSchema, Copy, Clone)]
#[serde(rename_all = "lowercase")]
pub(super) enum OccurrenceKind {
    Definition,
    Reference,
    Modification,
    Return,
}

impl TryFrom<usize> for OccurrenceKind {
    type Error = ();
    fn try_from(value: usize) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::Definition),
            2 => Ok(Self::Reference),
            3 => Ok(Self::Modification),
            4 => Ok(Self::Return),
            _ => Err(()),
        }
    }
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
        .context(0, 3)
        .expand(highlight, src, line_end_indices)
        .reify(src, &[]);

    SymbolOccurrence {
        range,
        snippet,
        kind: None,
    }
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
    params(TokenInfoRequest),
    responses(
        (status = 200, description = "Execute query successfully", body = TokenInfoResponse),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn handle(
    Query(payload): Query<TokenInfoRequest>,
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

    let scope_graph = match content.symbol_locations {
        SymbolLocations::TreeSitter(ref graph) => graph,
        _ => return Err(Error::user("Intelligence is unavailable for this language")),
    };

    let node = scope_graph.node_by_range(payload.start, payload.end);

    let idx = match node {
        None => return Err(Error::user("provided range is not a valid token")),
        Some(idx) => idx,
    };

    let src = &content.content;
    let current_file = &content.relative_path;
    let kind = scope_graph.symbol_name_of(idx);
    let lang = content.lang.as_deref();
    let all_docs = indexes.file.by_repo(repo_ref, lang).await;

    match &scope_graph.graph[idx] {
        // we are already at a def
        // - find refs from the current file
        // - find refs from other files
        NodeKind::Def(d) => {
            // fetch local references with scope-graphs
            let local_references = handle_definition_local(scope_graph, idx, &content);

            // fetch repo-wide references with trivial search, only if the def is
            // a top-level def (typically functions, ADTs, consts)
            let repo_wide_references = if scope_graph.is_top_level(idx) {
                let token = d.name(src.as_bytes());
                handle_definition_repo_wide(token, kind, current_file, &all_docs)
            } else {
                vec![]
            };

            // merge the two
            let references = merge([local_references], repo_wide_references);

            let selections = gpt_handler(&app, Arc::clone(&state), &references).await;
            let flattened = references
                .into_iter()
                .flat_map(|fs| fs.flatten())
                .collect::<Vec<_>>();
            let mut selected = vec![];

            for (selected_idx, kind) in selections {
                let (item_path, mut item) = flattened[selected_idx - 1].clone();
                if let Some(kind) = OccurrenceKind::try_from(kind).ok() {
                    item.set_kind(kind);
                };
                selected.push((item_path, item));
            }

            let file_symbols: Vec<FileSymbols> = selected
                .into_iter()
                .fold(HashMap::new(), |mut map, (item_path, item)| {
                    map.entry(item_path).or_insert_with(Vec::new).push(item);
                    map
                })
                .into_iter()
                .map(|(k, v)| FileSymbols { file: k, data: v })
                .collect::<Vec<_>>();

            Ok(json(TokenInfoResponse { data: file_symbols }))
        }

        // we are at a reference:
        // - find def from the current file
        // - find defs from other files
        // - find refs from the current file
        // - find refs from other files
        //
        // the ordering here prefers occurrences from the current file, over occurrences
        // from other files.
        NodeKind::Ref(r) => {
            // fetch local (defs, refs) with scope-graphs
            let (local_definitions, local_references) =
                handle_reference_local(scope_graph, idx, &content);

            // fetch repo-wide (defs, refs) with trivial search
            let token = r.name(src.as_bytes());
            let (repo_wide_definitions, repo_wide_references) =
                handle_reference_repo_wide(token, kind, current_file, &all_docs);

            // merge the two
            let definitions = merge([local_definitions], repo_wide_definitions);
            let references = merge([local_references], repo_wide_references);

            let all_symbols = merge(definitions, references);

            let selections = gpt_handler(&app, Arc::clone(&state), &all_symbols).await;
            let flattened = all_symbols
                .into_iter()
                .flat_map(|fs| fs.flatten())
                .collect::<Vec<_>>();
            let mut selected = vec![];

            for (selected_idx, kind) in selections {
                let (item_path, mut item) = flattened[selected_idx - 1].clone();
                if let Some(kind) = OccurrenceKind::try_from(kind).ok() {
                    item.set_kind(kind);
                };
                selected.push((item_path, item));
            }

            let file_symbols: Vec<FileSymbols> = selected
                .into_iter()
                .fold(HashMap::new(), |mut map, (item_path, item)| {
                    map.entry(item_path).or_insert_with(Vec::new).push(item);
                    map
                })
                .into_iter()
                .map(|(k, v)| FileSymbols { file: k, data: v })
                .collect::<Vec<_>>();

            Ok(json(TokenInfoResponse { data: file_symbols }))
        }
        _ => Err(Error::user(
            "provided range is not eligible for intelligence",
        )),
    }
}

const DELIMITER: &str = "=====";
async fn gpt_filter(file_symbols: &[FileSymbols]) -> api::Messages {
    let symbols = file_symbols
        .iter()
        .flat_map(|fs| fs.flatten())
        .zip(1..)
        .map(|((file, occurrence), idx)| {
            let name = occurrence.snippet.highlight_strs()[0];
            format!(
                "{}. `{}` in file `{}`:\n{}\n=====\n",
                idx, name, file, occurrence.snippet.data
            )
        })
        .collect::<String>();
    let mut prompt = r#"Below are a list of snippets separated by `=====`. Your job is to annotate these snippets as one 
of the following: 1 for Definition, 2 for Reference, 3 for Modification and 4 for Returned, from the perspective of the 
SUBJECT in the snippet:
- Definition: the SUBJECT is being defined in this snippet
- Reference: the SUBJECT is being referenced in this snippet
- Modification: the SUBJECT is being modified in this snippet
- Returned: the SUBJECT is being returned in this snippet

Typically a definition occurs on the LHS of an equal-to sign ('='), or occurs in a declaration such as a class declaration.
Typically, a modification is a situation where the SUBJECT is being mutated. Things like method calls upon the SUBJECT may 
be considered to be modifications, whereas, passing the SUBJECT into a function may be considered a plain reference. 
You may classify a snippet as a return if the SUBJECT is prefixed by a return keyword, or if the SUBJECT occurs as the last 
statement in the execution of that function.

Also filter out those snippets which are irrelevant, such as imports of the SUBJECT.

For example, if given the following list of snippets, with `HashMap` as the SUBJECT:

1. `HashMap` in file `src/main.rs`
use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::BTreeSet;

2. `HashMap` in file `src/map.rs`
struct HashMap<T> {
    bucket: Vec<T>,
    capacity: usize

3. `HashMap` in file `src/util.rs`
use crate::map::HashMap;

4. `HashMap` in file `src/util.rs`
let util: HashMap<T, V> = HashMap::new();

Output:[[2,1],[4,2]]

Now, complete the answer for the given snippets:

"#.to_string();
    prompt.push_str(&symbols);
    prompt.push_str("\nOutput:");

    let messages = vec![api::Message {
        role: "user".into(),
        content: prompt,
    }];

    api::Messages { messages }
}

async fn gpt_handler(
    app: &Application,
    state: Arc<AnswerState>,
    file_symbols: &[FileSymbols],
) -> Vec<(usize, usize)> {
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

    let prompt = gpt_filter(file_symbols).await;
    let answer = answer_api_client
        .send(prompt, 50, 0.0, api::Provider::OpenAi, vec![])
        .await
        .unwrap()
        .try_collect::<String>()
        .await
        .unwrap();
    let selections: Vec<(usize, usize)> =
        serde_json::from_str(&answer).unwrap_or_else(|_| Vec::new());
    selections
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::text_range::Point;

    #[test]
    fn serialize_response_reference() {
        let expected = serde_json::json!({
            "kind": "reference",
            "definitions": [{
                "file": "server/bleep/src/symbol.rs",
                "data": [{
                    "start": { "byte": 2620, "line": 90, "column": 0  },
                    "end": { "byte": 2627, "line": 90, "column": 0  },
                    "snippet": {
                        "highlights": [ { "start": 12, "end": 19 } ],
                        "data": "        let indexes = Indexes::new(self.clone(), threads).await?;\n",
                        "line_range": { "start": 91, "end": 92 },
                        "symbols": [],
                    }
                }]
            }],
            "references": [{
                "file": "server/bleep/src/intelligence/scope_resolution.rs",
                "data": [{
                    "start": { "byte": 2725, "line": 93, "column": 0  },
                    "end": { "byte": 2732, "line": 93, "column": 0  },
                    "snippet": {
                        "highlights": [ { "start": 12, "end": 19 } ],
                        "symbols": [],
                        "line_range": { "start": 94, "end": 95 },
                        "data": "            indexes.reindex().await?;\n"
                    }
                }]
            }]
        });

        let observed = serde_json::to_value(TokenInfoResponse::Reference {
            definitions: vec![FileSymbols {
                file: "server/bleep/src/symbol.rs".into(),
                data: vec![SymbolOccurrence {
                    range: TextRange {
                        start: Point {
                            byte: 2620,
                            line: 90,
                            column: 0,
                        },
                        end: Point {
                            byte: 2627,
                            line: 90,
                            column: 0,
                        },
                    },
                    snippet: Snippet {
                        line_range: 91..92,
                        data: "        let indexes = Indexes::new(self.clone(), threads).await?;\n"
                            .to_owned(),
                        highlights: vec![12..19],
                        symbols: vec![],
                    },
                }],
            }],
            references: vec![FileSymbols {
                file: "server/bleep/src/intelligence/scope_resolution.rs".into(),
                data: vec![SymbolOccurrence {
                    range: TextRange {
                        start: Point {
                            byte: 2725,
                            line: 93,
                            column: 0,
                        },
                        end: Point {
                            byte: 2732,
                            line: 93,
                            column: 0,
                        },
                    },
                    snippet: Snippet {
                        line_range: 94..95,
                        data: "            indexes.reindex().await?;\n".to_owned(),
                        highlights: vec![12..19],
                        symbols: vec![],
                    },
                }],
            }],
        })
        .unwrap();

        pretty_assertions::assert_eq!(expected, observed)
    }

    #[test]
    fn serialize_response_definition() {
        let expected = serde_json::json!({
            "kind": "definition",
            "references": [{
                "file": "server/bleep/benches/snippets.rs",
                "data": [{
                    "start": { "byte": 2725, "line": 93, "column": 0 },
                    "end": { "byte": 2732, "line": 93, "column": 0  },
                    "snippet": {
                        "highlights": [ { "start": 12, "end": 19 } ],
                        "line_range": { "start": 94, "end": 95 },
                        "data": "            indexes.reindex().await?;\n",
                        "symbols": []
                    }
                }]
            }]
        });

        let observed = serde_json::to_value(TokenInfoResponse::Definition {
            references: vec![FileSymbols {
                file: "server/bleep/benches/snippets.rs".into(),
                data: vec![SymbolOccurrence {
                    range: TextRange {
                        start: Point {
                            byte: 2725,
                            line: 93,
                            column: 0,
                        },
                        end: Point {
                            byte: 2732,
                            line: 93,
                            column: 0,
                        },
                    },
                    snippet: Snippet {
                        line_range: 94..95,
                        data: "            indexes.reindex().await?;\n".to_owned(),
                        highlights: vec![12..19],
                        symbols: vec![],
                    },
                }],
            }],
        })
        .unwrap();

        assert_eq!(expected, observed)
    }
}
