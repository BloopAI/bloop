use std::collections::HashMap;

use crate::{
    query::{
        execute::{ApiQuery, PagingMetadata, QueryResponse, QueryResult, ResultStats},
        parser::SemanticQuery,
    },
    snippet::Snippet,
};

use super::{deduplicate_snippets, Semantic};

use anyhow::{Context, Result};

pub async fn execute(
    semantic: Semantic,
    query: SemanticQuery<'_>,
    params: ApiQuery,
) -> Result<QueryResponse> {
    let vector = semantic.embed(query.target().context("invalid query")?)?;
    let query_result = semantic
        .search_with(
            &query,
            vector.clone(),
            params.page_size as u64,
            ((params.page + 1) * params.page_size) as u64,
        )
        .await
        .map(|raw| {
            raw.into_iter()
                .map(super::Payload::from_qdrant)
                .collect::<Vec<_>>()
        })?;

    let data = deduplicate_snippets(query_result, vector, params.page_size)
        .into_iter()
        .fold(HashMap::new(), |mut acc, payload| {
            acc.entry((
                payload.relative_path.to_string(),
                payload.repo_name.to_string(),
                payload.repo_ref.to_string(),
                Some(payload.lang.to_string()),
            ))
            .or_insert_with(Vec::new)
            .push(Snippet {
                data: payload.text.to_string(),
                line_range: payload.start_line as usize..payload.end_line as usize,
                highlights: vec![],
                symbols: vec![],
            });

            acc
        })
        .into_iter()
        .map(|((relative_path, repo_name, repo_ref, lang), snippets)| {
            QueryResult::Snippets(crate::snippet::SnippedFile {
                relative_path,
                repo_name,
                repo_ref,
                snippets,
                lang,
            })
        })
        .collect::<Vec<_>>();
    Ok(QueryResponse {
        count: data.len(),
        metadata: PagingMetadata::new(params.page, params.page_size, None),
        stats: ResultStats::default(),
        data,
    })
}
