use crate::{
    remotes::{gather_repo_roots, BackendCredential},
    repo::{Backend, RepoError, RepoRef, Repository, SyncStatus},
};
use anyhow::Result;
use clap::Args;
use rand::Rng;
use relative_path::RelativePath;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    collections::HashSet,
    ops::Deref,
    path::{Path, PathBuf},
    sync::Arc,
};
use tracing::debug;

include!(concat!(env!("OUT_DIR"), "/schema_version.rs"));

pub(crate) type RepositoryPool = Arc<scc::HashMap<RepoRef, Repository>>;

#[derive(Serialize, Deserialize, Args, Debug, Clone, Default, PartialEq)]
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

    /// Cookie private key file
    #[clap(long)]
    #[serde(default)]
    cookie_key: Option<PathBuf>,
}

/// Unified wrapper to persist state in the central state-store.
/// Every model is stored in its own file as a pretty-printed json.
pub struct PersistedState<T> {
    path: PathBuf,
    state: Arc<T>,
}

impl<T: Serialize + DeserializeOwned + Default + Send + Sync> PersistedState<T> {
    fn load_or_default(name: &'static str, source: &StateSource) -> Result<Self> {
        let path = source.directory().join(name).with_extension("json");
        Ok(Self {
            state: Arc::new(read_file_or_default(&path)?),
            path,
        })
    }

    fn load_or(name: &'static str, source: &StateSource, val: T) -> Self {
        let path = source.directory().join(name).with_extension("json");
        Self {
            state: Arc::new(read_file(&path).unwrap_or(val)),
            path,
        }
    }

    pub fn store(&self) -> Result<()> {
        Ok(pretty_write_file(&self.path, self.state.as_ref())?)
    }
}

impl<T> Deref for PersistedState<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.state
    }
}

impl<T> Clone for PersistedState<T> {
    fn clone(&self) -> Self {
        Self {
            path: self.path.clone(),
            state: self.state.clone(),
        }
    }
}

impl StateSource {
    pub(crate) fn set_default_dir(&mut self, dir: &Path) {
        std::fs::create_dir_all(dir).expect("the index folder can't be created");

        self.state_file
            .get_or_insert_with(|| dir.join("repo_state.json"));

        self.credentials
            .get_or_insert_with(|| dir.join("credentials.json"));

        self.version_file
            .get_or_insert_with(|| dir.join("version.json"));

        self.cookie_key
            .get_or_insert_with(|| dir.join("cookie_key.bin"));

        self.directory.get_or_insert_with(|| {
            let target = dir.join("local_cache");
            std::fs::create_dir_all(&target).unwrap();

            target
        });
    }

    pub(crate) fn load_or_default<T: Serialize + DeserializeOwned + Default + Send + Sync>(
        &self,
        name: &'static str,
    ) -> Result<PersistedState<T>> {
        PersistedState::load_or_default(name, self)
    }

    pub(crate) fn load_state_or<T: Serialize + DeserializeOwned + Default + Send + Sync>(
        &self,
        name: &'static str,
        val: impl Into<T>,
    ) -> Result<PersistedState<T>> {
        let val = PersistedState::load_or(name, self, val.into());
        val.store()?;
        Ok(val)
    }

    pub(crate) fn repo_dir(&self) -> Option<PathBuf> {
        self.directory.clone()
    }

    pub fn directory(&self) -> PathBuf {
        let dir = self.directory.as_deref().unwrap();
        get_relative_path(dir, std::env::current_dir().unwrap())
    }

    pub(crate) fn repo_path_for_name(&self, name: &str) -> PathBuf {
        self.directory.as_ref().unwrap().join(name)
    }

    pub(crate) fn initialize_pool(&self) -> Result<RepositoryPool, RepoError> {
        #[cfg(target = "windows")]
        use dunce::canonicalize;
        #[cfg(not(target = "windows"))]
        use std::fs::canonicalize;

        match (self.directory.as_ref(), self.state_file.as_ref()) {
            // Load RepositoryPool from path
            (None, Some(path)) => read_file_or_default(path).map(Arc::new),

            // Initialize RepositoryPool from repos under `root`
            (Some(root), None) => {
                let out = scc::HashMap::default();
                for reporef in gather_repo_roots(root, None) {
                    let repo = Repository::local_from(&reporef);
                    _ = out.insert(reporef, repo);
                }

                let pool = Arc::new(out);
                self.save_pool(pool.clone())?;
                Ok(pool)
            }
            // Update RepositoryPool with repos under `root`
            (Some(root), Some(path)) => {
                // Load RepositoryPool from path
                let state: RepositoryPool = Arc::new(read_file_or_default(path)?);

                let current_repos = gather_repo_roots(root, None).collect::<HashSet<_>>();
                let root = canonicalize(root)?;

                // mark repositories from the index which are no longer present
                state.for_each(|k, repo| {
                    if let Some(path) = k.local_path() {
                        // Clippy suggestion causes the code to break, revisit after 1.66
                        if path.starts_with(&root) && !current_repos.contains(k) {
                            debug!(reporef=%k, "repo scheduled to be removed;");
                            repo.mark_removed();
                        }
                    }

                    // in case the app terminated during indexing, make sure to re-queue it
                    if repo.sync_status == SyncStatus::Indexing {
                        repo.mark_queued();
                    }
                });

                // then add anything new that's appeared
                let mut per_path = std::collections::HashMap::new();
                state.scan(|k, v| {
                    per_path.insert(v.disk_path.to_string_lossy().to_string(), k.clone());
                });

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

                self.save_pool(state.clone())?;
                Ok(state)
            }
            (None, None) => Err(RepoError::NoSourceGiven),
        }
    }

    pub fn save_pool(&self, pool: RepositoryPool) -> Result<(), RepoError> {
        match self.state_file {
            None => Err(RepoError::NoSourceGiven),
            Some(ref path) => pretty_write_file(path, pool.as_ref()),
        }
    }

    pub(crate) fn initialize_credentials(
        &self,
    ) -> Result<std::collections::HashMap<Backend, BackendCredential>, RepoError> {
        read_file_or_default(self.credentials.as_ref().unwrap())
    }

    pub(crate) fn save_credentials(&self, creds: impl Serialize) -> Result<(), RepoError> {
        match self.credentials {
            None => Err(RepoError::NoSourceGiven),
            Some(ref path) => pretty_write_file(path, &creds),
        }
    }

    pub fn index_version_mismatch(&self) -> bool {
        let current: String = read_file_or_default(self.version_file.as_ref().unwrap()).unwrap();

        !current.is_empty() && current != SCHEMA_VERSION
    }

    pub fn save_index_version(&self) -> Result<(), RepoError> {
        pretty_write_file(self.version_file.as_ref().unwrap(), SCHEMA_VERSION)
    }

    pub fn initialize_cookie_key(&self) -> Result<axum_extra::extract::cookie::Key> {
        let path = self.cookie_key.as_ref().unwrap();

        if path.exists() {
            let master_key = std::fs::read(path)?;
            Ok(axum_extra::extract::cookie::Key::from(&master_key))
        } else {
            let master_key = axum_extra::extract::cookie::Key::generate();
            std::fs::write(path, master_key.master())?;
            Ok(master_key)
        }
    }
}

pub fn pretty_write_file<T: Serialize + ?Sized>(
    path: impl AsRef<Path>,
    val: &T,
) -> Result<(), RepoError> {
    let tmpfile = path
        .as_ref()
        .with_extension("new")
        .with_extension(format!("{}", rand::thread_rng().gen_range(0..=9999)));

    let file = {
        let mut tries = 0;
        const MAX_TRIES: u8 = 10;

        loop {
            let file = std::fs::File::options()
                .write(true)
                .create_new(true)
                .open(&tmpfile);

            if file.is_ok() || tries == MAX_TRIES {
                break file;
            }

            tries += 1;
        }
    }?;

    serde_json::to_writer_pretty(file, val)?;
    std::fs::rename(tmpfile, path)?;

    Ok(())
}

pub fn read_file<T: Default + DeserializeOwned>(path: &Path) -> Result<T, RepoError> {
    let file = std::fs::File::open(path)?;
    Ok(serde_json::from_reader::<_, T>(file)?)
}

pub fn read_file_or_default<T: Default + DeserializeOwned>(path: &Path) -> Result<T, RepoError> {
    if !path.exists() {
        return Ok(Default::default());
    }

    let file = std::fs::File::open(path)?;
    Ok(serde_json::from_reader::<_, T>(file)?)
}

pub fn get_relative_path<P>(path: &Path, base: P) -> PathBuf
where
    P: AsRef<Path>,
{
    RelativePath::from_path(path)
        .map(|rp| rp.to_logical_path(base))
        .unwrap_or_else(|_| path.to_owned())
}

#[cfg(test)]
mod test {
    use super::*;
    use tempdir::TempDir;

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
            state_file: Some(path.join("state.json")),
            credentials: None,
            version_file: None,
            cookie_key: None,
        }
        .initialize_pool()
        .unwrap();

        let mut found_repos = vec![];
        repo_pool.scan(|_k, repo| found_repos.push(repo.disk_path.to_str().unwrap().to_string()));
        found_repos.sort();

        let repo = |subdir| {
            crate::canonicalize(path.join(subdir))
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
