use std::{borrow::Borrow, sync::Arc};

use anyhow::Result;
use chrono::{Duration, Utc};
use dashmap::DashMap;
use tracing::error;

use crate::{
    remotes::{self, BackendCredential},
    AuthenticationLayer, Environment,
};

use super::Backend;

type CredStore = DashMap<Backend, BackendCredential>;

#[derive(Clone)]
pub(crate) struct Credentials {
    credstore: Arc<CredStore>,
    auth: AuthenticationLayer,
    env: Environment,
}

impl Credentials {
    pub(super) fn new(
        credstore: Arc<CredStore>,
        auth: AuthenticationLayer,
        env: Environment,
    ) -> Self {
        Self {
            credstore,
            auth,
            env,
        }
    }

    pub(super) fn serializable(&self) -> &CredStore {
        &self.credstore
    }

    pub fn get(&self, backend: impl Borrow<Backend>) -> Option<BackendCredential> {
        self.credstore
            .get(backend.borrow())
            .map(|elem| elem.value().clone())
    }

    pub fn insert(&self, backend: impl Borrow<Backend>, creds: BackendCredential) {
        self.credstore.insert(backend.borrow().clone(), creds);
    }

    pub fn remove(&self, backend: impl Borrow<Backend>) -> Option<(Backend, BackendCredential)> {
        self.credstore.remove(backend.borrow())
    }

    /// Does its best to ensure a fresh github token is available.
    ///
    /// The idea is that this MUST be called periodically, and
    /// therefore shouldn't blow up the call site.
    /// There is no error reporting here, apart from the log entries
    /// generated.
    pub(crate) async fn ensure_fresh_github_installation_token(&self) {
        let Some(BackendCredential::Github(auth)) = self.get(Backend::Github) else {
	    _ = self.get_new_github_token().await;
	    return;
	};

        if let remotes::github::Auth::JWT { expiry, .. } = auth {
            if expiry < Utc::now() + Duration::minutes(10) {
                _ = self.get_new_github_token().await;
            }
        }
    }

    pub(crate) async fn github_client(&self) -> Option<octocrab::Octocrab> {
        let auth = match self.get(Backend::Github) {
            Some(BackendCredential::Github(auth)) => auth,
            None if self.env.use_aaa() => {
                let BackendCredential::Github(auth) = self.get_new_github_token().await.ok()?;
                auth
            }
            None => return None,
        };

        auth.client().ok()
    }

    async fn get_new_github_token(&self) -> Result<BackendCredential> {
        let jwt = self
            .auth
            .get("/private/jwt")
            .await?
            .json::<BackendCredential>()
            .await;

        match jwt {
            Ok(token) => {
                self.insert(Backend::Github, token.clone());
                Ok(token)
            }
            Err(err) => {
                error!(?err, "failed to refresh token");
                Err(err.into())
            }
        }
    }
}
