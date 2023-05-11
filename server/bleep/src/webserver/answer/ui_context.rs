use crate::{repo::RepoRef, Application};

#[derive(Debug, Clone)]
pub enum UiContext {
    File {
        repo_ref: RepoRef,
        path: String,
    },
    Folder {
        repo_ref: RepoRef,
        path: String,
    },
    Selection {
        repo_ref: RepoRef,
        path: String,
        start: usize,
        end: usize,
    },
    None,
}

impl UiContext {
    pub fn new(
        repo_ref: RepoRef,
        path: Option<String>,
        start: Option<usize>,
        end: Option<usize>,
        is_folder: bool,
    ) -> Self {
        match (path, start, end, is_folder) {
            (Some(path), None, None, false) => Self::File { repo_ref, path },
            (Some(path), None, None, true) => Self::Folder { repo_ref, path },
            (Some(path), Some(start), Some(end), false) => Self::Selection {
                repo_ref,
                path,
                start,
                end,
            },
            _ => Self::None,
        }
    }

    pub async fn prompt(&self, app: &Application) -> Option<String> {
        match &self {
            Self::File { path, .. } => Some(format!(
                "The user is currently looking at the file `{path}`"
            )),
            Self::Folder { path, .. } => Some(format!(
                "The user is currently looking at the folder `{path}`"
            )),
            Self::Selection {
                path,
                repo_ref,
                start,
                end,
            } => {
                let doc = app.indexes.file.by_path(&repo_ref, &path).await.ok()?;
                let snippet = split_by_lines(&doc.content, &doc.line_end_indices, *start, *end)?;
                Some(format!("The user is currently looking at the file `{path}`, with the following code selected:\n{snippet}"))
            }
            _ => None,
        }
    }
}

pub fn split_by_lines<'a>(
    text: &'a str,
    indices: &[u32],
    start: usize,
    end: usize,
) -> Option<&'a str> {
    let char_start = match Some(start) {
        Some(line_start) if line_start == 1 => 0,
        Some(line_start) if line_start > 1 => (indices.get(line_start as usize - 2)? + 1) as usize,
        Some(_) => return None,
        _ => 0,
    };

    let line_end = end;
    let char_end = *indices.get(line_end)? as usize;

    Some(&text[char_start..=char_end])
}
