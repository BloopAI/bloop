use super::*;

use anyhow::Result;
use gix::ThreadSafeRepository;
use regex::Regex;
use tracing::error;

use std::{collections::HashMap, path::Path};

pub enum BranchFilter {
    All,
    Select(Vec<Regex>),
}

impl BranchFilter {
    fn filter(&self, branch: &str) -> bool {
        match self {
            BranchFilter::All => true,
            BranchFilter::Select(patterns) => patterns.iter().any(|r| r.is_match(branch)),
        }
    }
}

impl Default for BranchFilter {
    fn default() -> Self {
        Self::All
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
            .prefixed("refs/heads")?
            .peeled()
            .filter_map(Result::ok)
            .map(|r| (human_readable_branch_name(&r), r))
            .filter(|(name, _)| branches.filter(name))
            .filter_map(|(branch, r)| -> Option<_> {
                let is_head = head
                    .as_ref()
                    .map(|head| head.as_ref() == r.name())
                    .unwrap_or_default();

                let tree = r
                    .into_fully_peeled_id()
                    .ok()?
                    .object()
                    .ok()?
                    .peel_to_tree()
                    .ok()?;

                let files = tree.traverse().breadthfirst.files().unwrap().into_iter();

                Some(files.map(move |entry| {
                    (
                        is_head,
                        branch.clone(),
                        String::from_utf8_lossy(entry.filepath.as_ref()).to_string(),
                        entry.mode,
                        entry.oid,
                    )
                }))
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

                let buffer = String::from_utf8_lossy(&object.data).to_string();

                if buffer.len() as u64 > MAX_FILE_LEN {
                    return None;
                }

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
