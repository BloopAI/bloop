use std::borrow::Cow;

pub type Embedding = Vec<f32>;

#[derive(Default, Clone, Debug, serde::Deserialize, serde::Serialize)]
pub struct Payload<'a> {
    pub lang: Cow<'a, str>,
    pub repo_name: Cow<'a, str>,
    pub repo_ref: Cow<'a, str>,
    pub relative_path: Cow<'a, str>,
    pub text: Cow<'a, str>,
    pub start_line: u64,
    pub end_line: u64,
    pub start_byte: u64,
    pub end_byte: u64,
    pub branches: Vec<String>,

    #[serde(skip)]
    pub embedding: Option<Embedding>,
    #[serde(skip)]
    pub score: Option<f32>,
}
