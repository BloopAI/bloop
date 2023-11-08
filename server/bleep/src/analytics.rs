use std::{fmt::Debug, sync::Arc};

use crate::{
    repo::RepoRef,
    state::{PersistedState, StateSource},
};

use rudderanalytics::{
    client::RudderAnalytics,
    message::{Message, Track},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct QueryEvent {
    pub query_id: Uuid,
    pub thread_id: Uuid,
    pub data: EventData,
}

#[derive(Debug, Clone)]
pub struct StudioEvent {
    pub studio_id: i64,

    // This is not a `Map<K, V>`, to prevent RudderStack from collapsing these fields into columns
    // in the analytics DB.
    pub payload: Vec<(String, Value)>,
    pub type_: String,
}

impl StudioEvent {
    pub fn new(studio_id: i64, type_: &str) -> Self {
        Self {
            studio_id,
            type_: type_.to_owned(),
            payload: Vec::new(),
        }
    }

    pub fn with_payload<T: Serialize + Clone>(mut self, name: &str, payload: &T) -> Self {
        self.payload.push((
            name.to_owned(),
            serde_json::to_value(payload.clone()).unwrap(),
        ));
        self
    }
}

#[derive(Debug, Clone)]
pub struct DocEvent {
    pub payload: Vec<(String, Value)>,
    pub type_: String,
}

impl DocEvent {
    pub fn new(type_: &str) -> Self {
        Self {
            payload: vec![],
            type_: type_.to_owned(),
        }
    }

    pub fn with_payload<T: Serialize + Clone>(mut self, name: &str, payload: &T) -> Self {
        self.payload.push((
            name.to_owned(),
            serde_json::to_value(payload.clone()).unwrap(),
        ));
        self
    }
}

#[derive(Debug, Clone)]
pub struct RepoEvent {
    pub name: String,
    pub payload: Vec<(String, Value)>,
}

impl RepoEvent {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_owned(),
            payload: vec![],
        }
    }

    pub fn with_payload<T: Serialize + Clone>(mut self, name: &str, payload: &T) -> Self {
        self.payload.push((
            name.to_owned(),
            serde_json::to_value(payload.clone()).unwrap(),
        ));
        self
    }

    pub fn add_payload<T: Serialize + Clone>(&mut self, name: &str, payload: &T) {
        self.payload.push((
            name.to_owned(),
            serde_json::to_value(payload.clone()).unwrap(),
        ));
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct EventData {
    kind: EventKind,
    name: String,

    // This is not a `Map<K, V>`, to prevent RudderStack from collapsing these fields into columns
    // in the analytics DB.
    payload: Vec<(String, Value)>,
}

#[derive(Debug, Clone, Serialize)]
pub enum EventKind {
    Input,
    Output,
}

impl EventData {
    pub fn input_stage(name: &str) -> Self {
        Self {
            kind: EventKind::Input,
            name: name.to_string(),
            payload: Vec::new(),
        }
    }

    pub fn output_stage(name: &str) -> Self {
        Self {
            kind: EventKind::Output,
            name: name.to_string(),
            payload: Vec::new(),
        }
    }

    pub fn with_payload<T: Serialize>(mut self, name: &str, payload: T) -> Self {
        self.payload
            .push((name.to_string(), serde_json::to_value(payload).unwrap()));
        self
    }
}

#[derive(Debug, serde::Serialize)]
pub struct PackageMetadata {
    pub name: &'static str,
    pub version: &'static str,
    pub git_rev: &'static str,
}

pub struct RudderHub {
    /// Rudderstack options
    options: Option<HubOptions>,

    /// Rudderstack client
    client: RudderAnalytics,

    /// User-specific store
    user_store: PersistedState<scc::HashMap<String, UserState>>,

    /// Device-specific unique identifier
    device_id: PersistedState<DeviceId>,
}

#[derive(Default)]
pub struct HubOptions {
    pub package_metadata: Option<PackageMetadata>,
}

#[derive(Serialize, Deserialize)]
pub struct DeviceId(String);

/// User-specific configuration
#[derive(Serialize, Deserialize)]
pub struct UserState {
    #[serde(default)]
    pub tracking_id: String,
}

impl RudderHub {
    #[tracing::instrument(skip_all)]
    pub fn new_with_options(
        state: &StateSource,
        device_id: impl Into<Option<String>>,
        key: String,
        data_plane: String,
        options: impl Into<Option<HubOptions>>,
    ) -> anyhow::Result<Arc<Self>> {
        let client = RudderAnalytics::load(key, data_plane);
        tracing::debug!("client initialized");

        Ok(Self {
            client,
            options: options.into(),
            user_store: state.load_or_default("user_tracking")?,
            device_id: state.load_state_or("device_id", device_id.into())?,
        }
        .into())
    }

    pub fn device_id(&self) -> String {
        self.device_id.0.trim().to_owned()
    }

    pub fn tracking_id(&self, username: Option<&str>) -> String {
        match username {
            Some(username) => {
                let id = self
                    .user_store
                    .entry(username.to_owned())
                    .or_default()
                    .get()
                    .tracking_id
                    .clone();
                _ = self.user_store.store();
                id
            }
            None => self.device_id(),
        }
    }

    /// Send a message, logging an error if it occurs.
    ///
    /// This will internally `block_in_place`.
    pub fn send(&self, message: Message) {
        if let Err(err) = tokio::task::block_in_place(|| self.client.send(&message)) {
            warn!(?err, "failed to send analytics event");
        } else {
            info!("sent analytics event...");
        }
    }

    pub fn track_query(&self, user: &crate::webserver::middleware::User, event: QueryEvent) {
        if let Some(options) = &self.options {
            self.send(Message::Track(Track {
                user_id: Some(self.tracking_id(user.username())),
                event: "openai query".to_owned(),
                properties: Some(json!({
                    "device_id": self.device_id(),
                    "query_id": event.query_id,
                    "thread_id": event.thread_id,
                    "data": event.data,
                    "package_metadata": options.package_metadata,
                })),
                ..Default::default()
            }));
        }
    }

    pub fn track_studio(&self, user: &crate::webserver::middleware::User, event: StudioEvent) {
        if let Some(options) = &self.options {
            self.send(Message::Track(Track {
                user_id: Some(self.tracking_id(user.username())),
                event: "code studio".to_owned(),
                properties: Some(json!({
                    "device_id": self.device_id(),
                    "event_type": event.type_,
                    "studio_id": event.studio_id,
                    "payload": event.payload,
                    "package_metadata": options.package_metadata,
                })),
                ..Default::default()
            }));
        }
    }

    pub fn track_doc(&self, user: &crate::webserver::middleware::User, event: DocEvent) {
        if let Some(options) = &self.options {
            self.send(Message::Track(Track {
                user_id: Some(self.tracking_id(user.username())),
                event: "doc".to_owned(),
                properties: Some(json!({
                    "device_id": self.device_id(),
                    "event_type": event.type_,
                    "payload": event.payload,
                    "package_metadata": options.package_metadata,
                })),
                ..Default::default()
            }));
        }
    }

    pub fn track_synced_repos(&self, count: usize, username: Option<&str>, org_name: Option<&str>) {
        self.send(Message::Track(Track {
            user_id: Some(self.tracking_id(username)),
            event: "track_synced_repos".into(),
            properties: Some(serde_json::json!({ "count": count, "org_name": org_name })),
            ..Default::default()
        }));
    }

    pub fn track_repo(&self, event: RepoEvent, user: &crate::webserver::middleware::User) {
        self.send(Message::Track(Track {
            user_id: Some(self.tracking_id(user.username())),
            event: "track_repo_index".into(),
            properties: Some(serde_json::json!({
                "payload": event.payload
            })),
            ..Default::default()
        }));
    }
}

impl From<Option<String>> for DeviceId {
    fn from(value: Option<String>) -> Self {
        match value {
            Some(val) => DeviceId(val),
            None => Self::default(),
        }
    }
}

impl Default for DeviceId {
    fn default() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}

impl Default for UserState {
    fn default() -> Self {
        let tracking_id = uuid::Uuid::new_v4().to_string();
        Self { tracking_id }
    }
}
