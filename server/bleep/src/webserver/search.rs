use super::prelude::*;
use crate::{
    query::{
        execute::{
            ApiQuery, FileResultData, PagingMetadata, QueryResponse, QueryResult, ResultStats,
        },
        parser::{self},
    },
    semantic::{self, Semantic},
};
use tracing::error;

pub(super) async fn semantic_code(
    Query(args): Query<ApiQuery>,
    Extension(semantic): Extension<Option<Semantic>>,
) -> impl IntoResponse {
    let Some(semantic) = semantic else {
        return Err(Error::new(
            ErrorKind::Configuration,
            "Qdrant not configured",
        ));
    };

    match parser::parse_nl(&args.q.clone()) {
        Ok(q) => semantic::execute::execute(semantic, q, args)
            .await
            .map(json)
            .map_err(super::Error::from),
        Err(err) => {
            error!(?err, "Couldn't parse query");
            Err(Error::new(ErrorKind::UpstreamService, "error"))
        }
    }
}

pub(super) async fn fuzzy_path(
    Query(args): Query<ApiQuery>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> Result<impl IntoResponse> {
    let q = parser::parse_nl(&args.q).map_err(|err| {
        error!(?err, "Couldn't parse query");
        Error::new(ErrorKind::UpstreamService, "parse error")
    })?;

    let target = q.target();
    let target = target.as_deref().ok_or_else(|| {
        error!(?q, "Query has no target");
        Error::new(ErrorKind::UpstreamService, "Query has no target")
    })?;

    let repo_ref = args.repo_ref.as_ref().ok_or_else(|| {
        error!("No repo_ref provided");
        Error::new(ErrorKind::UpstreamService, "No repo_ref provided")
    })?;

    let data = indexes
        .file
        .skim_fuzzy_path_match(
            repo_ref,
            target,
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
