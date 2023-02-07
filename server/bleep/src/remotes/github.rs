use anyhow::Result;
use chrono::{DateTime, Utc};
use jsonwebtoken::EncodingKey;
use octocrab::{
    models::{issues::Comment, Installation, InstallationToken},
    params::issues::Sort,
    Octocrab,
};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};

use crate::state::{Backend, Repository};

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

pub(crate) async fn get_new_github_token(app: &Application) -> Result<BackendCredential> {
    let privkey = std::fs::read(
        app.config
            .github_app_private_key
            .as_ref()
            .context("missing GitHub app private key")?,
    )?;

    let install_id = app
        .config
        .github_app_install_id
        .context("need GitHub App installation ID")?;

    let octocrab = Octocrab::builder()
        .app(
            app.config
                .github_app_id
                .context("need GitHub App ID")?
                .into(),
            EncodingKey::from_rsa_pem(&privkey)
                .context("invalid GitHub app private key, expected RSA PEM format")?,
        )
        .build()?;

    let installation: Installation = octocrab
        .get(format!("app/installations/{install_id}"), None::<&()>)
        .await?;

    if installation
        .target_type
        .as_ref()
        .context("installation is missing target_type")?
        == "User"
    {
        bail!("app installation is only valid on organizations");
    }

    let auth = remotes::github::Auth::from_installation(installation, install_id, octocrab).await?;
    let credential = BackendCredential::Github(auth);
    app.credentials.insert(Backend::Github, credential.clone());

    Ok(credential)
}

pub struct Issue {
    pub number: u64,
    pub title: String,
    pub text: String,
    pub comments: Vec<String>,
}

fn issue(
    octocrab::models::issues::Issue {
        number, // octocrab
        title,
        user,
        body,
        ..
    }: octocrab::models::issues::Issue,
) -> Issue {
    Issue {
        number: number as u64,
        title,
        text: user.login + ": " + &body.unwrap_or_default(),
        comments: Vec::new(),
    }
}

fn comment(Comment { body, user, .. }: Comment) -> String {
    user.login + ": " + &body.unwrap_or_default()
}

#[allow(unused)]
/// Fetch the issues as `String`, concatenating the issue title, text and comments
pub async fn fetch_issues(owner: impl Into<String>, repo: impl Into<String>) -> Result<Vec<Issue>> {
    //TOOD: Use auth to avoid rate limiting?
    let octocrab = octocrab::instance();
    let query = octocrab.issues(owner, repo); // maximum
    let mut page = query
        .list()
        .sort(Sort::Created)
        .per_page(100)
        .send()
        .await?;
    let mut result: Vec<Issue> = page.take_items().into_iter().map(issue).collect();
    while let Some(next) = octocrab.get_page(&page.next).await? {
        page = next;
        result.extend(page.take_items().into_iter().map(issue));
    }
    for issue in &mut result {
        let comment_query = query.list_comments(issue.number);
        let Ok(mut page) = comment_query.per_page(100).send().await else { continue };
        issue
            .comments
            .extend(page.take_items().into_iter().map(comment));
        while let Some(next) = octocrab.get_page(&page.next).await? {
            page = next;
            issue
                .comments
                .extend(page.take_items().into_iter().map(comment));
        }
    }
    Ok(result)
}
