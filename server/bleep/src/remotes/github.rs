use chrono::{DateTime, Utc};
use octocrab::Octocrab;
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use serde_json::json;

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

    pub fn client(&self) -> octocrab::Result<Octocrab> {
        self.auth.client()
    }

    pub(crate) async fn validate(&self) -> Result<Option<String>> {
        let client = self.client()?;

        let username = match client.current().user().await {
            Ok(user) => Some(user.login),
            Err(e @ octocrab::Error::GitHub { .. }) => {
                warn!(?e, "failed to validate GitHub token");
                return Err(e)?;
            }
            Err(e) => {
                // Don't return an error here - we want to swallow failure and try again on the
                // next poll.
                error!(?e, "failed to make GitHub user request");
                None
            }
        };

        Ok(username)
    }

    pub(crate) fn expiry(&self) -> Option<DateTime<Utc>> {
        match self.auth {
            Auth::App {
                expires_at: expiry, ..
            } => Some(expiry),
            _ => None,
        }
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
pub(crate) enum Auth {
    OAuth(CognitoGithubTokenBundle),
    /// Github App installation token.
    App {
        #[serde(serialize_with = "crate::config::serialize_secret_str")]
        /// Technically, serializing this doesn't make any sense,
        /// because it expires quickly, but the current code paths
        /// make this the most straightforward way to implement it
        token: SecretString,
        expires_at: DateTime<Utc>,
        org: String,
    },
}

impl From<Auth> for State {
    fn from(value: Auth) -> Self {
        State::with_auth(value)
    }
}

impl Auth {
    pub(crate) async fn clone_repo(&self, repo: &Repository) -> Result<()> {
        let creds = self.creds_for_private_repos(repo).await?;
        git_clone(creds, &repo.remote.to_string(), &repo.disk_path).await
    }

    pub(crate) async fn pull_repo(&self, repo: &Repository) -> Result<()> {
        let creds = self.creds_for_private_repos(repo).await?;
        git_pull(creds, repo).await
    }

    async fn creds_for_private_repos(&self, repo: &Repository) -> Result<Option<GitCreds>> {
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

        Ok(repo
            .private
            .map(|private| if private { Some(self.git_cred()) } else { None })
            .unwrap_or_else(|| Some(self.git_cred())))
    }

    fn git_cred(&self) -> GitCreds {
        use Auth::*;
        match self {
            OAuth(CognitoGithubTokenBundle {
                github_access_token,
                ..
            }) => GitCreds {
                username: "x-access-token".into(),
                password: github_access_token.into(),
            },
            App { token, .. } => GitCreds {
                username: "x-access-token".into(),
                password: token.expose_secret().into(),
            },
        }
    }

    fn client(&self) -> octocrab::Result<Octocrab> {
        use Auth::*;
        match self.clone() {
            OAuth(CognitoGithubTokenBundle {
                github_access_token,
                ..
            }) => {
                let token = octocrab::auth::OAuth {
                    access_token: github_access_token.into(),
                    token_type: "Bearer".into(),
                    scope: vec![],
                };

                Octocrab::builder().oauth(token).build()
            }
            App { token, .. } => Octocrab::builder()
                .personal_token(token.expose_secret().to_string())
                .build(),
        }
    }

    async fn list_repos(&self) -> Result<Vec<octocrab::models::Repository>> {
        let gh_client = self.client().expect("failed to build github client");
        let mut results = vec![];
        for page in 1.. {
            let mut resp = match self {
                remotes::github::Auth::OAuth { .. } => {
                    gh_client
                        .current()
                        .list_repos_for_authenticated_user()
                        .per_page(100)
                        .page(page)
                        .send()
                        .await
                }
                remotes::github::Auth::App { ref org, .. } => {
                    gh_client
                        .orgs(org)
                        .list_repos()
                        .per_page(100)
                        .page(page)
                        .send()
                        .await
                }
            }?;

            if resp.items.is_empty() {
                break;
            }

            results.extend(resp.take_items())
        }

        Ok(results)
    }
}

pub(crate) async fn refresh_github_installation_token(app: &Application) -> Result<()> {
    let timestamp = chrono::Utc::now();
    let payload = json!({ "timestamp": timestamp.to_rfc2822()});
    let state = app.seal_auth_state(payload);

    let token_url = app
        .config
        .cognito_mgmt_url
        .as_ref()
        .expect("bad config")
        .join("refresh_token")
        .unwrap();

    let response: RefreshTokenResponse = reqwest::Client::new()
        .post(token_url)
        .json(&json!({ "state": state }))
        .send()
        .await
        .map_err(RemoteError::RefreshToken)?
        .json()
        .await
        .map_err(RemoteError::RefreshToken)?;

    app.credentials.set_github(State::with_auth(Auth::App {
        org: app.config.bloop_instance_org.clone().unwrap(),
        token: response.token,
        expires_at: response.expires_at,
    }));

    Ok(())
}

#[derive(Deserialize)]
struct RefreshTokenResponse {
    token: SecretString,
    expires_at: DateTime<Utc>,
}
