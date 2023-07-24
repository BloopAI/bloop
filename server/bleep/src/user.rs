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
    prompt_guide: PromptGuideState,
}

impl Default for UserProfile {
    fn default() -> Self {
        UserProfile {
            prompt_guide: PromptGuideState::Active,
        }
    }
}
