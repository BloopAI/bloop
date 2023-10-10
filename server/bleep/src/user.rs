use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum PromptGuideState {
    Dismissed,
    Active,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct UserProfile {
    pub username: Option<String>,
    prompt_guide: PromptGuideState,
    #[serde(default = "default_allow_session_recordings")]
    allow_session_recordings: bool,
}

impl Default for UserProfile {
    fn default() -> Self {
        UserProfile {
            username: None,
            prompt_guide: PromptGuideState::Active,
            allow_session_recordings: default_allow_session_recordings(),
        }
    }
}

fn default_allow_session_recordings() -> bool {
    true
}
