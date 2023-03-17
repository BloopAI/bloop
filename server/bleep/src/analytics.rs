use std::sync::Arc;
use std::time::Duration;

use crate::semantic::chunk::OverlapStrategy;

use once_cell::sync::OnceCell;
use rudderanalytics::{
    client::RudderAnalytics,
    message::{Message, Track},
};
use serde_json::{json, Value};
use tracing::info;

#[derive(Debug, Default, Clone)]
pub struct QueryEvent {
    pub user_id: String,
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

static HUB: OnceCell<Arc<RudderHub>> = OnceCell::new();

pub struct RudderHub {
    options: Option<HubOptions>,
    client: RudderAnalytics,
}

#[derive(Default)]
pub struct HubOptions {
    pub event_filter: Option<Arc<dyn Fn(QueryEvent) -> Option<QueryEvent> + Send + Sync + 'static>>,
    pub package_metadata: Option<PackageMetadata>,
}

impl RudderHub {
    pub fn new(key: String, data_plane: String) -> Arc<Self> {
        let client = RudderAnalytics::load(key, data_plane);
        let hub = Self {
            client,
            options: None,
        };
        let _ = HUB.set(Arc::new(hub));
        RudderHub::get().unwrap()
    }

    pub fn new_with_options(key: String, data_plane: String, options: HubOptions) -> Arc<Self> {
        let client = RudderAnalytics::load(key, data_plane);
        let hub = Self {
            client,
            options: Some(options),
        };
        let _ = HUB.set(Arc::new(hub));
        RudderHub::get().unwrap()
    }

    pub fn get() -> Option<Arc<Self>> {
        HUB.get().map(Arc::clone)
    }

    pub fn track_query(event: QueryEvent) {
        if let Some(hub) = Self::get() {
            if let Some(options) = &hub.options {
                if let Some(filter) = &options.event_filter {
                    if let Some(ev) = (filter)(event) {
                        if let Err(e) = hub.client.send(&Message::Track(Track {
                            user_id: Some(ev.user_id),
                            event: "openai query".to_owned(),
                            properties: Some(json!({
                                "query_id": ev.query_id,
                                "overlap_strategy": ev.overlap_strategy,
                                "stages": ev.stages,
                                "package_metadata": options.package_metadata,
                            })),
                            ..Default::default()
                        })) {
                            info!("failed to send analytics event: {:?}", e);
                        } else {
                            info!("sent analytics event ...");
                        }
                    }
                }
            }
        }
    }
}

impl Stage {
    pub fn new<T: serde::Serialize>(name: &'static str, data: T) -> Self {
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
