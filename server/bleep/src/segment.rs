use segment::{
    message::{Track, User},
    Client, Message,
};
use serde_json::json;

pub struct QueryEvent {
    pub user_id: String,
    pub query: String,
    pub select_prompt: String,
    pub relevant_snippet_index: usize,
    pub explain_prompt: String,
    pub explanation: String,
}

pub struct Segment {
    pub key: String,
    pub client: segment::HttpClient,
}

impl Segment {
    pub fn new(segment_key: String) -> Segment {
        Self {
            key: segment_key,
            client: segment::HttpClient::default(),
        }
    }

    pub async fn track_query(&self, event: QueryEvent) {
        self.client
            .send(
                self.key.clone(),
                Message::from(Track {
                    user: User::UserId {
                        user_id: event.user_id,
                    },
                    event: "openai query".to_owned(),
                    properties: json!({
                        "query": event.query,
                        "select_prompt": event.select_prompt,
                        "relevant_snippet_index": event.relevant_snippet_index,
                        "explain_prompt": event.explain_prompt,
                        "explanation": event.explanation,
                        "id": uuid::Uuid::new_v4().to_string()
                    }),
                    ..Default::default()
                }),
            )
            .await
            .expect("Could not send to Segment");
    }
}
