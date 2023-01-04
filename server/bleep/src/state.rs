use crate::{
    ctags::{get_symbols, SymbolMap},
    indexes,
    language::{get_language_info, LanguageInfo},
    remotes::{gather_repo_roots, BackendCredential},
};
use clap::Args;
use dashmap::DashMap;
use relative_path::RelativePath;
use secrecy::{ExposeSecret, SecretString};
use serde::{
    de::{DeserializeOwned, Error},
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::{
    collections::HashSet,
    fmt::{self, Display},
    ops::Not,
    path::{Path, PathBuf},
    str::FromStr,
    sync::Arc,
    time::SystemTime,
};
use tracing::debug;
use utoipa::ToSchema;

#[derive(Hash, Eq, PartialEq, Debug, Clone)]
pub struct RepoRef(Backend, String);
pub(crate) type RepositoryPool = Arc<DashMap<RepoRef, Repository>>;
pub(crate) type Credentials = Arc<DashMap<Backend, BackendCredential>>;

include!(concat!(env!("OUT_DIR"), "/schema_version.rs"));

pub fn serialize_secret_opt_str<S>(
    opt_secstr: &Option<SecretString>,
    ser: S,
) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    match opt_secstr {
        Some(secstr) => ser.serialize_some(secstr.expose_secret()),
        None => ser.serialize_none(),
    }
}

pub fn serialize_secret_str<S>(secstr: &SecretString, ser: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    ser.serialize_str(secstr.expose_secret())
}

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

    pub fn indexed_name(&self) -> String {
        // Local repos indexed as: dirname
        // Github repos indexed as: github.com/org/repo
        match self.0 {
            Backend::Local => Path::new(&self.1)
                .file_name()
                .expect("last component is `..`")
                .to_string_lossy()
                .into(),
            Backend::Github => format!("github.com/{}", &self.1),
        }
    }

    pub fn display_name(&self) -> String {
        match self.0 {
            // org_name/repo_name
            Backend::Github => self.1.to_owned(),
            // repo_name
            Backend::Local => self.indexed_name(),
        }
    }

    pub fn local_path(&self) -> Option<PathBuf> {
        match self.0 {
            Backend::Local => Some(PathBuf::from(&self.1)),
            _ => None,
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

    pub(crate) fn open_walker(&self) -> ignore::Walk {
        ignore::WalkBuilder::new(&self.disk_path).build()
    }

    pub(crate) async fn get_head_info(&self) -> Arc<RepoHeadInfo> {
        let repo = git2::Repository::open(&self.disk_path)
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

        RepoHeadInfo {
            last_commit_unix_secs: repo,
            symbols: get_symbols(&self.disk_path, exclude_langs).await,
            langs: get_language_info(&self.disk_path),
        }
        .into()
    }

    pub(crate) async fn index(
        &self,
        reporef: &RepoRef,
        writers: &indexes::GlobalWriteHandleRef<'_>,
    ) -> Result<Arc<RepoHeadInfo>, RepoError> {
        use rayon::prelude::*;
        let info = self.get_head_info().await;

        tokio::task::block_in_place(|| {
            writers
                .par_iter()
                .map(|handle| handle.index(reporef, self, &info))
                .collect::<Result<Vec<_>, _>>()
        })?;

        Ok(info)
    }

    pub(crate) fn delete(&mut self) {
        self.sync_status = SyncStatus::Removed;
    }

    pub(crate) fn sync_done_with(&mut self, info: Arc<RepoHeadInfo>) {
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

#[derive(Serialize, Deserialize, Args, Debug, Clone, Default)]
#[serde(rename_all = "snake_case")]
pub struct StateSource {
    /// Directory where repositories are located
    #[clap(short, long = "source-dir")]
    #[serde(default)]
    directory: Option<PathBuf>,

    /// State file for all repositories
    #[clap(short, long)]
    #[serde(default)]
    state_file: Option<PathBuf>,

    /// Credentials store for external providers
    #[clap(long)]
    #[serde(default)]
    credentials: Option<PathBuf>,

    /// Version of the current schema
    #[clap(short, long)]
    #[serde(default)]
    version_file: Option<PathBuf>,
}

impl StateSource {
    pub fn set_default_dir(&mut self, dir: &Path) {
        self.state_file
            .get_or_insert_with(|| dir.join("repo_state.json"));

        self.credentials
            .get_or_insert_with(|| dir.join("credentials.json"));

        self.version_file
            .get_or_insert_with(|| dir.join("version.json"));

        self.directory.get_or_insert_with(|| {
            let target = dir.join("local_cache");
            std::fs::create_dir_all(&target).unwrap();

            target
        });
    }

    pub fn initialize_pool(&self) -> Result<RepositoryPool, RepoError> {
        match (self.directory.as_ref(), self.state_file.as_ref()) {
            (Some(root), None) => read_root(root),
            (None, Some(path)) => read_file_or_default(path),

            (Some(root), Some(path)) => {
                let state: RepositoryPool = read_file_or_default(path)?;
                let current_repos = gather_repo_roots(root).collect::<HashSet<_>>();
                let root = dunce::canonicalize(root)?;

                // mark repositories from the index which are no longer present
                for mut elem in state.iter_mut() {
                    let k = elem.key();

                    if let Some(path) = k.local_path() {
                        // clippy suggestion causes the code to break, revisit after 1.66
                        #[allow(clippy::needless_borrow)]
                        if path.starts_with(&root) && current_repos.contains(k).not() {
                            debug!(reporef=%k, "repo scheduled to be removed;");
                            elem.value_mut().delete();
                        }
                    }

                    // in case the app terminated during indexing, make sure to re-queue it
                    if elem.sync_status == SyncStatus::Indexing {
                        elem.value_mut().sync_status = SyncStatus::Queued;
                    }
                }

                // then add anything new that's appeared
                let per_path = state
                    .iter()
                    .map(|elem| {
                        (
                            elem.disk_path.to_string_lossy().to_string(),
                            elem.key().clone(),
                        )
                    })
                    .collect::<DashMap<_, _>>();

                for reporef in current_repos {
                    // skip all paths that are already in the index,
                    // bearing in mind they may not be local repos
                    if per_path.contains_key(reporef.name()) {
                        debug!(%reporef, "repo has already been initialized;");
                        continue;
                    }

                    state
                        .entry(reporef.to_owned())
                        .or_insert_with(|| Repository::local_from(&reporef));
                }

                Ok(state)
            }
            (None, None) => Err(RepoError::NoSourceGiven),
        }
    }

    pub fn index_version_mismatch(&self) -> bool {
        let current: Arc<String> =
            read_file_or_default(self.version_file.as_ref().unwrap()).unwrap();

        current.is_empty().not() && current.as_ref() != SCHEMA_VERSION
    }

    pub fn save_index_version(&self) -> Result<(), RepoError> {
        pretty_write_file(self.version_file.as_ref().unwrap(), SCHEMA_VERSION)
    }

    pub fn save_pool(&self, pool: RepositoryPool) -> Result<(), RepoError> {
        match self.state_file {
            None => Err(RepoError::NoSourceGiven),
            Some(ref path) => pretty_write_file(path, pool.as_ref()),
        }
    }

    pub(crate) fn initialize_credentials(&self) -> Result<Credentials, RepoError> {
        read_file_or_default(self.credentials.as_ref().unwrap())
    }

    pub(crate) fn save_credentials(&self, creds: Credentials) -> Result<(), RepoError> {
        match self.credentials {
            None => Err(RepoError::NoSourceGiven),
            Some(ref path) => pretty_write_file(path, creds.as_ref()),
        }
    }

    pub(crate) fn repo_path_for_name(&self, name: &str) -> PathBuf {
        self.directory.as_ref().unwrap().join(name)
    }

    pub fn directory(&self) -> PathBuf {
        let dir = self.directory.as_deref().unwrap();
        RelativePath::from_path(dir)
            .map(|p| p.to_logical_path(std::env::current_dir().unwrap()))
            .unwrap_or_else(|_| dir.to_owned())
    }
}

pub fn pretty_write_file<T: Serialize + ?Sized>(
    path: impl AsRef<Path>,
    val: &T,
) -> Result<(), RepoError> {
    let tmpfile = path.as_ref().with_extension("new");
    let file = std::fs::File::create(&tmpfile)?;
    serde_json::to_writer_pretty(file, val)?;
    std::fs::rename(tmpfile, path)?;

    Ok(())
}

pub fn read_file_or_default<T: Default + DeserializeOwned>(
    path: &Path,
) -> Result<Arc<T>, RepoError> {
    if path.exists().not() {
        return Ok(Default::default());
    }

    let file = std::fs::File::open(path)?;
    Ok(Arc::new(serde_json::from_reader::<_, T>(file)?))
}

fn read_root(path: &Path) -> Result<RepositoryPool, RepoError> {
    Ok(gather_repo_roots(path)
        .map(|reporef| {
            let repo = Repository::local_from(&reporef);
            (reporef, repo)
        })
        .collect::<DashMap<_, _>>()
        .into())
}

#[derive(Debug)]
pub struct RepoHeadInfo {
    pub last_commit_unix_secs: u64,
    pub symbols: SymbolMap,
    pub langs: LanguageInfo,
}

#[derive(Serialize, Deserialize, ToSchema, Hash, PartialEq, Eq, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Backend {
    Local,
    Github,
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
    Done,
}

#[derive(Serialize, Deserialize, ToSchema, PartialEq, Eq, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum RepoRemote {
    Git(GitRemote),
    None,
}

impl<T: AsRef<RepoRef>> From<T> for RepoRemote {
    fn from(reporef: T) -> Self {
        match reporef.as_ref() {
            RepoRef(Backend::Github, name) => RepoRemote::Git(GitRemote {
                protocol: GitProtocol::Https,
                host: "github.com".to_owned(),
                address: name.to_owned(),
            }),
            RepoRef(Backend::Local, _name) => RepoRemote::None,
        }
    }
}

impl Display for RepoRemote {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RepoRemote::Git(GitRemote {
                protocol,
                host,
                address,
            }) => match protocol {
                GitProtocol::Https => write!(f, "https://{host}/{address}.git"),
                GitProtocol::Ssh => write!(f, "git@{host}:{address}.git"),
            },
            RepoRemote::None => write!(f, "none"),
        }
    }
}

impl FromStr for RepoRemote {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        if let Some(stripped) = value.strip_prefix("https://github.com/") {
            return Ok(RepoRemote::Git(GitRemote {
                protocol: GitProtocol::Https,
                host: "github.com".to_owned(),
                address: stripped
                    .trim_end_matches('/')
                    .trim_end_matches(".git")
                    .to_owned(),
            }));
        }

        if let Some(stripped) = value.strip_prefix("git@github.com:") {
            return Ok(RepoRemote::Git(GitRemote {
                protocol: GitProtocol::Ssh,
                host: "github.com".to_owned(),
                address: stripped
                    .trim_start_matches('/')
                    .trim_end_matches('/')
                    .trim_end_matches(".git")
                    .to_owned(),
            }));
        }

        Err(())
    }
}

#[derive(Serialize, Deserialize, ToSchema, PartialEq, Eq, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct GitRemote {
    /// protocol to use during git operations
    pub protocol: GitProtocol,
    /// Hostname of provider
    pub host: String,
    /// any kind of `protocol` and [`Backend`]-dependent address
    pub address: String,
}

#[derive(Serialize, Deserialize, ToSchema, PartialEq, Eq, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum GitProtocol {
    Https,
    Ssh,
}

#[cfg(test)]
mod test {
    use tempdir::TempDir;

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

    #[test]
    fn parse_reporemote() {
        let https = RepoRemote::Git(GitRemote {
            host: "github.com".into(),
            address: "org/repo".into(),
            protocol: GitProtocol::Https,
        });

        let ssh = RepoRemote::Git(GitRemote {
            host: "github.com".into(),
            address: "org/repo".into(),
            protocol: GitProtocol::Ssh,
        });

        assert_eq!(https, "https://github.com/org/repo".parse().unwrap());
        assert_eq!(https, "https://github.com/org/repo.git".parse().unwrap());
        assert_eq!(ssh, "git@github.com:/org/repo.git".parse().unwrap());
        assert_eq!(ssh, "git@github.com:/org/repo".parse().unwrap());
        assert_eq!(ssh, "git@github.com:org/repo".parse().unwrap());
        assert_eq!(ssh, "git@github.com:org/repo.git".parse().unwrap());
        assert_eq!(ssh, "git@github.com:org/repo.git/".parse().unwrap());
        assert_eq!(ssh, "git@github.com:/org/repo.git/".parse().unwrap());
    }

    #[test]
    fn test_repos_in() {
        let tmpdir = TempDir::new("test-find-repos").unwrap();
        let path = tmpdir.path();

        let repos = [
            "bloopai/enterprise-search",
            "bloopai/query-parser",
            "bloopai/foo-repo",
            "bloopai/foo-repo/bar-submodule",
        ];

        let files = [
            "foo/README.md",
            "bar.txt",
            "bloopai/enterprise-search/src/main.rs",
            "bloopai/query-parser/target/release/libenterprise_search.so",
        ];

        for repo in repos {
            std::fs::create_dir_all(path.join(repo).join(".git")).unwrap();
        }

        for file in files {
            let path = path.join(file);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, "").unwrap();
        }

        let repo_pool = StateSource {
            directory: Some(path.to_path_buf()),
            credentials: None,
            state_file: None,
            version_file: None,
        }
        .initialize_pool()
        .unwrap();

        let mut found_repos = repo_pool
            .iter()
            .map(|repo| repo.disk_path.to_str().unwrap().to_string())
            .collect::<Vec<_>>();
        found_repos.sort();

        let repo = |subdir| {
            dunce::canonicalize(path.join(subdir))
                .unwrap()
                .to_str()
                .unwrap()
                .to_owned()
        };
        let mut expected_repos = vec![
            repo("bloopai/enterprise-search"),
            repo("bloopai/query-parser"),
            repo("bloopai/foo-repo"),
            repo("bloopai/foo-repo/bar-submodule"),
        ];
        expected_repos.sort();

        assert_eq!(found_repos, expected_repos);
    }
}
