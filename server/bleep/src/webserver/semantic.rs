use super::prelude::*;
use crate::{
    query::{
        execute::ApiQuery,
        parser::{self, ParsedQuery},
    },
    semantic::{self, Semantic},
};
use tracing::error;

pub(super) async fn complex_search(
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
