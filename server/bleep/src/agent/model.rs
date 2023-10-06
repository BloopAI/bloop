use std::str::FromStr;

#[derive(Debug, Copy, Clone)]
pub struct AnswerModel {
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
}

pub const GPT_3_5_TURBO_FINETUNED: AnswerModel = AnswerModel {
    tokenizer: "gpt-3.5-turbo-0613",
    model_name: "gpt-3.5-turbo-finetuned",
    answer_headroom: 512,
    prompt_headroom: 1600,
    history_headroom: 1024,
};

pub const GPT_4: AnswerModel = AnswerModel {
    tokenizer: "gpt-4-0613",
    model_name: "gpt-4-0613",
    answer_headroom: 1024,
    prompt_headroom: 2500,
    history_headroom: 2048,
};

pub const GPT_3_5_TURBO_FINETUNED_AGENT: AnswerModel = AnswerModel {
    tokenizer: "gpt-3.5-turbo-0613",
    model_name: "ft:gpt-3.5-turbo-0613:bloop:agent-function:86UMuKnt",
    answer_headroom: 512,
    prompt_headroom: 1600,
    history_headroom: 256,
};

impl FromStr for AnswerModel {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        #[allow(clippy::wildcard_in_or_patterns)]
        match s {
            "gpt-4" => Ok(GPT_4),
            "gpt-3.5-turbo-finetuned" | _ => Ok(GPT_3_5_TURBO_FINETUNED),
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
