use std::sync::Arc;

use super::prelude::*;
use crate::{
    indexes::{
        reader::{ContentReader, FileReader, RepoReader},
        Indexes,
    },
    query::{
        execute::{ApiQuery, ExecuteQuery, QueryResult},
        parser,
        parser::{Literal, Target},
    },
};

use axum::{extract::Query, response::IntoResponse as IntoAxumResponse, Extension};
use futures::{stream, StreamExt, TryStreamExt};
use serde::Serialize;

pub(super) async fn handle(
    Query(mut api_params): Query<ApiQuery>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> Result<impl IntoAxumResponse> {
    // Override page_size and set to low value
    api_params.page = 0;
    api_params.page_size = 3;

    let queries = parser::parse(&api_params.q).map_err(Error::user)?;
    let mut autocomplete_results = vec![];

    // Only execute prefix search on flag names if there is a non-regex content target.
    // Always matches against the last query.
    //
    //      `la repo:bloop or sy` -> search with prefix `sy`
    //      `repo:bloop re path:src` -> search with prefix `re`
    if let Some(Target::Content(Literal::Plain(q))) = queries.last().unwrap().target.clone() {
        autocomplete_results.append(
            &mut complete_flag(&q)
                .map(|f| QueryResult::Flag(f.to_string()))
                .collect(),
        );
    }

    // Bypass the parser and execute a prefix search using the last whitespace-split token
    // in the query string.
    //
    // This should be revisited when we implement cursor-aware autocomplete.
    //
    //      `api lang:p` -> search lang list with prefix `p`
    //      `lang:p api` -> lang prefix search not triggered
    if let Some(matched_langs) = complete_lang(&api_params.q) {
        autocomplete_results.append(
            &mut matched_langs
                .map(|l| QueryResult::Lang(l.to_string()))
                .collect(),
        );
    }

    // If no flags completion, run a search with full query
    if autocomplete_results.is_empty() {
        let contents = ContentReader.execute(&indexes.file, &queries, &api_params);
        let repos = RepoReader.execute(&indexes.repo, &queries, &api_params);
        let files = FileReader.execute(&indexes.file, &queries, &api_params);

        autocomplete_results = stream::iter([contents, repos, files])
            // Buffer several readers at the same time. The exact number is not important; this is
            // simply an upper bound.
            .buffered(10)
            .try_fold(Vec::new(), |mut a, e| async {
                a.extend(e.data.into_iter());
                Ok(a)
            })
            .await
            .map_err(Error::internal)?;
    }

    let count = autocomplete_results.len();
    let data = autocomplete_results;
    let response = AutocompleteResponse { count, data };

    Ok(json(response))
}

fn complete_flag(q: &str) -> impl Iterator<Item = &str> + '_ {
    QUERY_FLAGS
        .iter()
        .filter(move |f| f.starts_with(q))
        .copied()
}

fn complete_lang(q: &str) -> Option<impl Iterator<Item = &str> + '_> {
    match q.split_whitespace().last() {
        Some(last) => last.strip_prefix("lang:").map(|prefix| {
            COMMON_LANGUAGES
                .iter()
                .filter(move |l| l.starts_with(prefix))
                .copied()
        }),
        _ => None,
    }
}

#[derive(Serialize)]
pub(super) struct AutocompleteResponse {
    count: usize,
    data: Vec<QueryResult>,
}

impl super::ApiResponse for AutocompleteResponse {}

const QUERY_FLAGS: &[&str; 8] = &[
    "repo", "path", "content", "symbol", "lang", "case", "or", "open",
];

// List of common languages
const COMMON_LANGUAGES: &[&str] = &[
    "webassembly",
    "basic",
    "makefile",
    "groovy",
    "haskell",
    "idris",
    "typescript",
    "r",
    "javascript",
    "llvm",
    "jsonnet",
    "lua",
    "awk",
    "solidity",
    "nim",
    "hcl",
    "julia",
    "ada",
    "verilog",
    "python",
    "go",
    "sql",
    "plsql",
    "fortran",
    "erlang",
    "mathematica",
    "rust",
    "coffeescript",
    "zig",
    "scala",
    "tsx",
    "ruby",
    "apl",
    "c",
    "tcl",
    "kotlin",
    "vba",
    "matlab",
    "hack",
    "ocaml",
    "prolog",
    "scheme",
    "dockerfile",
    "assembly",
    "clojure",
    "shell",
    "java",
    "c++",
    "php",
    "perl",
    "vbscript",
    "d",
    "pascal",
    "elm",
    "swift",
    "cuda",
    "dart",
    "elixir",
    "c#",
    "objective-c",
    "coq",
    "forth",
    "cmake",
    "nix",
    "objective-c++",
    "actionscript",
];
