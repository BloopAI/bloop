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
use once_cell::sync::OnceCell;
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
                let processed = process_patch(patch);
                let base = String::from_utf8_lossy(&base);
                println!("{base}");
                println!("{processed}");

                diffy::apply(base.as_ref(), &diffy::Patch::from_str(&processed).unwrap())
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

fn process_patch(patch: &str) -> String {
    static RE: OnceCell<regex::Regex> = OnceCell::new();
    let empty_line = RE.get_or_init(|| regex::Regex::new(r#"^\w*$"#).unwrap());

    // remove empty lines from start and end
    let patch = {
        let rev = patch
            .split('\n')
            .rev()
            .skip_while(|line| empty_line.is_match(line))
            .collect::<Vec<_>>();

        rev.into_iter().rev()
    };

    let mut collected = vec![];

    let mut lines = patch.peekable();
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

#[cfg(test)]
mod tests {
    #[test]
    fn eq() {
        let patch = r#"diff --git a/Cargo.lock b/Cargo.lock
index b65a395..c012fc3 100644
--- a/Cargo.lock
+++ b/Cargo.lock
@@ -486,12 +486,14 @@ dependencies = [
  "axum-extra",
  "bincode",
  "blake3",
+ "chbs",
  "chrono",
  "clap 4.3.0",
  "color-eyre",
  "compact_str",
  "console-subscriber",
  "criterion",
+ "diffy",
  "directories",
  "dunce",
  "either",
@@ -500,6 +502,7 @@ dependencies = [
  "flume",
  "futures",
  "git-version",
+ "git2",
  "gix",
  "histogram",
  "hyperpolyglot",
@@ -826,6 +829,18 @@ version = "1.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "baf1de4339761588bc0619e3cbc0120ee582ebb74b53b4efbf79117bd2da40fd"
 
+[[package]]
+name = "chbs"
+version = "0.1.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "45a7298287f1443f422d3f46e8ce9f855e75f0e43c06605adb4c52a262faeabd"
+dependencies = [
+ "derive_builder 0.10.2",
+ "getrandom 0.2.9",
+ "rand 0.8.5",
+ "thiserror",
+]
+
 [[package]]
 name = "chrono"
 version = "0.4.24"
@@ -1416,6 +1431,16 @@ dependencies = [
  "cipher",
 ]
 
+[[package]]
+name = "darling"
+version = "0.12.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "5f2c43f534ea4b0b049015d00269734195e6d3f0f6635cb692251aca6f9f8b3c"
+dependencies = [
+ "darling_core 0.12.4",
+ "darling_macro 0.12.4",
+]
+
 [[package]]
 name = "darling"
 version = "0.14.4"
@@ -1436,6 +1461,20 @@ dependencies = [
  "darling_macro 0.20.1",
 ]
 
+[[package]]
+name = "darling_core"
+version = "0.12.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8e91455b86830a1c21799d94524df0845183fa55bafd9aa137b01c7d1065fa36"
+dependencies = [
+ "fnv",
+ "ident_case",
+ "proc-macro2",
+ "quote",
+ "strsim 0.10.0",
+ "syn 1.0.109",
+]
+
 [[package]]
 name = "darling_core"
 version = "0.14.4"
@@ -1464,6 +1503,17 @@ dependencies = [
  "syn 2.0.16",
 ]
 
+[[package]]
+name = "darling_macro"
+version = "0.12.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "29b5acf0dea37a7f66f7b25d2c5e93fd46f8f6968b1a5d7a3e02e97768afc95a"
+dependencies = [
+ "darling_core 0.12.4",
+ "quote",
+ "syn 1.0.109",
+]
+
 [[package]]
 name = "darling_macro"
 version = "0.14.4"
@@ -1496,13 +1546,34 @@ dependencies = [
  "uuid",
 ]
 
+[[package]]
+name = "derive_builder"
+version = "0.10.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "d13202debe11181040ae9063d739fa32cfcaaebe2275fe387703460ae2365b30"
+dependencies = [
+ "derive_builder_macro 0.10.2",
+]
+
 [[package]]
 name = "derive_builder"
 version = "0.12.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "8d67778784b508018359cbc8696edb3db78160bab2c2a28ba7f56ef6932997f8"
 dependencies = [
- "derive_builder_macro",
+ "derive_builder_macro 0.12.0",
+]
+
+[[package]]
+name = "derive_builder_core"
+version = "0.10.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "66e616858f6187ed828df7c64a6d71720d83767a7f19740b2d1b6fe6327b36e5"
+dependencies = [
+ "darling 0.12.4",
+ "proc-macro2",
+ "quote",
+ "syn 1.0.109",
 ]
 
 [[package]]
@@ -1517,13 +1588,23 @@ dependencies = [
  "syn 1.0.109",
 ]
 
+[[package]]
+name = "derive_builder_macro"
+version = "0.10.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "58a94ace95092c5acb1e97a7e846b310cfbd499652f72297da7493f618a98d73"
+dependencies = [
+ "derive_builder_core 0.10.2",
+ "syn 1.0.109",
+]
+
 [[package]]
 name = "derive_builder_macro"
 version = "0.12.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ebcda35c7a396850a55ffeac740804b40ffec779b98fffbb1738f4033f0ee79e"
 dependencies = [
- "derive_builder_core",
+ "derive_builder_core 0.12.0",
  "syn 1.0.109",
 ]
 
@@ -1546,6 +1627,15 @@ version = "0.1.13"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "56254986775e3233ffa9c4d7d3faaf6d36a2c09d30b20687e9f88bc8bafc16c8"
 
+[[package]]
+name = "diffy"
+version = "0.3.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "e616e59155c92257e84970156f506287853355f58cd4a6eb167385722c32b790"
+dependencies = [
+ "nu-ansi-term",
+]
+
 [[package]]
 name = "digest"
 version = "0.10.7"
@@ -2300,6 +2390,21 @@ dependencies = [
  "syn 1.0.109",
 ]
 
+[[package]]
+name = "git2"
+version = "0.17.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8b7905cdfe33d31a88bb2e8419ddd054451f5432d1da9eaf2ac7804ee1ea12d5"
+dependencies = [
+ "bitflags 1.3.2",
+ "libc",
+ "libgit2-sys",
+ "log",
+ "openssl-probe",
+ "openssl-sys",
+ "url",
+]
+
 [[package]]
 name = "gix"
 version = "0.44.1"
@@ -3811,6 +3916,19 @@ version = "0.2.144"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "2b00cc1c228a6782d0f076e7b232802e0c5689d41bb5df366f2a6b6621cfdfe1"
 
+[[package]]
+name = "libgit2-sys"
+version = "0.15.1+1.6.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "fb4577bde8cdfc7d6a2a4bcb7b049598597de33ffd337276e9c7db6cd4a2cee7"
+dependencies = [
+ "cc",
+ "libc",
+ "libz-sys",
+ "openssl-sys",
+ "pkg-config",
+]
+
 [[package]]
 name = "libsqlite3-sys"
 version = "0.24.2"
@@ -3822,6 +3940,18 @@ dependencies = [
  "vcpkg",
 ]
 
+[[package]]
+name = "libz-sys"
+version = "1.1.9"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "56ee889ecc9568871456d42f603d6a0ce59ff328d291063a45cbdf0036baf6db"
+dependencies = [
+ "cc",
+ "libc",
+ "pkg-config",
+ "vcpkg",
+]
+
 [[package]]
 name = "line-wrap"
 version = "0.1.1"
@@ -5811,9 +5941,9 @@ dependencies = [
 
 [[package]]
 name = "sentry"
-version = "0.31.1"
+version = "0.31.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "37dd6c0cdca6b1d1ca44cde7fff289f2592a97965afec870faa7b81b9fc87745"
+checksum = "234f6e133d27140ad5ea3b369a7665f7fbc060fe246f81d8168665b38c08b600"
 dependencies = [
  "httpdate",
  "native-tls",
@@ -5829,9 +5959,9 @@ dependencies = [
 
 [[package]]
 name = "sentry-backtrace"
-version = "0.31.1"
+version = "0.31.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c029fe8317cdd75cb2b52c600bab4e2ef64c552198e669ba874340447f330962"
+checksum = "d89b6b53de06308dd5ac08934b597bcd72a9aae0c20bc3ab06da69cb34d468e3"
 dependencies = [
  "backtrace",
  "once_cell",
@@ -5841,9 +5971,9 @@ dependencies = [
 
 [[package]]
 name = "sentry-contexts"
-version = "0.31.1"
+version = "0.31.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bc575098d73c8b942b589ab453b06e4c43527556dd8f95532220d1b54d7c6b4b"
+checksum = "0769b66763e59976cd5c0fd817dcd51ccce404de8bebac0cd0e886c55b0fffa8"
 dependencies = [
  "hostname",
  "libc",
@@ -5855,9 +5985,9 @@ dependencies = [
 
 [[package]]
 name = "sentry-core"
-version = "0.31.1"
+version = "0.31.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "20216140001bbf05895f013abd0dae4df58faee24e016d54cbf107f070bac56b"
+checksum = "a1f954f1b89e8cd82576dc49bfab80304c9a6201343b4fe5c68c819f7a9bbed2"
 dependencies = [
  "once_cell",
  "rand 0.8.5",
@@ -5868,9 +5998,9 @@ dependencies = [
 
 [[package]]
 name = "sentry-debug-images"
-version = "0.31.1"
+version = "0.31.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4886e99be0a23d3f5563d74503ae97cb3443af3b0d7004e084b2ad6f7c01c678"
+checksum = "a8ddb9b6d43d251b41b792079218ef2d688bd88f01df454d338771cc146bde1a"
 dependencies = [
  "findshlibs",
  "once_cell",
@@ -5879,9 +6009,9 @@ dependencies = [
 
 [[package]]
 name = "sentry-panic"
-version = "0.31.1"
+version = "0.31.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4e45cd0a113fc06d6edba01732010518816cdc8ce3bccc70f5e41570046bf046"
+checksum = "94dc2ab494362ad51308c7c19f44e9ab70e426a931621e4a05f378a1e74558c2"
 dependencies = [
  "sentry-backtrace",
  "sentry-core",
@@ -5889,9 +6019,9 @@ dependencies = [
 
 [[package]]
 name = "sentry-tracing"
-version = "0.31.1"
+version = "0.31.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0ef4111647923c797687094bc792b8da938c4b0d64fab331d5b7a7de41964de8"
+checksum = "d0933cf65123955ddc6b95b10c73b3fdd2032a973768e072de1afd6fd2d80e3d"
 dependencies = [
  "sentry-core",
  "tracing-core",
@@ -5900,9 +6030,9 @@ dependencies = [
 
 [[package]]
 name = "sentry-types"
-version = "0.31.1"
+version = "0.31.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d7f6959d8cb3a77be27e588eef6ce9a2a469651a556d9de662e4d07e5ace4232"
+checksum = "85c53caf80cb1c6fcdf4d82b7bfff8477f50841e4caad7bf8e5e57a152b564cb"
 dependencies = [
  "debugid",
  "getrandom 0.2.9",
@@ -7026,7 +7156,7 @@ dependencies = [
  "aho-corasick 0.7.20",
  "cached-path",
  "clap 4.3.0",
- "derive_builder",
+ "derive_builder 0.12.0",
  "dirs",
  "esaxx-rs",
  "getrandom 0.2.9","#;

        assert_eq!(super::process_patch(patch), patch)
    }
}
