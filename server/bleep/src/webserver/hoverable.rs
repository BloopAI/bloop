use std::sync::Arc;

use super::{json, EndpointError, ErrorKind};
use crate::{indexes::Indexes, state::RepoRef, symbol::SymbolLocations, text_range::TextRange};

use axum::{extract::Query, http::StatusCode, response::IntoResponse, Extension};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

/// The request made to the `hoverable` endpoint.
#[derive(Debug, Deserialize, IntoParams)]
pub(super) struct HoverableRequest {
    /// The repo_ref of the file of interest
    repo_ref: String,

    /// The path to the file of interest, relative to the repo root
    relative_path: String,
}

/// The response from the `hoverable` endpoint.
#[derive(Serialize, ToSchema)]
pub(super) struct HoverableResponse {
    ranges: Vec<TextRange>,
}

impl HoverableRequest {
    async fn handle(
        &self,
        indexes: Arc<Indexes>,
    ) -> Result<HoverableResponse, EndpointError<'static>> {
        let repo_ref = &self
            .repo_ref
            .parse::<RepoRef>()
            .map_err(|err| EndpointError::user(err.to_string().into()))?;

        let document = match indexes.file.by_path(repo_ref, &self.relative_path).await {
            Ok(doc) => doc,
            Err(e) => {
                return Err(EndpointError {
                    kind: ErrorKind::User,
                    message: e.to_string().into(),
                })
            }
        };
        let ranges = match document.symbol_locations {
            SymbolLocations::TreeSitter(graph) => graph.hoverable_ranges().collect(),
            _ => {
                return Err(EndpointError {
                    kind: ErrorKind::User,
                    message: "Intelligence is unavailable for this language".into(),
                })
            }
        };
        Ok(HoverableResponse { ranges })
    }
}

#[utoipa::path(
    get,
    path = "/hoverable",
    params(HoverableRequest),
    responses(
        (status = 200, description = "Execute query successfully", body = HoverableResponse),
        (status = 400, description = "Bad request", body = EndpointError),
        (status = 500, description = "Server error", body = EndpointError),
    ),
)]
pub(super) async fn handle(
    Query(payload): Query<HoverableRequest>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> impl IntoResponse {
    let response = payload.handle(indexes).await;
    match response {
        Ok(r) => (StatusCode::OK, json(r)),
        Err(e) if e.kind == ErrorKind::User => (StatusCode::BAD_REQUEST, json(e)),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, json(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::text_range::Point;

    #[test]
    fn serialize_response() {
        let expected = serde_json::json!(
            {
              "ranges": [
                {
                  "start": { "byte": 50, "line": 60, "column": 0  },
                  "end":   { "byte": 80, "line": 90, "column": 0  }
                },
                {
                  "start": { "byte":  5, "line": 15, "column": 0  },
                  "end":   { "byte": 35, "line": 45, "column": 0  }
                },
              ]
            }
        );

        let observed = serde_json::to_value(HoverableResponse {
            ranges: vec![
                TextRange::new(Point::new(50, 60, 0), Point::new(80, 90, 0)),
                TextRange::new(Point::new(5, 15, 0), Point::new(35, 45, 0)),
            ],
        })
        .unwrap();

        assert_eq!(expected, observed)
    }
}
