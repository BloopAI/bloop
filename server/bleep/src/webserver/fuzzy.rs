use super::prelude::*;
use std::sync::Arc;

#[derive(Serialize, Deserialize)]
pub(super) struct PayLoad {
    q: String,
}

pub(super) async fn handle(
    Query(payload): Query<PayLoad>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> impl IntoResponse {
    let docs = indexes.file.fuzzy_path(&payload.q).await;
    println!("{}", docs.len());
    Err::<String, Error>(Error::user("unsupported endpoitn"))
}
