use crate::agent::prompts;
use std::str::FromStr;

#[derive(Debug, Copy, Clone)]
pub struct AnswerModel {
    /// The name of this model according to tiktoken
    pub tokenizer: &'static str,

    /// The name of this model for use in the llm gateway
    pub model_name: &'static str,

    /// The maximum number of tokens to use
    pub max_tokens: usize,

    /// The number of tokens reserved for the answer
    pub answer_headroom: usize,

    /// The number of tokens reserved for the prompt
    pub prompt_headroom: usize,

    /// The number of tokens reserved for history
    pub history_headroom: usize,

    /// The system prompt to be used
    pub system_prompt: fn(&str) -> String,
}

pub const GPT_3_5_TURBO_FINETUNED: AnswerModel = AnswerModel {
    tokenizer: "gpt-3.5-turbo-0613",
    model_name: "gpt-3.5-turbo-finetuned",
    max_tokens: 4000,
    answer_headroom: 512,
    prompt_headroom: 1600,
    history_headroom: 1024,
    system_prompt: prompts::answer_article_prompt_finetuned,
};

pub const GPT_4: AnswerModel = AnswerModel {
    tokenizer: "gpt-4-1106-preview",
    model_name: "gpt-4-1106-preview",
    max_tokens: 24000,
    answer_headroom: 1024,
    prompt_headroom: 1500,
    history_headroom: 2048,
    system_prompt: prompts::answer_article_prompt,
};

impl AnswerModel {
    /// Returns the maximum number of tokens that can be used for context
    pub fn get_max_context_tokens(&self) -> usize {
        self.max_tokens - self.answer_headroom - self.prompt_headroom - self.history_headroom
    }
}

impl FromStr for AnswerModel {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        #[allow(clippy::wildcard_in_or_patterns)]
        match s {
            "gpt-3.5-turbo-finetuned" => Ok(GPT_3_5_TURBO_FINETUNED),
            "gpt-4" | _ => Ok(GPT_4),
        }
    }
}

impl<'de> serde::Deserialize<'de> for AnswerModel {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        s.parse::<AnswerModel>()
            .map_err(|_| serde::de::Error::custom("failed to deserialize"))
    }
}
