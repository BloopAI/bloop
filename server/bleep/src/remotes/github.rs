use anyhow::Result;
use chrono::{DateTime, Utc};
use octocrab::{Octocrab, models::InstallationToken};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};

use crate::state::Repository;

use super::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Auth {
    /// Copy of [`octocrab::auth::OAuth`] that can be serialized
    OAuth {
        #[serde(serialize_with = "crate::state::serialize_secret_str")]
        access_token: SecretString,
        token_type: String,
        scope: Vec<String>,
    },
    /// Github App installation token.
    App {
        #[serde(serialize_with = "crate::state::serialize_secret_str")]
        /// Technically, serializing this doesn't make any sense,
        /// because it expires quickly, but the current code paths
        /// make this the most straightforward way to implement it
        token: SecretString,
        expiry: DateTime<Utc>,
        org: String,
    },
}

impl From<octocrab::auth::OAuth> for Auth {
    fn from(auth: octocrab::auth::OAuth) -> Self {
        Self::OAuth {
            access_token: auth.access_token,
            token_type: auth.token_type,
            scope: auth.scope,
        }
    }
}

impl Auth {
    pub async fn from_installation(
        install: octocrab::models::Installation,
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
    pub fn clone_repo(&self, url: &str, target: &Path) -> Result<()> {
        git_clone(self.git_cred(), url, target)
    }

    pub fn pull_repo(&self, repo: &Repository) -> Result<()> {
        git_pull(self.git_cred(), repo)
    }

    fn git_cred(&self) -> Box<git2::Credentials<'static>> {
        use Auth::*;
        match self.clone() {
            OAuth { access_token, .. } => Box::new(move |_, _, _| {
                Cred::userpass_plaintext(access_token.expose_secret(), "ignored by github")
            }),
            App { token, .. } => Box::new(move |_, _, _| {
                Cred::userpass_plaintext("x-access-token", token.expose_secret())
            }),
        }
    }

    pub fn client(&self) -> octocrab::Result<Octocrab> {
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
}
