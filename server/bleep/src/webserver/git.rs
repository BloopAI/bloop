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

use super::{middleware::User, prelude::*};

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
use tracing::debug;

type RepoPath = String;
type Diff = String;
type Branch = String;
type Commit = String;

pub struct CreateNewCommit<'a> {
    repo: &'a gix::Repository,
    changes: ChangeSet,
    path_deque: VecDeque<(Rc<MirrorTree>, BString)>,
    path: BString,
    root: Rc<MirrorTree>,
    current: Rc<MirrorTree>,
}

struct MirrorTree {
    filename: String,
    children: Mutex<Vec<Rc<MirrorTree>>>,
    tree: Mutex<Tree>,
}

#[derive(Debug, Deserialize)]
pub(super) struct Params {
    repo: RepoRef,
    branch_name: Option<String>,
    changes: Vec<Change>,
    push: Option<bool>,
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
    Extension(_user): Extension<User>,
    Json(params): Json<Params>,
) -> impl IntoResponse {
    let Params {
        repo,
        changes,
        branch_name,
        push,
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
        format!("refs/heads/{}", scheme.generate())
    });
    debug!(?branch_name, "creating new branch");

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
            branch_name.clone(),
            "Committed by bloop",
            root_oid,
            Some(head.id()),
        )
        .unwrap()
        .detach();

    if push.unwrap_or_default() {
        let backend = app.credentials.for_repo(&repo).unwrap();
        let index = app.write_index();
        let branch_name = branch_name.clone();
        index.wait_for(async move { backend.push(&app, &repo, &branch_name).await.unwrap() });
    }

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
        Self::new("")
    }

    fn new(filename: impl Into<String>) -> Rc<Self> {
        Rc::new(MirrorTree {
            filename: filename.into(),
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
            let filename = child.filename.clone().into();
            let child_tree = child.collapse(repo);
            tree.entries.push(Entry {
                filename,
                mode: EntryMode::Tree,
                oid: repo.write_object(&child_tree).unwrap().detach(),
            });
        }

        tree.entries.sort();
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
        (self.current, self.path) = self
            .path_deque
            .pop_front()
            .expect("every call is matched with push_tracked_path_component");
    }

    fn push_back_tracked_path_component(&mut self, component: &BStr) {
        self.push_element(component);

        let next = MirrorTree::new(component.to_str_lossy());
        self.current.children.lock().unwrap().push(next.clone());

        self.path_deque.push_back((next, self.path.clone()));
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
            let blob = changes.iter().fold(obj.data, |base, patch| {
                println!("{}", process_patch(patch));

                match diffy::apply(
                    String::from_utf8_lossy(&base).as_ref(),
                    &diffy::Patch::from_str(patch).unwrap(),
                ) {
                    Ok(ok) => ok,
                    Err(_) => {
                        let processed = process_patch(patch);
                        println!("{processed}");

                        diffy::apply(
                            String::from_utf8_lossy(&base).as_ref(),
                            &diffy::Patch::from_str(&processed).unwrap(),
                        )
                        .unwrap()
                    }
                }
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

fn process_patch(patch: &str) -> String {
    let mut collected = vec![];

    let mut lines = patch.lines().peekable();
    if lines.peek().unwrap().starts_with("diff") {
        collected.push(lines.next().unwrap().into());
    }

    if lines.peek().unwrap().starts_with("index") {
        collected.push(lines.next().unwrap().into());
    }

    let Some(next) = lines.peek() else {
	panic!("invalid diff");
    };
    if next.starts_with("---") {
        collected.push(lines.next().unwrap().into());
    }

    let Some(next) = lines.peek() else {
	panic!("invalid diff");
    };
    if next.starts_with("+++") {
        collected.push(lines.next().unwrap().into());
    }

    let Some(first_hunk_head) = lines.next() else {
	panic!("invalid diff");
    };

    if !first_hunk_head.starts_with("@@") {
        panic!("no @@");
    }

    let mut acc = vec![];
    let (mut add, mut remove, mut total) = (0, 0, 0);
    let (mut old_start, mut new_start, mut head_text) = parse_head(first_hunk_head);

    while let Some(line) = lines.next() {
        if line.starts_with("@@") {
            let old_size = total - add;
            let new_size = total - remove;

            collected.push(format!(
                "@@ -{old_start},{old_size} +{new_start},{new_size} @@{head_text}"
            ));

            collected.extend(acc.drain(..).map(str::to_owned));

            (add, remove, total) = (0, 0, 0);
            (old_start, new_start, head_text) = parse_head(line);
            continue;
        }

        total += 1;
        if line.starts_with('-') {
            remove += 1;
        }
        if line.starts_with('+') {
            add += 1;
        }

        acc.push(line);
    }

    if patch.ends_with("\n\n") || patch.ends_with("\r\n\r\n") {
        total -= 1;
    }
    let old_size = total - add;
    let new_size = total - remove;
    collected.push(format!(
        "@@ -{old_start},{old_size} +{new_start},{new_size} @@{head_text}"
    ));
    collected.extend(acc.drain(..).map(str::to_owned));

    collected.join("\n")
}

fn parse_head(hunk_head: &str) -> (usize, usize, &str) {
    let start_hunk = hunk_head
        .split_once(" -")
        .unwrap()
        .1
        .split_once(',')
        .unwrap()
        .0
        .parse()
        .unwrap();

    let end_hunk = hunk_head
        .split_once(" +")
        .unwrap()
        .1
        .split_once(',')
        .unwrap()
        .0
        .parse()
        .unwrap();

    let mut leftover = hunk_head.split("@@");
    assert_eq!(Some(""), leftover.next());
    _ = leftover.next().unwrap();
    let text = leftover.next().unwrap();

    (start_hunk, end_hunk, text)
}
