use axum::extract::State;

use super::prelude::*;
use crate::{db::QueryLog, query::execute::ApiQuery, Application};

pub(super) async fn handle(
    Query(api_params): Query<ApiQuery>,
    Extension(indexes): Extension<Arc<Indexes>>,
    State(app): State<Application>,
) -> impl IntoResponse {
    QueryLog::new(&app.sql).insert(&api_params.q).await?;

    Arc::new(api_params)
        .query(indexes)
        .await
        .map(json)
        .map_err(super::Error::from)
}
