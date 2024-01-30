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
    #[serde(default = "default_is_tutorial_finished")]
    is_tutorial_finished: bool,
}

impl Default for UserProfile {
    fn default() -> Self {
        UserProfile {
            username: None,
            prompt_guide: PromptGuideState::Active,
            allow_session_recordings: default_allow_session_recordings(),
            is_tutorial_finished: default_is_tutorial_finished(),
        }
    }
}

fn default_allow_session_recordings() -> bool {
    true
}
fn default_is_tutorial_finished() -> bool {
    false
}
