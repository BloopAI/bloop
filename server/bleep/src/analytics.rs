use std::time::Duration;

use crate::semantic::chunk::OverlapStrategy;

use rudderanalytics::{
    client::RudderAnalytics,
    message::{Message, Track},
};
use serde_json::{json, Value};

#[derive(Debug, Default)]
pub struct QueryEvent {
    pub user_id: String,
    pub query_id: uuid::Uuid,
    pub overlap_strategy: OverlapStrategy,
    pub stages: Vec<Stage>,
}

/// Represents a single stage of the Answer API pipeline
#[derive(Debug, serde::Serialize)]
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

pub trait QueryAnalyticsSource {
    fn track_query(&self, event: QueryEvent);
}

impl QueryAnalyticsSource for RudderAnalytics {
    fn track_query(&self, event: QueryEvent) {
        let _ = self.send(&Message::Track(Track {
            user_id: Some(event.user_id),
            event: "openai query".to_owned(),
            properties: Some(json!({
                "query_id": event.query_id,
                "overlap_strategy": event.overlap_strategy,
                "stages": event.stages,
            })),
            ..Default::default()
        }));
    }
}
