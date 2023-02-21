use anyhow::bail;
use dashmap::DashMap;
use relative_path::RelativePath;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::{
    fmt::Display,
    path::{Path, PathBuf},
    str::FromStr,
    sync::Arc,
    time::SystemTime,
};
use tracing::debug;
use utoipa::ToSchema;

use crate::{
    ctags::{get_symbols, SymbolMap},
    indexes,
    language::{get_language_info, LanguageInfo},
    remotes::RepoRemote,
    state::pretty_write_file,
};

pub(crate) type FileCache = Arc<DashMap<PathBuf, FreshValue<String>>>;

#[derive(Serialize, Deserialize)]
pub(crate) struct FreshValue<T> {
    // default value is `false` on deserialize
    #[serde(skip)]
    pub(crate) fresh: bool,
    pub(crate) value: T,
}

impl<T> From<T> for FreshValue<T> {
    fn from(value: T) -> Self {
        Self { fresh: true, value }
    }
}

// Types of repo
#[derive(Serialize, Deserialize, ToSchema, Hash, PartialEq, Eq, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Backend {
    Local,
    Github,
}

// Repository identifier
#[derive(Hash, Eq, PartialEq, Debug, Clone)]
pub struct RepoRef(Backend, String);

impl RepoRef {
    pub fn new(backend: Backend, name: &(impl AsRef<str> + ?Sized)) -> Result<Self, RepoError> {
        use Backend::*;
        match backend {
            Github => Ok(RepoRef(backend, name.as_ref().to_owned())),
            Local => {
                let path = Path::new(name.as_ref());

                if !path.is_absolute() {
                    return Err(RepoError::NonAbsoluteLocal);
                }

                // TODO: What does this do?
                for component in path.components() {
                    use std::path::Component::*;
                    match component {
                        CurDir | ParentDir => return Err(RepoError::InvalidPath),
                        _ => continue,
                    }
                }

                Ok(RepoRef(backend, name.as_ref().to_owned()))
            }
        }
    }

    pub fn from_components(root: &Path, components: Vec<String>) -> Result<Self, RepoError> {
        let refstr = components.join("/");
        let pathstr = match refstr.trim_start_matches('/').split_once('/') {
            Some(("github.com", name)) => return RepoRef::new(Backend::Github, name),
            Some(("local", name)) => name,
            _ => &refstr,
        };

        let path = Path::new(pathstr);
        // TODO: This is used elsewhere?
        let local_path = RelativePath::from_path(path)
            .map(|rp| rp.to_logical_path(root))
            .unwrap_or_else(|_| path.to_owned());

        Self::new(Backend::Local, &local_path.to_string_lossy())
    }

    pub fn backend(&self) -> Backend {
        self.0.clone()
    }

    pub fn name(&self) -> &str {
        &self.1
    }

    pub fn is_local(&self) -> bool {
        self.0 == Backend::Local
    }

    pub fn indexed_name(&self) -> String {
        // Local repos indexed as: dirname
        // Github repos indexed as: github.com/org/repo
        match self.0 {
            Backend::Local => Path::new(&self.1)
                .file_name()
                .expect("last component is `..`")
                .to_string_lossy()
                .into(),
            Backend::Github => format!("{}", self),
        }
    }

    pub fn local_path(&self) -> Option<PathBuf> {
        match self.0 {
            Backend::Local => Some(PathBuf::from(&self.1)),
            _ => None,
        }
    }

    // TODO: Shouldn't this be a method on some other object?
    pub fn delete(self, app: &Application) -> anyhow::Result<()> {
        match app.repo_pool.get_mut(&self) {
            Some(mut result) => {
                result.value_mut().mark_removed();
                app.write_index().queue_sync_and_index(vec![self]);
                Ok(())
            }
            None => bail!("Repo not found"),
        }
    }
}

impl AsRef<RepoRef> for RepoRef {
    fn as_ref(&self) -> &RepoRef {
        self
    }
}

impl<P: AsRef<Path>> From<&P> for RepoRef {
    fn from(path: &P) -> Self {
        assert!(path.as_ref().is_absolute());
        RepoRef(Backend::Local, path.as_ref().to_string_lossy().to_string())
    }
}

impl From<&str> for RepoRef {
    fn from(refstr: &str) -> Self {
        Self::from_str(refstr).unwrap()
    }
}

impl FromStr for RepoRef {
    type Err = RepoError;

    fn from_str(refstr: &str) -> Result<Self, Self::Err> {
        match refstr.trim_start_matches('/').split_once('/') {
            // github.com/...
            Some(("github.com", name)) => RepoRef::new(Backend::Github, name),
            // local/...
            Some(("local", name)) => RepoRef::new(Backend::Local, name),
            _ => Err(RepoError::InvalidBackend),
        }
    }
}

impl Display for RepoRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.backend() {
            Backend::Github => write!(f, "github.com/{}", self.name()),
            Backend::Local => write!(f, "local/{}", self.name()),
        }
    }
}

impl Serialize for RepoRef {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for RepoRef {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        String::deserialize(deserializer).and_then(|s| {
            RepoRef::from_str(s.as_str()).map_err(|e| D::Error::custom(e.to_string()))
        })
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Repository {
    pub disk_path: PathBuf,
    pub remote: RepoRemote,
    pub sync_status: SyncStatus,
    pub last_commit_unix_secs: u64,
    pub last_index_unix_secs: u64,
    pub most_common_lang: Option<String>,
}

impl Repository {
    /// Only use this with local refs
    ///
    /// # Panics
    ///
    /// When used with non-local refs
    pub(crate) fn local_from(reporef: &RepoRef) -> Self {
        let disk_path = reporef.local_path().unwrap();

        let remote = git2::Repository::open(&disk_path)
            .ok()
            .and_then(|git| {
                git.find_remote("origin").ok().and_then(|origin| {
                    origin.url().and_then(|url| {
                        debug!(%reporef, origin=url, "found git repo with `origin` remote");
                        url.parse().ok()
                    })
                })
            })
            .unwrap_or_else(|| RepoRemote::from(reporef));

        Self {
            sync_status: SyncStatus::Queued,
            last_index_unix_secs: 0,
            last_commit_unix_secs: 0,
            disk_path,
            remote,
            most_common_lang: None,
        }
    }

    pub(crate) async fn index(
        &self,
        reporef: &RepoRef,
        writers: &indexes::GlobalWriteHandleRef<'_>,
    ) -> Result<Arc<RepoMetadata>, RepoError> {
        use rayon::prelude::*;
        let metadata = get_repo_metadata(&self.disk_path).await;

        tokio::task::block_in_place(|| {
            writers
                .par_iter()
                .map(|handle| handle.index(reporef, self, &metadata))
                .collect::<Result<Vec<_>, _>>()
        })?;

        Ok(metadata)
    }

    pub(crate) async fn delete(&self) {}

    /// Marks the repository for removal on the next sync
    /// Does not initiate a new sync.
    pub(crate) fn mark_removed(&mut self) {
        self.sync_status = SyncStatus::Removed;
    }

    pub(crate) fn sync_done_with(&mut self, info: Arc<RepoMetadata>) {
        self.last_index_unix_secs = get_unix_time(SystemTime::now());
        self.last_commit_unix_secs = info.last_commit_unix_secs;
        self.sync_status = SyncStatus::Done;
        self.most_common_lang = info.langs.most_common_lang.map(|l| l.to_string());
    }

    fn file_cache_path(&self, index_dir: &Path) -> PathBuf {
        let path_hash = blake3::hash(self.disk_path.to_string_lossy().as_bytes()).to_string();
        index_dir.join(path_hash).with_extension("json")
    }

    pub(crate) fn open_file_cache(&self, index_dir: &Path) -> Result<FileCache, RepoError> {
        let file_name = self.file_cache_path(index_dir);
        match std::fs::File::open(file_name) {
            Ok(state) => Ok(Arc::new(serde_json::from_reader(state)?)),
            Err(_) => Ok(Default::default()),
        }
    }

    pub(crate) fn save_file_cache(
        &self,
        index_dir: &Path,
        cache: FileCache,
    ) -> Result<(), RepoError> {
        let file_name = self.file_cache_path(index_dir);
        pretty_write_file(file_name, cache.as_ref())
    }

    pub(crate) fn delete_file_cache(&self, index_dir: &Path) -> Result<(), RepoError> {
        Ok(std::fs::remove_file(self.file_cache_path(index_dir))?)
    }
}

fn get_unix_time(time: SystemTime) -> u64 {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .expect("system time error")
        .as_secs()
}

#[derive(Debug)]
pub struct RepoMetadata {
    pub last_commit_unix_secs: u64,
    pub symbols: SymbolMap,
    pub langs: LanguageInfo,
}

async fn get_repo_metadata(repo_disk_path: &PathBuf) -> Arc<RepoMetadata> {
    let repo = git2::Repository::open(repo_disk_path)
        .and_then(|repo| Ok(repo.head()?.peel_to_commit()?.time().seconds() as u64))
        .unwrap_or(0);

    // There might be a way to generate this list from intelligence::ALL_LANGUAGES,
    // but not all lang_ids are valid ctags' languages though, so we hardcode some here:
    let exclude_langs = &[
        "javascript",
        "typescript",
        "python",
        "go",
        "c",
        "rust",
        "c++",
        "c#",
        "java",
        // misc languages
        "json",
        "markdown",
        "rmarkdown",
        "iniconf",
        "man",
        "protobuf",
    ];

    RepoMetadata {
        last_commit_unix_secs: repo,
        symbols: get_symbols(repo_disk_path, exclude_langs).await,
        langs: get_language_info(repo_disk_path),
    }
    .into()
}

#[derive(Serialize, Deserialize, ToSchema, PartialEq, Eq, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    Error { message: String },
    Uninitialized,
    Removed,
    Syncing,
    Queued,
    Indexing,
    RemoteRemoved,
    Done,
}

impl SyncStatus {
    pub(crate) fn indexable(&self) -> bool {
        use SyncStatus::*;
        matches!(self, Queued | Done | Error { .. })
    }
}

#[derive(thiserror::Error, Debug)]
pub enum RepoError {
    #[error("no source configured")]
    NoSourceGiven,
    #[error("local repository must have an absolute path")]
    NonAbsoluteLocal,
    #[error("paths can't contain `..` or `.`")]
    InvalidPath,
    #[error("backend not recognized")]
    InvalidBackend,
    #[error("IO error: {error}")]
    IO {
        #[from]
        error: std::io::Error,
    },
    #[error("invalid state file")]
    Decode {
        #[from]
        error: serde_json::Error,
    },
    #[error("indexing error")]
    Anyhow {
        #[from]
        error: anyhow::Error,
    },
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn parse_reporef() {
        assert_eq!(
            "github.com/bloopai/bloop".parse::<RepoRef>().unwrap(),
            RepoRef(Backend::Github, "bloopai/bloop".to_string())
        );
        assert_eq!(
            "local//tmp/repository".parse::<RepoRef>().unwrap(),
            RepoRef(Backend::Local, "/tmp/repository".to_string())
        );
        assert_eq!(
            "local//tmp/repository".parse::<RepoRef>().unwrap(),
            RepoRef(Backend::Local, "/tmp/repository".to_string())
        );
        if let Ok(_) = "repository".parse::<RepoRef>() {
            panic!("non-absolute local allowed")
        }
    }

    #[test]
    fn serialize_reporef() {
        assert_eq!(
            r#""github.com/org/repo""#,
            &serde_json::to_string(&RepoRef(Backend::Github, "org/repo".into())).unwrap()
        );
        assert_eq!(
            r#""local//org/repo""#,
            &serde_json::to_string(&RepoRef(Backend::Local, "/org/repo".into())).unwrap()
        );
    }
}
