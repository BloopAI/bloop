pub type Embedding = Vec<f32>;

#[derive(Default, Clone, Debug, serde::Deserialize, serde::Serialize)]
pub struct Payload {
    pub lang: String,
    pub repo_name: String,
    pub repo_ref: String,
    pub relative_path: String,
    pub content_hash: String,
    pub text: String,
    pub start_line: u64,
    pub end_line: u64,
    pub start_byte: u64,
    pub end_byte: u64,
    pub branches: Vec<String>,

    #[serde(skip)]
    pub id: Option<String>,
    #[serde(skip)]
    pub embedding: Option<Embedding>,
    #[serde(skip)]
    pub score: Option<f32>,
}

impl PartialEq for Payload {
    fn eq(&self, other: &Self) -> bool {
        self.lang == other.lang
            && self.repo_name == other.repo_name
            && self.repo_ref == other.repo_ref
            && self.relative_path == other.relative_path
            && self.content_hash == other.content_hash
            && self.text == other.text
            && self.start_line == other.start_line
            && self.end_line == other.end_line
            && self.start_byte == other.start_byte
            && self.end_byte == other.end_byte
            && self.branches == other.branches

        // ignoring deserialized fields that will not exist on a newly
        // created payload
    }
}
