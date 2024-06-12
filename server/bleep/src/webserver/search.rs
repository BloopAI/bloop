use super::prelude::*;
use crate::{
    query::{
        execute::{
            ApiQuery, FileResultData, PagingMetadata, QueryResponse, QueryResult, ResultStats,
        },
        parser::{self},
    },
    semantic::{self, Semantic},
    Application,
};
use axum::extract::Path;
use tracing::error;

pub(super) async fn semantic_code(
    Query(args): Query<ApiQuery>,
    Extension(semantic): Extension<Semantic>,
) -> impl IntoResponse {
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

#[axum::debug_handler]
pub(super) async fn fuzzy_path(
    Path(project_id): Path<i64>,
    Query(args): Query<ApiQuery>,
    Extension(app): Extension<Application>,
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

    let repo_refs = sqlx::query! {
        "SELECT repo_ref
        FROM project_repos
        WHERE project_id = ?",
        project_id,
    }
    .fetch_all(&*app.sql)
    .await?
    .into_iter()
    .map(|row| row.repo_ref)
    .filter_map(|rr| rr.parse().ok());

    let data = indexes
        .file
        .skim_fuzzy_path_match(
            repo_refs,
            target,
            q.first_branch().as_deref(),
            std::iter::empty(),
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
                c.indexed,
                c.is_dir,
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
