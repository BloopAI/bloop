use super::*;

use tracing::warn;

use std::path::{Path, PathBuf};

pub struct FileWalker {
    file_list: Vec<PathBuf>,
}

impl FileWalker {
    pub fn index_directory(dir: impl AsRef<Path>) -> impl FileSource {
        // note: this WILL observe .gitignore files for the respective repos.
        let file_list = ignore::Walk::new(&dir)
            .filter_map(|de| match de {
                Ok(de) => Some(de),
                Err(err) => {
                    warn!(%err, "access failure; skipping");
                    None
                }
            })
            // Preliminarily ignore files that are very large, without reading the contents.
            .filter(|de| matches!(de.metadata(), Ok(meta) if meta.len() < MAX_FILE_LEN))
            .filter_map(|de| crate::canonicalize(de.into_path()).ok())
            .filter(|p| {
                p.strip_prefix(&dir)
                    .as_ref()
                    .map(should_index)
                    .unwrap_or_default()
            })
            .collect();

        Self { file_list }
    }
}

impl FileSource for FileWalker {
    fn len(&self) -> usize {
        self.file_list.len()
    }

    fn for_each(self, iterator: impl Fn(RepoFile) + Sync + Send) {
        use rayon::prelude::*;
        self.file_list
            .into_par_iter()
            .filter_map(|entry_disk_path| {
                let buffer = if entry_disk_path.is_file() {
                    match std::fs::read_to_string(&entry_disk_path) {
                        Err(err) => {
                            warn!(%err, ?entry_disk_path, "read failed; skipping");
                            return None;
                        }
                        Ok(buffer) => buffer,
                    }
                } else {
                    String::new()
                };

                let file_type = if entry_disk_path.is_dir() {
                    FileType::Dir
                } else if entry_disk_path.is_file() {
                    FileType::File
                } else {
                    FileType::Other
                };

                Some(RepoFile {
                    buffer,
                    path: entry_disk_path.to_string_lossy().to_string(),
                    kind: file_type,
                    branches: vec!["head".into()],
                })
            })
            .for_each(iterator);
    }
}
