use secrecy::{ExposeSecret, Secret};
use segment::{
    message::{Track, User},
    Client, Message,
};
use serde_json::json;

pub struct Segment {
    pub key: Secret<String>,
    pub client: segment::HttpClient,
}

impl Segment {
    pub fn new(segment_key: Secret<String>) -> Segment {
        Self {
            key: segment_key,
            client: segment::HttpClient::default(),
        }
    }

    pub async fn track_query(&self, user_id: &str, query: &str, snippet: &str, response: &str) {
        self.client
            .send(
                self.key.expose_secret().clone(),
                Message::from(Track {
                    user: User::UserId {
                        user_id: user_id.to_owned(),
                    },
                    event: "openai query".to_owned(),
                    properties: json!({
                        "query": query.to_owned(),
                        "relevant_snippet": snippet.to_owned(),
                        "response": response.to_owned(),
                        "id": uuid::Uuid::new_v4()
                    }),
                    ..Default::default()
                }),
            )
            .await
            .expect("Could not send to Segment");
    }
}
