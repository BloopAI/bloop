use super::prelude::*;
use crate::{
    query::{
        execute::ApiQuery,
        parser::{self, ParsedQuery},
    },
    semantic::{self, Semantic},
};
use qdrant_client::qdrant::value::Kind;
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

pub fn kind_to_value(kind: Option<Kind>) -> serde_json::Value {
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
