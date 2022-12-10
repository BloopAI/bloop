use anyhow::Result;
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};

use crate::state::Repository;

use super::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Auth {
    #[serde(serialize_with = "crate::state::serialize_secret_str")]
    pub access_token: SecretString,
    pub token_type: String,
    pub scope: Vec<String>,
}

impl Auth {
    pub fn clone_repo(&self, url: &str, target: &Path) -> Result<()> {
        git_clone(self.git_cred(), url, target)
    }

    pub fn pull_repo(&self, repo: &Repository) -> Result<()> {
        git_pull(self.git_cred(), repo)
    }

    fn git_cred(&self) -> Box<git2::Credentials<'static>> {
        let token = self.access_token.clone();
        Box::new(move |_, _, _| Cred::userpass_plaintext(token.expose_secret(), "x-oauth-basic"))
    }
}
