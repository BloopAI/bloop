use crate::agent::prompts;
use std::str::FromStr;

#[derive(Debug, Copy, Clone)]
pub struct LLMModel {
    /// The name of this model according to tiktoken
    pub tokenizer: &'static str,

    /// The name of this model for use in the llm gateway
    pub model_name: &'static str,

    /// The number of tokens reserved for the answer
    pub answer_headroom: usize,

    /// The number of tokens reserved for the prompt
    pub prompt_headroom: usize,

    /// The number of tokens reserved for history
    pub history_headroom: usize,

    /// The system prompt to be used
    pub system_prompt: fn(&str) -> String,
}

pub const GPT_3_5_TURBO_FINETUNED: LLMModel = LLMModel {
    tokenizer: "gpt-3.5-turbo-0613",
    model_name: "gpt-3.5-turbo-finetuned",
    answer_headroom: 512,
    prompt_headroom: 1600,
    history_headroom: 1024,
    system_prompt: prompts::answer_article_prompt_finetuned,
};

// GPT-4 turbo has a context window of 128k tokens
const GPT_4_TURBO_MAX_TOKENS: usize = 128_000;
// We want to use only 24k tokens
const ACTUAL_MAX_TOKENS: usize = 24_000;
// 104k tokens should be left unused. This is done by adding 104k to the headrooms
// (tokens left unused for other purposes answer, prompt...)
const HEADROOM_CORRECTION: usize = GPT_4_TURBO_MAX_TOKENS - ACTUAL_MAX_TOKENS;
// PS: when we want to fully utilize the model max context window, the correction is 0
pub const GPT_4_TURBO_24K: LLMModel = LLMModel {
    tokenizer: "gpt-4-1106-preview",
    model_name: "gpt-4-1106-preview",
    answer_headroom: 1024 + HEADROOM_CORRECTION,
    prompt_headroom: 2500 + HEADROOM_CORRECTION,
    history_headroom: 2048 + HEADROOM_CORRECTION,
    system_prompt: prompts::answer_article_prompt,
};

pub const GPT_4: LLMModel = LLMModel {
    tokenizer: "gpt-4-0613",
    model_name: "gpt-4-0613",
    answer_headroom: 1024,
    prompt_headroom: 2500,
    history_headroom: 2048,
    system_prompt: prompts::answer_article_prompt,
};

impl FromStr for LLMModel {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        #[allow(clippy::wildcard_in_or_patterns)]
        match s {
            "gpt-4" => Ok(GPT_4),
            "gpt-4-turbo-24k" => Ok(GPT_4_TURBO_24K),
            "gpt-3.5-turbo-finetuned" | _ => Ok(GPT_3_5_TURBO_FINETUNED),
        }
    }
}

impl<'de> serde::Deserialize<'de> for LLMModel {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        s.parse::<LLMModel>()
            .map_err(|_| serde::de::Error::custom("failed to deserialize"))
    }
}
