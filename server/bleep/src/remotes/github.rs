use chrono::{DateTime, Utc};
use jsonwebtoken::EncodingKey;
use octocrab::{
    models::{Installation, InstallationToken},
    Octocrab,
};

use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};

use crate::repo::{GitRemote, RepoRemote, Repository};

use super::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct State {
    pub auth: Auth,
    #[serde(skip)]
    pub repositories: Arc<Vec<octocrab::models::Repository>>,
}

impl State {
    fn with_auth(auth: Auth) -> Self {
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
            Auth::App { expiry, .. } => Some(expiry),
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
    /// Copy of [`octocrab::auth::OAuth`] that can be serialized
    OAuth {
        #[serde(serialize_with = "crate::config::serialize_secret_str")]
        access_token: SecretString,
        token_type: String,
        scope: Vec<String>,
    },
    /// Github App installation token.
    App {
        #[serde(serialize_with = "crate::config::serialize_secret_str")]
        /// Technically, serializing this doesn't make any sense,
        /// because it expires quickly, but the current code paths
        /// make this the most straightforward way to implement it
        token: SecretString,
        expiry: DateTime<Utc>,
        org: String,
    },
}

impl From<octocrab::auth::OAuth> for State {
    fn from(auth: octocrab::auth::OAuth) -> Self {
        Self::with_auth(Auth::OAuth {
            access_token: auth.access_token,
            token_type: auth.token_type,
            scope: auth.scope,
        })
    }
}

impl Auth {
    pub async fn from_installation(
        install: Installation,
        install_id: u64,
        octocrab: Octocrab,
    ) -> Result<Self> {
        let token: InstallationToken = octocrab
            .post(
                format!("app/installations/{install_id}/access_tokens"),
                None::<&()>,
            )
            .await?;

        Ok(Self::App {
            token: token.token.into(),
            expiry: token.expires_at.unwrap().parse().unwrap(),
            org: install.account.login,
        })
    }
}

impl Auth {
    pub(crate) async fn clone_repo(&self, repo: Repository) -> Result<()> {
        self.check_repo(&repo).await?;
        git_clone(self.git_cred(), &repo.remote.to_string(), &repo.disk_path).await
    }

    pub(crate) async fn pull_repo(&self, repo: Repository) -> Result<()> {
        self.check_repo(&repo).await?;
        git_pull(self.git_cred(), &repo).await
    }

    pub async fn check_repo(&self, repo: &Repository) -> Result<()> {
        let RepoRemote::Git(GitRemote {
            ref address, ..
        }) = repo.remote else {
            return Err(RemoteError::NotSupported("github without git backend"));
        };

        let (org, reponame) = address
            .split_once('/')
            .ok_or(RemoteError::NotSupported("invalid repo address"))?;

        let response = self.client()?.repos(org, reponame).get().await;
        match response {
            Err(octocrab::Error::GitHub { ref source, .. }) => match source.message.as_str() {
                // GitHub API will send 403 for API-level issues, not object-level permissions
                // A user having had their permissions removed will receive 404.
                "Not Found" => Err(RemoteError::RemoteNotFound),
                _ => Ok(response.map(|_| ())?),
            },
            // I'm leaving this here for completeness' sake, this likely isn't exercised
            // Octocrab seems to treat GitHub application-layer errors as higher priority
            Err(octocrab::Error::Http { .. }) => Err(RemoteError::PermissionDenied),
            _ => Ok(response.map(|_| ())?),
        }
    }

    fn git_cred(&self) -> GitCreds {
        use Auth::*;
        match self {
            OAuth { access_token, .. } => GitCreds {
                username: access_token.expose_secret().into(),
                password: "".into(),
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
            OAuth {
                access_token,
                token_type,
                scope,
            } => {
                let token = octocrab::auth::OAuth {
                    access_token,
                    token_type,
                    scope,
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
    let privkey = std::fs::read(
        app.config
            .github_app_private_key
            .as_ref()
            .ok_or(RemoteError::Configuration("github_app_private_key"))?,
    )?;

    let install_id = app
        .config
        .github_app_install_id
        .ok_or(RemoteError::Configuration("github_app_install_id"))?;

    let octocrab = Octocrab::builder()
        .app(
            app.config
                .github_app_id
                .ok_or(RemoteError::Configuration("github_app_id"))?
                .into(),
            EncodingKey::from_rsa_pem(&privkey)?,
        )
        .build()?;

    let installation: Installation = octocrab
        .get(format!("app/installations/{install_id}"), None::<&()>)
        .await?;

    if !matches!(installation.target_type.as_deref(), Some("Organization")) {
        return Err(RemoteError::NotSupported(
            "installation target must be an organization",
        ));
    };

    let auth = remotes::github::Auth::from_installation(installation, install_id, octocrab).await?;

    app.credentials.set_github(State::with_auth(auth));
    Ok(())
}
