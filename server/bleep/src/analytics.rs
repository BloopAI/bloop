use crate::{semantic::chunk::OverlapStrategy, webserver::answer::api::Snippet};
use rudderanalytics::{
    client::RudderAnalytics,
    message::{Message, Track},
};
use serde_json::json;

pub struct QueryEvent {
    pub user_id: String,
    pub query: String,
    pub select_prompt: String,
    pub semantic_results: Vec<Snippet>,
    pub filtered_semantic_results: Vec<Snippet>,
    pub relevant_snippet_index: usize,
    pub explain_prompt: String,
    pub explanation: String,
    pub overlap_strategy: OverlapStrategy,
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
                "id": uuid::Uuid::new_v4().to_string(),
                "overlap_strategy": event.overlap_strategy,
                "stages": [
                    {
                        "name": "user query",
                        "type": "string",
                        "data": event.query,
                    },
                    {
                        "name": "semantic results",
                        "type": "array",
                        "data": event.semantic_results,
                    },
                    {
                        "name": "filtered semantic results",
                        "type": "array",
                        "data": event.filtered_semantic_results,
                    },
                    {
                        "name": "select prompt",
                        "type": "string",
                        "data": event.select_prompt,
                    },
                    {
                        "name": "relevant snippet index",
                        "type": "number",
                        "data": event.relevant_snippet_index,
                    },
                    {
                        "name": "explain prompt",
                        "type": "string",
                        "data": event.explain_prompt,
                    },
                    {
                        "name": "explanation",
                        "type": "string",
                        "data": event.explanation,
                    }
                ]
            })),
            ..Default::default()
        }));
    }
}
