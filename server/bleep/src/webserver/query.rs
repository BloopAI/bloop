use super::prelude::*;
use crate::query::execute::ApiQuery;

pub(super) async fn handle(
    Query(api_params): Query<ApiQuery>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> impl IntoResponse {
    Arc::new(api_params)
        .query(indexes)
        .await
        .map(json)
        .map_err(super::Error::from)
}
