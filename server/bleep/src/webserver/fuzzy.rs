use super::prelude::*;
use axum::response::IntoResponse as IntoAxumResponse;
use std::sync::Arc;

#[derive(Serialize, Deserialize)]
pub(super) struct PayLoad {
    q: String,
}

pub(super) async fn handle(
    Query(payload): Query<PayLoad>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> impl IntoAxumResponse {
    let data = indexes
        .file
        .fuzzy_path(&payload.q)
        .await
        .into_iter()
        .map(|d| {
            d.get_first(indexes.file.source.relative_path)
                .unwrap()
                .as_text()
                .unwrap()
                .to_owned()
        })
        .collect::<Vec<_>>();
    axum::Json(data)
}
