use octocrab::Octocrab;
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::repo::{GitRemote, RepoRemote, Repository};

use super::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct State {
    pub auth: Auth,
    #[serde(skip)]
    pub repositories: Arc<Vec<octocrab::models::Repository>>,
}

impl State {
    pub(crate) fn with_auth(auth: Auth) -> Self {
        Self {
            auth,
            repositories: Arc::default(),
        }
    }

    pub(crate) async fn username(&self) -> Result<String> {
        self.auth.username().await
    }

    pub fn client(&self) -> octocrab::Result<Octocrab> {
        self.auth.client()
    }

    /// Get a representative list of repositories currently accessible
    pub async fn current_repo_list(&self) -> Result<Vec<octocrab::models::Repository>> {
        self.auth.list_repos().await
    }

    /// Create a new object with the updated repositories list
    ///
    /// This is a separate step from refreshing the repo list to avoid
    /// async locking
    pub fn update_repositories(self, repos: Vec<octocrab::models::Repository>) -> Self {
        Self {
            auth: self.auth,
            repositories: repos.into(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct Auth {
    #[serde(serialize_with = "crate::config::serialize_secret_str")]
    token: SecretString,
}

impl From<Auth> for State {
    fn from(value: Auth) -> Self {
        State::with_auth(value)
    }
}

impl Auth {
    pub(crate) fn new(token: SecretString) -> Self {
        Self { token }
    }

    /// Return credentials for private repositories, and no credentials for public ones.
    pub(crate) async fn creds(&self, repo: &Repository) -> Result<Option<GitCreds>> {
        let RepoRemote::Git(GitRemote { ref address, .. }) = repo.remote else {
            return Err(RemoteError::NotSupported("github without git backend"));
        };

        let (org, reponame) = address
            .split_once('/')
            .ok_or(RemoteError::NotSupported("invalid repo address"))?;

        let response = self.client()?.repos(org, reponame).get().await;
        let repo = match response {
            Err(octocrab::Error::GitHub { ref source, .. })
                if "Not Found" == source.message.as_str() =>
            {
                // GitHub API will send 403 for API-level issues, not object-level permissions
                // A user having had their permissions removed will receive 404.
                return Err(RemoteError::RemoteNotFound);
            }
            // I'm leaving this here for completeness' sake, this likely isn't exercised
            // Octocrab seems to treat GitHub application-layer errors as higher priority
            Err(octocrab::Error::Http { .. }) => return Err(RemoteError::PermissionDenied),
            Err(err) => return Err(err)?,
            Ok(details) => details,
        };

        Ok(match repo.private {
            // No credentials for public repos
            Some(false) => None,
            // Not sure there's a reason GitHub API wouldn't return a value,
            // but provide credentials by default to be on the safe side.
            _ => Some(self.git_cred()),
        })
    }

    pub(crate) async fn username(&self) -> Result<String> {
        let client = self.client()?;
        let user = client.current().user().await?.login;
        Ok(user)
    }

    fn git_cred(&self) -> GitCreds {
        GitCreds {
            username: "x-access-token".into(),
            password: self.token.expose_secret().into(),
        }
    }

    fn client(&self) -> octocrab::Result<Octocrab> {
        let token = octocrab::auth::OAuth {
            access_token: self.token.clone(),
            token_type: "Bearer".into(),
            scope: vec![],
        };

        Octocrab::builder().oauth(token).build()
    }

    async fn list_repos(&self) -> Result<Vec<octocrab::models::Repository>> {
        let gh_client = self.client().expect("failed to build github client");
        let mut results = vec![];
        for page in 1.. {
            let mut resp = gh_client
                .current()
                .list_repos_for_authenticated_user()
                .per_page(100)
                .page(page)
                .send()
                .await?;

            if resp.items.is_empty() {
                break;
            }

            results.extend(resp.take_items())
        }

        Ok(results)
    }
}
