use axum::extract::Path;

use super::prelude::*;
use crate::{db::QueryLog, query::execute::ApiQuery, Application};

pub(super) async fn handle(
    Path(project_id): Path<i64>,
    Query(mut api_params): Query<ApiQuery>,
    Extension(app): Extension<Application>,
) -> impl IntoResponse {
    QueryLog::new(&app.sql).insert(&api_params.q).await?;

    api_params.project_id = project_id;

    Arc::new(api_params)
        .query(&app)
        .await
        .map(json)
        .map_err(super::Error::from)
}
