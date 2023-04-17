use std::sync::Arc;
use std::time::Duration;

use crate::{
    semantic::chunk::OverlapStrategy,
    state::{PersistedState, StateSource},
};

use rudderanalytics::{
    client::RudderAnalytics,
    message::{Message, Track},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{info, warn};

#[derive(Debug, Default, Clone)]
pub struct QueryEvent {
    pub session_id: String,
    pub query_id: uuid::Uuid,
    pub overlap_strategy: OverlapStrategy,
    pub stages: Vec<Stage>,
}

/// Represents a single stage of the Answer API pipeline
#[derive(Debug, serde::Serialize, Clone)]
pub struct Stage {
    /// The name of this stage, e.g.: "filtered semantic results"
    pub name: &'static str,

    /// The type of the data being serialized
    #[serde(rename = "type")]
    pub _type: &'static str,

    /// Stage payload
    pub data: Value,

    /// Time taken for this stage in milliseconds
    pub time_elapsed: Option<u128>,
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
    pub event_filter: Option<Arc<dyn Fn(QueryEvent) -> Option<QueryEvent> + Send + Sync + 'static>>,
    pub package_metadata: Option<PackageMetadata>,
}

#[derive(Serialize, Deserialize)]
pub struct DeviceId(String);

/// User-specific configuration
#[derive(Serialize, Deserialize)]
pub struct UserState {
    #[serde(default)]
    tracking_id: String,
}

impl RudderHub {
    pub fn new_with_options(
        state: &StateSource,
        device_id: impl Into<Option<String>>,
        key: String,
        data_plane: String,
        options: impl Into<Option<HubOptions>>,
    ) -> anyhow::Result<Arc<Self>> {
        let client = RudderAnalytics::load(key, data_plane);
        Ok(Self {
            client,
            options: options.into(),
            user_store: state.load_or_default("user_tracking")?,
            device_id: state.load_state_or("device_id", device_id.into())?,
        }
        .into())
    }

    pub fn device_id(&self) -> String {
        self.device_id.to_string()
    }

    pub fn tracking_id(&self, user: &crate::webserver::middleware::User) -> String {
        match user.0 {
            Some(ref username) => {
                let id = self
                    .user_store
                    .entry(username.clone())
                    .or_default()
                    .get()
                    .tracking_id();
                _ = self.user_store.store();
                id
            }
            None => self.device_id.to_string(),
        }
    }

    pub fn track_query(&self, user: &crate::webserver::middleware::User, event: QueryEvent) {
        if let Some(options) = &self.options {
            if let Some(filter) = &options.event_filter {
                if let Some(ev) = (filter)(event) {
                    if let Err(err) = self.client.send(&Message::Track(Track {
                        user_id: Some(self.tracking_id(user)),
                        event: "openai query".to_owned(),
                        properties: Some(json!({
                            "query_id": ev.query_id,
                            "session_id": ev.session_id,
                            "overlap_strategy": ev.overlap_strategy,
                            "stages": ev.stages,
                            "package_metadata": options.package_metadata,
                        })),
                        ..Default::default()
                    })) {
                        warn!(?err, "failed to send analytics event");
                    } else {
                        info!("sent analytics event...");
                    }
                }
            }
        }
    }
}

impl Stage {
    pub fn new<T: Serialize>(name: &'static str, data: T) -> Self {
        let data = serde_json::to_value(data).unwrap();
        let _type = match data {
            Value::Null => "null",
            Value::Bool(_) => "bool",
            Value::Number(_) => "number",
            Value::String(_) => "string",
            Value::Array(_) => "array",
            Value::Object(_) => "object",
        };
        Self {
            name,
            _type,
            data,
            time_elapsed: None,
        }
    }

    pub fn with_time(mut self, time_elapsed: Duration) -> Self {
        self.time_elapsed = Some(time_elapsed.as_millis());
        self
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

impl ToString for DeviceId {
    fn to_string(&self) -> String {
        self.0.to_string()
    }
}

impl Default for DeviceId {
    fn default() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}

impl UserState {
    pub fn tracking_id(&self) -> String {
        self.tracking_id.clone()
    }
}

impl Default for UserState {
    fn default() -> Self {
        let tracking_id = uuid::Uuid::new_v4().to_string();
        Self { tracking_id }
    }
}
