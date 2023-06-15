use super::*;

use anyhow::Result;
use gix::ThreadSafeRepository;
use regex::RegexSet;
use tracing::error;

use std::{
    collections::{HashMap, HashSet},
    path::Path,
};

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
    entries: HashMap<(String, FileType, gix::ObjectId), HashSet<String>>,
}

impl GitWalker {
    pub fn open_repository(
        dir: impl AsRef<Path>,
        filter: impl Into<Option<BranchFilter>>,
    ) -> Result<Self> {
        let root_dir = dir.as_ref();
        let branches = filter.into().unwrap_or_default();
        let git = gix::open::Options::isolated()
            .filter_config_section(|_| false)
            .open(dir.as_ref())?;

        let local_git = git.to_thread_local();
        let mut head = local_git.head()?;
        let head_name = head
            .clone()
            .try_into_referent()
            .map(|r| r.name().to_owned());

        let refs = local_git.references()?;
        let trees = if head_name.is_none() && matches!(branches, BranchFilter::Head) {
            // the current checkout is not a branch, so HEAD will not
            // point to a real reference.
            vec![(
                true,
                "HEAD".to_string(),
                head.peel_to_commit_in_place()?.tree()?,
            )]
        } else {
            refs.all()?
                .filter_map(Result::ok)
                .map(|r| {
                    (
                        head_name
                            .as_ref()
                            .map(|head| head.as_ref() == r.name())
                            .unwrap_or_default(),
                        human_readable_branch_name(&r),
                        r,
                    )
                })
                .filter(|(is_head, name, _)| branches.filter(*is_head, name))
                .filter_map(|(is_head, branch, r)| -> Option<_> {
                    Some((
                        is_head,
                        branch,
                        r.into_fully_peeled_id()
                            .ok()?
                            .object()
                            .ok()?
                            .peel_to_tree()
                            .ok()?,
                    ))
                })
                .collect()
        };

        let entries = trees
            .into_iter()
            .flat_map(|(is_head, branch, tree)| {
                let files = tree.traverse().breadthfirst.files().unwrap().into_iter();

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
                    .filter(|(_, _, path, _, _)| should_index(path))
            })
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

                    let branches = acc.entry((file, kind, oid)).or_insert_with(HashSet::new);
                    if is_head {
                        branches.insert("HEAD".to_string());
                    }

                    branches.insert(branch);
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

    fn for_each(self, pipes: &SyncPipes, iterator: impl Fn(RepoDirEntry) + Sync + Send) {
        use rayon::prelude::*;
        self.entries
            .into_par_iter()
            .filter_map(|((path, kind, oid), branches)| {
                let git = self.git.to_thread_local();
                let Ok(Some(object)) = git.try_find_object(oid) else {
                    error!(?path, ?branches, "can't find object for file");
                    return None;
                };

                if object.data.len() as u64 > MAX_FILE_LEN {
                    return None;
                }

                let entry = match kind {
                    FileType::File => {
                        let buffer = String::from_utf8_lossy(&object.data).to_string();
                        RepoDirEntry::File(RepoFile {
                            path,
                            branches: branches.into_iter().collect(),
                            buffer,
                        })
                    }
                    FileType::Dir => RepoDirEntry::Dir(RepoDir {
                        path,
                        branches: branches.into_iter().collect(),
                    }),
                    FileType::Other => return None,
                };

                Some(entry)
            })
            .take_any_while(|_| !pipes.is_cancelled())
            .for_each(iterator)
    }
}
