use super::prelude::*;
use crate::{
    query::{
        execute::{
            ApiQuery, FileResultData, PagingMetadata, QueryResponse, QueryResult, ResultStats,
        },
        parser::{self, ParsedQuery},
    },
    semantic::{self, Semantic},
};
use tracing::error;

pub(super) async fn code_search(
    Query(args): Query<ApiQuery>,
    Extension(indexes): Extension<Arc<Indexes>>,
    Extension(semantic): Extension<Option<Semantic>>,
) -> impl IntoResponse {
    let Some(semantic) = semantic else {
        return Err(Error::new(
            ErrorKind::Configuration,
            "Qdrant not configured",
        ));
    };

    match parser::parse_nl(&args.q.clone()) {
        Ok(ParsedQuery::Semantic(q)) => semantic::execute::execute(semantic, q, args)
            .await
            .map(json)
            .map_err(super::Error::from),
        Ok(ParsedQuery::Grep(q)) => Arc::new(args)
            .query_with(indexes, q)
            .await
            .map(json)
            .map_err(super::Error::from),
        Err(err) => {
            error!(?err, "qdrant query failed");
            Err(Error::new(ErrorKind::UpstreamService, "error"))
        }
    }
}

pub(super) async fn path_search(
    Query(args): Query<ApiQuery>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> impl IntoResponse {
    match parser::parse_nl(&args.q.clone()) {
        Ok(ParsedQuery::Semantic(q)) => {
            let data = indexes
                .file
                .fuzzy_path_match(
                    &args.repo_ref.unwrap(),
                    q.target().as_deref().unwrap(),
                    q.first_branch().as_deref(),
                    args.page_size,
                )
                .await
                .map(|c: crate::indexes::reader::FileDocument| {
                    QueryResult::FileResult(FileResultData::new(
                        c.repo_name,
                        c.relative_path,
                        c.repo_ref,
                        c.lang,
                        c.branches,
                    ))
                })
                .collect::<Vec<QueryResult>>();

            Ok(json(QueryResponse {
                count: data.len(),
                data,
                metadata: PagingMetadata::new(args.page, args.page_size, None),
                stats: ResultStats::default(),
            }))
        }
        Ok(ParsedQuery::Grep(_)) => {
            error!("/search/path does not support grep queries");
            Err(Error::new(ErrorKind::UpstreamService, "error"))
        }
        Err(err) => {
            error!(?err, "Couldn't parse query");
            Err(Error::new(ErrorKind::UpstreamService, "error"))
        }
    }
}
