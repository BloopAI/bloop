use super::*;

use tracing::warn;

use std::path::{Path, PathBuf};

pub struct FileWalker {
    file_list: Vec<PathBuf>,
}

impl FileWalker {
    pub fn index_directory(
        dir: impl AsRef<Path>,
        file_filter: impl Into<FileFilter>,
    ) -> impl FileSource {
        let file_filter = file_filter.into();

        // note: this WILL observe .gitignore files for the respective repos.
        let walker = ignore::WalkBuilder::new(&dir)
            .standard_filters(true)
            .hidden(false)
            .filter_entry(move |entry| {
                file_filter
                    .is_allowed(entry.path())
                    .unwrap_or(should_index(entry.path()))
            })
            .build();

        let file_list = walker
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
            .collect();

        Self { file_list }
    }
}

static HEAD: &str = "HEAD";

impl FileSource for FileWalker {
    fn len(&self) -> usize {
        self.file_list.len()
    }

    fn for_each(self, pipes: &SyncPipes, iterator: impl Fn(RepoDirEntry) + Sync + Send) {
        use rayon::prelude::*;
        self.file_list
            .into_par_iter()
            .filter_map(|entry_disk_path| {
                if entry_disk_path.is_file() {
                    let buffer = match std::fs::read_to_string(&entry_disk_path) {
                        Err(err) => {
                            warn!(%err, ?entry_disk_path, "read failed; skipping");
                            return None;
                        }
                        Ok(buffer) => buffer,
                    };
                    Some(RepoDirEntry::File(RepoFile {
                        buffer,
                        path: entry_disk_path.to_string_lossy().to_string(),
                        branches: vec![HEAD.into()],
                    }))
                } else if entry_disk_path.is_dir() {
                    Some(RepoDirEntry::Dir(RepoDir {
                        path: entry_disk_path.to_string_lossy().to_string(),
                        branches: vec![HEAD.into()],
                    }))
                } else {
                    Some(RepoDirEntry::Other)
                }
            })
            .take_any_while(|_| !pipes.is_cancelled())
            .for_each(iterator);
    }
}
