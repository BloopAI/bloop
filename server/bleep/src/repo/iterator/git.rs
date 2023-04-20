use super::*;

use anyhow::Result;
use gix::ThreadSafeRepository;
use regex::RegexSet;
use tracing::error;

use std::{collections::HashMap, path::Path};

pub enum BranchFilter {
    All,
    Head,
    Select(RegexSet),
}

impl BranchFilter {
    fn filter(&self, is_head: bool, branch: &str) -> bool {
        match self {
            BranchFilter::All => true,
            BranchFilter::Select(patterns) => patterns.is_match(branch),
            BranchFilter::Head => is_head,
        }
    }
}

impl Default for BranchFilter {
    fn default() -> Self {
        Self::Head
    }
}

fn human_readable_branch_name(r: &gix::Reference<'_>) -> String {
    use gix::bstr::ByteSlice;
    r.name().shorten().to_str_lossy().to_string()
}

pub struct GitWalker {
    git: ThreadSafeRepository,
    entries: HashMap<(String, FileType, gix::ObjectId), Vec<String>>,
}

impl GitWalker {
    pub fn open_repository(
        dir: impl AsRef<Path>,
        filter: impl Into<Option<BranchFilter>>,
    ) -> Result<impl FileSource> {
        let root_dir = dir.as_ref();
        let branches = filter.into().unwrap_or_default();
        let git = gix::open::Options::isolated()
            .filter_config_section(|_| false)
            .open(dir.as_ref())?;

        let local_git = git.to_thread_local();
        let head = local_git
            .head()?
            .try_into_referent()
            .map(|r| r.name().to_owned());

        let refs = local_git.references()?;
        let entries = refs
            .all()?
            .filter_map(Result::ok)
            .map(|r| {
                (
                    head.as_ref()
                        .map(|head| head.as_ref() == r.name())
                        .unwrap_or_default(),
                    human_readable_branch_name(&r),
                    r,
                )
            })
            .filter(|(is_head, name, _)| branches.filter(*is_head, name))
            .filter_map(|(is_head, branch, r)| -> Option<_> {
                let tree = r
                    .into_fully_peeled_id()
                    .ok()?
                    .object()
                    .ok()?
                    .peel_to_tree()
                    .ok()?;

                let files = tree.traverse().breadthfirst.files().unwrap().into_iter();

                Some(
                    files
                        .map(move |entry| {
                            let strpath = String::from_utf8_lossy(entry.filepath.as_ref());
                            let full_path = root_dir.join(strpath.as_ref());
                            (
                                is_head,
                                branch.clone(),
                                full_path.to_string_lossy().to_string(),
                                entry.mode,
                                entry.oid,
                            )
                        })
                        .filter(|(_, _, path, _, _)| should_index(path)),
                )
            })
            .flatten()
            .fold(
                HashMap::new(),
                |mut acc, (is_head, branch, file, mode, oid)| {
                    let kind = if mode.is_tree() {
                        FileType::Dir
                    } else if mode.is_blob() {
                        FileType::File
                    } else {
                        FileType::Other
                    };

                    let branches = acc.entry((file, kind, oid)).or_insert_with(Vec::new);
                    if is_head {
                        branches.push("head".to_string());
                    }

                    branches.push(branch);
                    acc
                },
            );

        Ok(Self { git, entries })
    }
}

impl FileSource for GitWalker {
    fn len(&self) -> usize {
        self.entries.len()
    }

    fn for_each(self, iterator: impl Fn(RepoFile) + Sync + Send) {
        use rayon::prelude::*;
        self.entries
            .into_par_iter()
            .filter_map(|((file, kind, oid), branches)| {
                let git = self.git.to_thread_local();
                let Ok(Some(object)) = git.try_find_object(oid) else {
		    error!(?file, ?branches, "can't find object for file");
		    return None;
		};

                if object.data.len() as u64 > MAX_FILE_LEN {
                    return None;
                }

                let buffer = String::from_utf8_lossy(&object.data).to_string();

                Some(RepoFile {
                    path: file,
                    kind,
                    branches,
                    buffer,
                })
            })
            .for_each(iterator)
    }
}
