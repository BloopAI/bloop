use std::{collections::HashMap, sync::Arc};

use super::prelude::*;
use crate::{
    indexes::{
        reader::{ContentReader, FileReader, RepoReader},
        Indexes,
    },
    query::{
        execute::{ApiQuery, ExecuteQuery, QueryResult},
        languages, parser,
        parser::{Literal, Target},
    },
};

use axum::{extract::Query, response::IntoResponse as IntoAxumResponse, Extension};
use futures::{stream, StreamExt, TryStreamExt};
use serde::Serialize;

fn default_true() -> bool {
    true
}

#[derive(Deserialize)]
pub struct AutocompleteParams {
    #[serde(default = "default_true")]
    search_bar_complete: bool,
}

pub(super) async fn handle(
    Query(mut api_params): Query<ApiQuery>,
    Query(ac_params): Query<AutocompleteParams>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> Result<impl IntoAxumResponse> {
    // Override page_size and set to low value
    api_params.page = 0;
    api_params.page_size = 8;

    let mut partial_lang = None;

    let queries = parser::parse(&api_params.q)
        .map_err(Error::user)?
        .into_iter()
        .map(|mut q| {
            if !ac_params.search_bar_complete {
                // Do not autocomplete on content for @ commands
                q.target = None;

                if q.path.is_none() {
                    q.path = Some(Literal::Regex(".*".into()));
                }
            }

            if let Some(lang) = q.lang.as_ref().map(|l| l.to_lowercase()) {
                partial_lang = Some(lang.clone());
            }

            q
        })
        .collect::<Vec<_>>();

    let mut results = vec![];

    // Only execute prefix search on flag names if there is a non-regex content target.
    // Always matches against the last query.
    //
    //      `la repo:bloop or sy` -> search with prefix `sy`
    //      `repo:bloop re path:src` -> search with prefix `re`
    dbg!(&queries);
    dbg!(&queries.last());
    if let Some(Target::Content(Literal::Plain(q))) = queries.last().unwrap().target.clone() {
        dbg!(&q);
        results.append(
            &mut complete_flag(&q)
                .map(|f| QueryResult::Flag(f.to_string()))
                .collect(),
        );
    }

    let mut executors = vec![];
    // Only executed for literal autocomplete
    if ac_params.search_bar_complete {
        executors.push(ContentReader.execute(&indexes.file, &queries, &api_params));
    }
    executors.push(RepoReader.execute(&indexes.repo, &queries, &api_params));
    executors.push(FileReader.execute(&indexes.file, &queries, &api_params));

    let (langs, list) = stream::iter(executors)
        // Buffer several readers at the same time. The exact number is not important; this is
        // simply an upper bound.
        .buffered(10)
        .try_fold(
            (HashMap::<String, usize>::new(), Vec::new()),
            |(mut langs, mut list), e| async {
                for (lang, count) in e.stats.lang {
                    // The exact number here isn't relevant, and
                    // this may be off.
                    //
                    // We're trying to scale the results compared
                    // to each other which means this will still
                    // serve the purpose for ranking.
                    *langs.entry(lang).or_default() += count;
                }
                list.extend(e.data.into_iter());
                Ok((langs, list))
            },
        )
        .await
        .map_err(Error::internal)?;

    results.extend(
        list.into_iter()
            .filter(|q| ac_params.search_bar_complete || !matches!(q, QueryResult::Snippets(_))),
    );

    if api_params.q.contains("lang:") {
        // Contains lang at any position
        let mut ranked_langs = langs.into_iter().collect::<Vec<_>>(); // Langs returned by the search query
        dbg!(&ranked_langs);
        if let Some(partial) = partial_lang {
            ranked_langs.retain(|(l, _)| l.to_lowercase().contains(&partial));

            // if ranked_langs.is_empty() {
            //     // ranked_langs.extend(
            //     //     languages::list()
            //     //         .filter(|l| l.to_lowercase().starts_with(&partial))
            //     //         .map(|l| (l.to_string(), 0)),
            //     // );

            //     // ranked_langs.sort_by(|(a, _), (b, _)| a.len().cmp(&b.len()));
            //     // ranked_langs.truncate(5);
            // }
        }

        ranked_langs.sort_by(|(_, a_count), (_, b_count)| b_count.cmp(a_count));
        ranked_langs.truncate(5);

        results.extend(ranked_langs.into_iter().map(|(l, _)| QueryResult::Lang(l)));
    }

    Ok(json(AutocompleteResponse {
        count: results.len(),
        data: results,
    }))
}

fn complete_flag(q: &str) -> impl Iterator<Item = &str> + '_ {
    QUERY_FLAGS
        .iter()
        .filter(move |f| f.starts_with(q))
        .copied()
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
