use std::{path::PathBuf, sync::Arc};

use anyhow::Context;
use axum::{extract::Query, Extension, Json};
use tracing::warn;

use crate::{
    indexes::reader::OpenReader,
    query::{
        execute::{ApiQuery, DirectoryData, ExecuteQuery, QueryResult},
        parser,
    },
    repo::RepoRef,
};

use super::prelude::*;

#[derive(Debug, serde::Deserialize)]
pub(super) struct FileParams {
    pub repo_ref: RepoRef,
    pub path: PathBuf,
    pub branch: Option<String>,

    /// 1-indexed line number at which to start the snippet
    pub line_start: Option<isize>,

    /// 1-indexed line number at which to end the snippet
    pub line_end: Option<usize>,
}

#[derive(serde::Serialize)]
pub(super) struct FileResponse {
    contents: String,
    lang: Option<String>,
}

impl super::ApiResponse for FileResponse {}

pub(super) async fn handle<'a>(
    Query(params): Query<FileParams>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> Result<Json<super::Response<'a>>, Error> {
    let doc = indexes
        .file
        .by_path(
            &params.repo_ref,
            params.path.to_str().context("invalid file path")?,
            params.branch.as_deref(),
        )
        .await
        .map_err(Error::internal)?
        .ok_or_else(|| Error::user("file not found").with_status(StatusCode::NOT_FOUND))?;

    Ok(json(FileResponse {
        contents: split_by_lines(&doc.content, &doc.line_end_indices, &params)?.to_string(),
        lang: doc.lang,
    }))
}

fn split_by_lines<'a>(
    text: &'a str,
    indices: &[u32],
    params: &FileParams,
) -> Result<&'a str, Error> {
    let char_start = match params.line_start {
        Some(1) => 0,
        Some(line_start) if line_start > 1 => {
            (indices
                .get(line_start as usize - 2)
                .ok_or_else(|| Error::user("invalid line number"))?
                + 1) as usize
        }
        Some(_) => return Err(Error::user("line numbers are 1-indexed!")),
        _ => 0,
    };

    let line_end = params.line_end.unwrap_or(indices.len()) - 1;
    let char_end = *indices
        .get(line_end)
        .ok_or_else(|| Error::user("invalid line number"))? as usize;

    Ok(&text[char_start..=char_end])
}

#[derive(Debug, serde::Deserialize)]
pub(super) struct FolderParams {
    pub repo_ref: RepoRef,
    pub path: PathBuf,
    pub branch: Option<String>,
}

pub(super) async fn folder(
    Query(params): Query<FolderParams>,
    Extension(indexes): Extension<Arc<Indexes>>,
) -> Result<Json<DirectoryData>, Error> {
    let reader = OpenReader;

    let query = parser::Query {
        open: Some(true),
        repo: Some(parser::Literal::from(&params.repo_ref.indexed_name())),
        path: Some(parser::Literal::from(params.path.to_string_lossy())),
        branch: params.branch.map(|b| parser::Literal::from(&b)),
        case_sensitive: Some(true),
        ..Default::default()
    };

    // NB: This argument is not actually used in `OpenReader::execute`. We have two options to
    // simplify this:
    //
    // 1. Refactor the open reader in order to extract common logic so that we can re-use it here
    // 2. Remove the open reader entirely, replacing it with this route and the `/file` route
    //
    // Until we decide what to do here, we continue by just creating a dummy parameter.
    let api_query = ApiQuery {
        q: String::new(),
        project_id: 0,
        page: 0,
        page_size: 0,
        calculate_totals: false,
        context_before: 0,
        context_after: 0,
    };

    let mut results = reader
        .execute(&indexes.file, &[query], &api_query)
        .await
        .context("failed to execute open query")?
        .data
        .into_iter()
        .filter_map(|qr| match qr {
            QueryResult::Directory(d) => Some(d),
            _ => None,
        });

    let output = results
        .next()
        .context("`open:` query returned no results")?;

    if results.next().is_some() {
        warn!("`open:` query returned multiple results, ignoring all but first");
    }

    Ok(Json(output))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_params() {
        let text = r#"aaaaaa
bbbbbb
cccccc
"#;

        let indices = text
            .match_indices('\n')
            .map(|(i, _)| i as u32)
            .collect::<Vec<_>>();

        println!("{indices:?}");

        assert_eq!(
            split_by_lines(
                text,
                &indices,
                &FileParams {
                    repo_ref: "local//repo".into(),
                    path: "file".into(),
                    line_start: None,
                    line_end: None,
                    branch: None,
                }
            )
            .unwrap_or_else(|_| panic!("bad")),
            text
        );

        assert_eq!(
            split_by_lines(
                text,
                &indices,
                &FileParams {
                    repo_ref: "local//repo".into(),
                    path: "file".into(),
                    line_start: Some(1),
                    line_end: None,
                    branch: None,
                }
            )
            .unwrap_or_else(|_| panic!("bad")),
            text
        );

        assert_eq!(
            split_by_lines(
                text,
                &indices,
                &FileParams {
                    repo_ref: "local//repo".into(),
                    path: "file".into(),
                    line_start: Some(2),
                    line_end: None,
                    branch: None,
                }
            )
            .unwrap_or_else(|_| panic!("bad")),
            &text[7..]
        );

        assert_eq!(
            split_by_lines(
                text,
                &indices,
                &FileParams {
                    repo_ref: "local//repo".into(),
                    path: "file".into(),
                    line_start: Some(3),
                    line_end: Some(3),
                    branch: None,
                }
            )
            .unwrap_or_else(|_| panic!("bad")),
            &text[14..]
        );

        assert_eq!(
            split_by_lines(
                text,
                &indices,
                &FileParams {
                    repo_ref: "local//repo".into(),
                    path: "file".into(),
                    line_start: Some(2),
                    line_end: Some(3),
                    branch: None,
                }
            )
            .unwrap_or_else(|_| panic!("bad")),
            &text[7..]
        );
    }
}
