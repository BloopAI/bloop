use super::prelude::*;
use crate::{
    query::parser,
    semantic::{self, Semantic},
};
use tracing::error;

#[derive(Deserialize)]
pub(super) struct Args {
    limit: u64,
    query: String,
}

#[derive(Serialize)]
pub(super) struct SemanticResponse {
    chunks: Vec<semantic::Payload<'static>>,
}

impl super::ApiResponse for SemanticResponse {}

/// Get details of an indexed repository based on their id
//
#[utoipa::path(get, path = "/repos/indexed/:ref",
    responses(
        (status = 200, description = "Execute query successfully", body = SemanticResponse),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn raw_chunks(
    Query(args): Query<Args>,
    Extension(semantic): Extension<Option<Semantic>>,
) -> impl IntoResponse {
    let Some(semantic) = semantic else {
        return Err(Error::new(
            ErrorKind::Configuration,
            "Qdrant not configured",
        ));
    };

    let Args { ref query, limit } = args;
    let parser::ParsedQuery::NL(query) = parser::parse_nl(query).unwrap() else {panic!("badd")};
    let result = semantic.search(&query, limit).await.map(|raw| {
        raw.into_iter()
            .map(|v| semantic::Payload::from_qdrant(v.payload))
            .collect::<Vec<_>>()
    });

    match result {
        Err(err) => {
            error!(?err, "qdrant query failed");
            Err(Error::new(ErrorKind::UpstreamService, "error"))
        }
        Ok(result) => Ok(json(SemanticResponse { chunks: result })),
    }
}
