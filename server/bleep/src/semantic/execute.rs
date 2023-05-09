use std::collections::HashMap;

use crate::{
    query::{
        execute::{ApiQuery, PagingMetadata, QueryResponse, QueryResult, ResultStats},
        parser::SemanticQuery,
    },
    snippet::Snippet,
};
use tracing::info;

use super::{deduplicate_snippets, Payload, Semantic};

use anyhow::{Context, Result};

pub async fn execute(
    semantic: Semantic,
    query: SemanticQuery<'_>,
    params: ApiQuery,
) -> Result<QueryResponse> {
    let query_target = query.target().context("invalid query")?;
    let vector = semantic.embed(query_target)?;
    let query_result = semantic
        .search_with(
            &query,
            vector.clone(),
            (params.page_size * 4) as u64,
            ((params.page + 1) * params.page_size) as u64,
        )
        .await
        .map(|raw| {
            raw.into_iter()
                .map(super::Payload::from_qdrant)
                .collect::<Vec<_>>()
        })?;

    let data = deduplicate_snippets(query_result, vector, params.page_size * 2);
    let data = rank_snippets(&semantic, query_target, data, params.page_size);

    let data = data
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

fn rank_snippets<'a>(
    semantic: &Semantic,
    query: &str,
    results: Vec<Payload<'a>>,
    k: usize,
) -> Vec<Payload<'a>> {
    let mut scored_results = results
        .iter()
        .enumerate()
        .filter_map(|(idx, payload)| {
            let text = format!(
                "{}\t{}\n{}",
                payload.lang, payload.relative_path, payload.text
            );
            let score = semantic.score(query, &text).ok();
            score.map(|score| (idx, score))
        })
        .collect::<Vec<_>>();

    // Sort by ranking model score
    scored_results.sort_by(|a, b| a.1.total_cmp(&b.1));

    // Get top k snippet scores
    let top_idxs = scored_results
        .into_iter()
        .rev()
        .take(k)
        .map(|(idx, _)| idx)
        .collect::<Vec<_>>();

    info!("preserved idxs after reranking are {:?}", top_idxs);

    results
        .into_iter()
        .enumerate()
        .filter(|(idx, _)| top_idxs.contains(idx))
        .map(|(_, payload)| payload)
        .collect()
}
