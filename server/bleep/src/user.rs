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
    #[serde(default = "default_is_tutorial_finished")]
    is_tutorial_finished: bool,
}

impl Default for UserProfile {
    fn default() -> Self {
        UserProfile {
            username: None,
            prompt_guide: PromptGuideState::Active,
            is_tutorial_finished: default_is_tutorial_finished(),
        }
    }
}

fn default_is_tutorial_finished() -> bool {
    false
}
