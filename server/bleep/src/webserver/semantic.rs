use super::prelude::*;
use crate::{query::parser, semantic::Semantic};
use tracing::error;

use qdrant_client::qdrant::value::Kind;
use std::collections::HashMap;

#[derive(Deserialize)]
pub(super) struct Args {
    limit: u64,
    query: String,
}

#[derive(Serialize)]
pub(super) struct SemanticResponse {
    chunks: Vec<serde_json::Value>,
}

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
    if let Some(semantic) = semantic {
        let Args { ref query, limit } = args;
        let query = parser::parse_nl(query).unwrap();
        let result = semantic.search(&query, limit).await.and_then(|raw| {
            raw.into_iter()
                .map(|v| {
                    v.into_iter()
                        .map(|(k, v)| (k, kind_to_value(v.kind)))
                        .collect::<HashMap<_, _>>()
                })
                .map(serde_json::to_value)
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.into())
        });

        if let Err(err) = result {
            error!(?err, "qdrant query failed");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                error(ErrorKind::UpstreamService, "error"),
            );
        };

        (
            StatusCode::OK,
            json(SemanticResponse {
                chunks: result.unwrap(),
            }),
        )
    } else {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            error(ErrorKind::Configuration, "Qdrant not configured"),
        );
    }
}

fn kind_to_value(kind: Option<Kind>) -> serde_json::Value {
    match kind {
        Some(Kind::NullValue(_)) => serde_json::Value::Null,
        Some(Kind::BoolValue(v)) => serde_json::Value::Bool(v),
        Some(Kind::DoubleValue(v)) => {
            serde_json::Value::Number(serde_json::Number::from_f64(v).unwrap())
        }
        Some(Kind::IntegerValue(v)) => serde_json::Value::Number(v.into()),
        Some(Kind::StringValue(v)) => serde_json::Value::String(v),
        Some(Kind::ListValue(v)) => serde_json::Value::Array(
            v.values
                .into_iter()
                .map(|v| kind_to_value(v.kind))
                .collect(),
        ),
        Some(Kind::StructValue(_v)) => todo!(),
        None => serde_json::Value::Null,
    }
}
