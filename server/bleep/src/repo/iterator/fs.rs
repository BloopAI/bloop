use crate::background;

use super::*;

use tracing::warn;

use std::path::{Path, PathBuf};

pub struct FileWalker {
    file_list: Vec<PathBuf>,

    /// Branch to index files as part of.
    branch: String,
}

impl FileWalker {
    pub fn index_directory(dir: impl AsRef<Path>, branch: String) -> impl FileSource {
        // note: this WILL observe .gitignore files for the respective repos.
        let walker = ignore::WalkBuilder::new(&dir)
            .standard_filters(true)
            .hidden(false)
            .build();

        let file_list = walker
            .filter_map(|de| match de {
                Ok(de) => Some(de),
                Err(err) => {
                    warn!(%err, "access failure; skipping");
                    None
                }
            })
            .filter(|de| !de.path().strip_prefix(&dir).unwrap().starts_with(".git"))
            .filter_map(|de| crate::canonicalize(de.into_path()).ok())
            .collect();

        Self { file_list, branch }
    }
}

impl FileSource for FileWalker {
    fn len(&self) -> usize {
        self.file_list.len()
    }

    fn for_each(self, pipes: &SyncPipes, iterator: impl Fn(RepoDirEntry) + Sync + Send) {
        use rayon::prelude::*;
        background::rayon_pool().install(|| {
            self.file_list
                .into_par_iter()
                .filter_map(|entry_disk_path| {
                    if entry_disk_path.is_file() {
                        let buffer =
                            Box::new(move || match std::fs::read_to_string(&entry_disk_path) {
                                Err(err) => {
                                    warn!(%err, ?entry_disk_path, "read failed; skipping");
                                    return Err(err);
                                }
                                Ok(buffer) => Ok(buffer),
                            });
                        Some(RepoDirEntry::File(RepoFile {
                            buffer,
                            path: entry_disk_path.to_string_lossy().to_string(),
                            branches: vec![self.branch.clone()],
                        }))
                    } else if entry_disk_path.is_dir() {
                        Some(RepoDirEntry::Dir(RepoDir {
                            path: entry_disk_path.to_string_lossy().to_string(),
                            branches: vec![self.branch.clone()],
                        }))
                    } else {
                        Some(RepoDirEntry::Other)
                    }
                })
                .take_any_while(|_| !pipes.is_cancelled())
                .for_each(iterator);
        })
    }
}
