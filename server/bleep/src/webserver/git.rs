// The core of this has been adapted from
// https://github.com/Byron/gitoxide/blob/9e391e916402aafa7a20c704d11e21a91bda63b5/gix-traverse/src/tree/recorder.rs

use std::{
    borrow::Cow,
    collections::{HashMap, HashSet, VecDeque},
    path::Path,
    rc::Rc,
    sync::Mutex,
};

use crate::repo::RepoRef;

use super::prelude::*;

use axum::Json;
use chbs::scheme::ToScheme;
use gix::{
    bstr::{BStr, BString, ByteSlice, ByteVec},
    objs::{
        tree::Entry,
        tree::{self, EntryMode},
        Kind, Tree,
    },
    traverse::tree::{visit::Action, Visit},
};

type RepoPath = String;
type Diff = String;
type Branch = String;
type Commit = String;

pub struct CreateNewCommit<'a> {
    repo: &'a gix::Repository,
    changes: ChangeSet,
    path_deque: VecDeque<BString>,
    path: BString,
    root: Rc<MirrorTree>,
    current: Rc<MirrorTree>,
}

struct MirrorTree {
    filename: String,
    parent: Mutex<Option<Rc<MirrorTree>>>,
    children: Mutex<Vec<Rc<MirrorTree>>>,
    tree: Mutex<Tree>,
}

#[derive(Debug, Deserialize)]
pub(super) struct Params {
    repo: RepoRef,
    branch_name: Option<String>,
    changes: Vec<Change>,
}

#[derive(Debug, Serialize)]
struct ApiResult {
    branch_name: Branch,
    commit_id: Commit,
}

impl super::ApiResponse for ApiResult {}

#[derive(Debug, Clone, Deserialize)]
pub struct Change {
    pub path: RepoPath,
    pub diff: Diff,
}

#[derive(Debug, Clone)]
struct ChangeSet {
    dirs: HashSet<RepoPath>,
    files: HashMap<RepoPath, Vec<Diff>>,
}

pub(super) async fn create_branch(
    Extension(app): Extension<crate::Application>,
    Json(params): Json<Params>,
) -> impl IntoResponse {
    let Params {
        repo,
        changes,
        branch_name,
    } = params;

    let branch_name = branch_name.unwrap_or_else(|| {
        use chbs::probability::Probability;
        let config = chbs::config::BasicConfig {
            words: 3,
            separator: "-".into(),
            capitalize_first: Probability::Never,
            capitalize_words: Probability::Never,
            ..Default::default()
        };
        let scheme = config.to_scheme();
        scheme.generate()
    });

    let git = app
        .repo_pool
        .read_async(&repo, |_k, v| gix::open(&v.disk_path))
        .await
        .unwrap()
        .unwrap();

    let mut changes = CreateNewCommit::new(&git, changes);
    let head = git.head_commit().unwrap();
    head.tree()
        .unwrap()
        .traverse()
        .breadthfirst(&mut changes)
        .unwrap();

    let root_tree = changes.to_tree();
    let root_oid = git.write_object(&root_tree).unwrap();

    let commit_id = git
        .commit(
            format!("refs/heads/{branch_name}"),
            "Committed by bloop",
            root_oid,
            Some(head.id()),
        )
        .unwrap()
        .detach();

    json(ApiResult {
        branch_name,
        commit_id: commit_id.to_string(),
    })
}

impl From<Vec<Change>> for ChangeSet {
    fn from(value: Vec<Change>) -> Self {
        let (files, dirs) = value.into_iter().fold(
            (HashMap::default(), HashSet::default()),
            |(mut files, mut dirs), Change { path, diff }| {
                dirs.extend(
                    AsRef::<Path>::as_ref(&path)
                        .ancestors()
                        .map(Path::to_string_lossy)
                        .map(Cow::<'_, str>::into),
                );

                files.entry(path).or_insert_with(Vec::default).push(diff);

                (files, dirs)
            },
        );

        Self { dirs, files }
    }
}

impl ChangeSet {
    fn get(&self, file: &str) -> Option<&[Diff]> {
        self.files.get(file).map(Vec::as_ref)
    }

    fn should_descend(&self, dir: &str) -> bool {
        self.dirs.iter().any(|d| d == dir)
    }
}

impl MirrorTree {
    fn root() -> Rc<Self> {
        Self::new("", None)
    }

    fn new(filename: impl Into<String>, parent: impl Into<Option<Rc<MirrorTree>>>) -> Rc<Self> {
        Rc::new(MirrorTree {
            filename: filename.into(),
            parent: Mutex::new(parent.into()),
            children: Mutex::new(vec![]),
            tree: Mutex::new(Tree::empty()),
        })
    }

    fn collapse(self: Rc<Self>, repo: &gix::Repository) -> Tree {
        let mut tree = {
            let mut lock = self.tree.lock().unwrap();
            std::mem::replace(&mut *lock, Tree::empty())
        };

        for child in self.children.lock().unwrap().drain(..) {
            let child_tree = child.collapse(repo);
            tree.entries.push(Entry {
                mode: EntryMode::Tree,
                filename: self.filename.clone().into(),
                oid: repo.write_object(&child_tree).unwrap().detach(),
            });
        }

        tree
    }
}

impl<'a> CreateNewCommit<'a> {
    fn new(repo: &'a gix::Repository, changes: Vec<Change>) -> Self {
        let root = MirrorTree::root();
        CreateNewCommit {
            path_deque: Default::default(),
            path: Default::default(),
            changes: changes.into(),
            current: Rc::clone(&root),
            root,
            repo,
        }
    }

    fn pop_element(&mut self) {
        if let Some(pos) = self.path.rfind_byte(b'/') {
            self.path.resize(pos, 0);
        } else {
            self.path.clear();
        }
    }

    fn push_element(&mut self, name: &BStr) {
        if !self.path.is_empty() {
            self.path.push(b'/');
        }
        self.path.push_str(name);
    }

    fn to_tree(&self) -> Tree {
        self.root.clone().collapse(self.repo)
    }
}

impl<'a> Visit for CreateNewCommit<'a> {
    fn pop_front_tracked_path_and_set_current(&mut self) {
        self.path = self
            .path_deque
            .pop_front()
            .expect("every call is matched with push_tracked_path_component");

        println!("pop: {}, {}", self.path, self.current.filename);
        let parent = self
            .current
            .parent
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .clone();
        _ = std::mem::replace(&mut self.current, parent);
    }

    fn push_back_tracked_path_component(&mut self, component: &BStr) {
        self.push_element(component);
        self.path_deque.push_back(self.path.clone());

        println!("push: {}, {}", self.path, self.current.filename);
        let next = MirrorTree::new(component.to_str_lossy(), self.current.clone());
        self.current.children.lock().unwrap().push(next.clone());
        self.current = next;
    }

    fn push_path_component(&mut self, component: &BStr) {
        self.push_element(component);
    }

    fn pop_path_component(&mut self) {
        self.pop_element();
    }

    fn visit_tree(&mut self, entry: &tree::EntryRef<'_>) -> Action {
        if self
            .changes
            .should_descend(self.path.to_str_lossy().as_ref())
        {
            println!("going down {}", self.path);
            Action::Continue
        } else {
            self.current.tree.lock().unwrap().entries.push(Entry {
                mode: entry.mode,
                filename: entry.filename.into(),
                oid: entry.oid.into(),
            });
            Action::Skip
        }
    }

    fn visit_nontree(&mut self, entry: &tree::EntryRef<'_>) -> Action {
        if let Some(changes) = self.changes.get(self.path.to_str_lossy().as_ref()) {
            let obj = self
                .repo
                .try_find_object(entry.oid)
                .unwrap()
                .unwrap()
                .detach();

            assert_eq!(obj.kind, Kind::Blob);
            println!("{:?}", self.path);

            let blob = changes.iter().fold(obj.data, |base, patch| {
                println!("{}", patch);
                diffy::apply(
                    String::from_utf8_lossy(&base).as_ref(),
                    &diffy::Patch::from_str(patch).unwrap(),
                )
                .unwrap()
                .into()
            });

            let new_id = self.repo.write_blob(&blob).unwrap();
            self.current.tree.lock().unwrap().entries.push(Entry {
                mode: entry.mode,
                filename: entry.filename.into(),
                oid: new_id.detach(),
            });
        } else {
            self.current.tree.lock().unwrap().entries.push(Entry {
                mode: entry.mode,
                filename: entry.filename.into(),
                oid: entry.oid.into(),
            });
        }
        Action::Continue
    }
}
