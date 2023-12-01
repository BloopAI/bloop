use std::sync::Arc;

use super::prelude::*;
use crate::{indexes::Indexes, repo::RepoRef, text_range::TextRange};

use axum::{extract::Query, response::IntoResponse, Extension};
use serde::{Deserialize, Serialize};

/// The request made to the `hoverable` endpoint.
#[derive(Debug, Deserialize)]
pub struct HoverableRequest {
    /// The repo_ref of the file of interest
    pub repo_ref: String,

    /// The path to the file of interest, relative to the repo root
    pub relative_path: String,

    /// Branch name to use for the lookup,
    pub branch: Option<String>,
}

/// The response from the `hoverable` endpoint.
#[derive(Serialize)]
pub struct HoverableResponse {
    pub ranges: Vec<TextRange>,
}

impl super::ApiResponse for HoverableResponse {}

pub async fn inner_handle(
    payload: HoverableRequest,
    indexes: Arc<Indexes>,
) -> Result<HoverableResponse, Error> {
    let repo_ref = &payload.repo_ref.parse::<RepoRef>().map_err(Error::user)?;

    let document = match indexes
        .file
        .by_path(repo_ref, &payload.relative_path, payload.branch.as_deref())
        .await
    {
        Ok(Some(doc)) => doc,
        Ok(None) => return Err(Error::user("file not found").with_status(StatusCode::NOT_FOUND)),
        Err(e) => return Err(Error::user(e)),
    };

    let ranges = document
        .hoverable_ranges()
        .ok_or(Error::user("no hoverable ranges for language"))?;

    Ok(HoverableResponse { ranges })
}

pub(super) async fn handle(
    Query(payload): Query<HoverableRequest>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> impl IntoResponse {
    let repo_ref = &payload.repo_ref.parse::<RepoRef>().map_err(Error::user)?;

    let document = match indexes
        .file
        .by_path(repo_ref, &payload.relative_path, payload.branch.as_deref())
        .await
    {
        Ok(Some(doc)) => doc,
        Ok(None) => return Err(Error::user("file not found").with_status(StatusCode::NOT_FOUND)),
        Err(e) => return Err(Error::user(e)),
    };

    let ranges = document
        .hoverable_ranges()
        .ok_or(Error::user("no hoverable ranges for language"))?;

    Ok(json(HoverableResponse { ranges }))
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
