use anyhow::Result;
use chrono::{DateTime, Utc};
use octocrab::Octocrab;
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
    /// Github App Installation JWT token.
    JWT {
        #[serde(serialize_with = "crate::state::serialize_secret_str")]
        /// Technically, serializing this doesn't make any sense,
        /// because it expires quickly, but the current code paths
        /// make this the most straightforward way to implement it
        token: SecretString,
        expiry: DateTime<Utc>,
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
            JWT { token, .. } => Box::new(move |_, _, _| {
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
            JWT { token, .. } => Octocrab::builder()
                .personal_token(token.expose_secret().to_string())
                .build(),
        }
    }
}
