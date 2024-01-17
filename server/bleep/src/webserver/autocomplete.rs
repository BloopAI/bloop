use std::collections::HashMap;

use super::prelude::*;
use crate::{
    indexes::reader::{ContentReader, FileReader, RepoReader},
    query::{
        execute::{ApiQuery, ExecuteQuery, QueryResult},
        languages, parser,
        parser::{Literal, Target},
    },
    Application,
};

use axum::{
    extract::{Path, Query},
    response::IntoResponse as IntoAxumResponse,
    Extension,
};
use futures::{stream, StreamExt, TryStreamExt};
use serde::Serialize;

fn default_true() -> bool {
    true
}

#[derive(Deserialize)]
pub struct AutocompleteParams {
    #[serde(default = "default_true")]
    content: bool,
    #[serde(default = "default_true")]
    file: bool,
    #[serde(default = "default_true")]
    repo: bool,
    #[serde(default = "default_true")]
    lang: bool,
}

pub(super) async fn handle(
    Query(mut api_params): Query<ApiQuery>,
    Query(ac_params): Query<AutocompleteParams>,
    Path(project_id): Path<i64>,
    Extension(app): Extension<Application>,
) -> Result<impl IntoAxumResponse> {
    // Override page_size and set to low value
    api_params.page = 0;
    api_params.page_size = 8;

    api_params.project_id = project_id;

    let mut partial_lang = None;
    let mut has_target = false;

    let queries = parser::parse(&api_params.q)
        .map_err(Error::user)?
        .into_iter()
        .map(|mut q| {
            let keywords = &["lang:", "path:", "repo:"];

            if ac_params.content {
                if let Some(ref t) = q.target {
                    if !keywords.iter().any(|k| k == t.literal().as_ref()) {
                        has_target = true;
                    }
                }

                let target = q
                    .target
                    .get_or_insert_with(|| Target::Content(Literal::Regex(".*".into())));

                for keyword in keywords {
                    if let Some(pos) = target.literal().find(keyword) {
                        let new = format!(
                            "{}{}",
                            &target.literal()[..pos],
                            &target.literal()[pos + keyword.len()..]
                        );

                        *target = Target::Content(Literal::Regex(if new.is_empty() {
                            ".*".into()
                        } else {
                            new.into()
                        }));
                    }
                }
            } else {
                q.target = None;
            }

            if let Some(lang) = q.lang.as_ref() {
                partial_lang = q.lang.as_ref().map(|l| l.to_lowercase());
                if languages::list()
                    .filter(|l| l.to_lowercase() == lang.as_ref().to_lowercase())
                    .count()
                    == 0
                {
                    q.lang = None;
                }
            }

            if q.path.is_none() && ac_params.file {
                q.path = Some(Literal::Regex(".*".into()));
            }

            q
        })
        .collect::<Vec<_>>();
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

    // NB: This restricts queries in a repo-specific way. This might need to be generalized if
    // we still use the other autocomplete fields.
    let repo_queries = api_params
        .restrict_repo_queries(queries.clone(), &app)
        .await?;

    let restricted_queries = api_params
        .restrict_queries(queries.clone(), &app)
        .await?;

    let mut engines = vec![];
    if ac_params.content {
        engines.push(ContentReader.execute(&app.indexes.file, &restricted_queries, &api_params));
    }

    if ac_params.repo {
        engines.push(RepoReader.execute(&app.indexes.repo, &repo_queries, &api_params));
    }

    if ac_params.file {
        engines.push(FileReader.execute(&app.indexes.file, &restricted_queries, &api_params));
    }

    let (langs, list) = stream::iter(engines)
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

    autocomplete_results.extend(
        list.into_iter()
            .filter(|q| has_target || !matches!(q, QueryResult::Snippets(_))),
    );

    if ac_params.lang && api_params.q.contains("lang:") {
        let mut ranked_langs = langs.into_iter().collect::<Vec<_>>();
        if let Some(partial) = partial_lang {
            ranked_langs.retain(|(l, _)| l.to_lowercase().contains(&partial));

            if ranked_langs.is_empty() {
                ranked_langs.extend(
                    languages::list()
                        .filter(|l| l.to_lowercase().starts_with(&partial))
                        .map(|l| (l.to_lowercase(), 0)),
                );

                ranked_langs.sort_by(|(a, _), (b, _)| a.len().cmp(&b.len()));
                ranked_langs.truncate(5);
            }
        }

        ranked_langs.sort_by(|(_, a_count), (_, b_count)| b_count.cmp(a_count));
        ranked_langs.truncate(5);

        autocomplete_results.extend(ranked_langs.into_iter().map(|(l, _)| QueryResult::Lang(l)));
    }

    Ok(json(AutocompleteResponse {
        count: autocomplete_results.len(),
        data: autocomplete_results,
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
