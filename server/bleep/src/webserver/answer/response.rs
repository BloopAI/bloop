use super::{Conversation, ConversationId};

/// The continually updated response object. Initial events from the server contain
/// nulls or defaults. This object is updated via `ResponseState::apply_update` as we
/// recieve stream portions of the answer.
#[derive(serde::Serialize, Debug, Clone, Default)]
pub struct ResponseState {
    thread_id: String,
    user_id: String,

    /// A GPT generated description of this thread.
    description: Option<String>,

    // TODO: tooling-state-update/@np should contain history of chats between user and
    // assistant only, omitting system prompts or intermediate assistant steps.
    messages: Vec<UpdatableMessage>,
}

impl ResponseState {
    /// Constructs a new `ResponseState` for a given conversation.
    ///
    /// TODO: this should also extract and populate conversation history.
    pub(super) fn new(conversation_id: &ConversationId, conversation: &Conversation) -> Self {
        let thread_id = conversation_id.thread_id.clone();
        let user_id = conversation_id.user_id.clone();
        let description = Some(format!(
            "New conversation in {}",
            conversation.repo_ref.display_name()
        ));
        let messages = vec![UpdatableMessage::Assistant(AssistantMessage::default())];
        Self {
            thread_id,
            user_id,
            description,
            messages,
        }
    }

    /// A reference to the (partial) response from the assistant
    fn current_message(&self) -> &AssistantMessage {
        match self.messages.last().unwrap() {
            UpdatableMessage::User(_) => {
                panic!("called `current_message` when last message was a `user` message")
            }
            UpdatableMessage::Assistant(a) => a,
        }
    }

    /// A mutable reference to the (partial) response from the assistant
    fn current_message_mut(&mut self) -> &mut AssistantMessage {
        match self.messages.last_mut().unwrap() {
            UpdatableMessage::User(_) => {
                panic!("called `current_message_mut` when last message was a `user` message")
            }
            UpdatableMessage::Assistant(a) => a,
        }
    }

    /// Applies an `Update` to advance the `ResponseState`. This should always be additive. An
    /// update should not result in fewer search results or fewer search steps.
    pub fn apply_update(&mut self, update: Update) {
        match update {
            Update::Step(search_step) => self.add_search_step(search_step),
            Update::Result(search_results) => self.set_results(search_results),
        }
    }

    /// Update `ResponseState` to add another search step
    fn add_search_step(&mut self, step: SearchStep) {
        self.current_message_mut().search_steps.push(step);
    }

    /// Update `ResponseState` to set the current search result list.
    ///
    /// NOTE: we might want to rework this to work like `Self::add_search_step`, which is additive
    fn set_results(&mut self, mut results: Vec<SearchResult>) {
        // fish out the conclusion from the result list, if any
        //
        // the conclusion is attached as message.content
        let conclusion = results
            .iter()
            .position(SearchResult::is_conclusion)
            .and_then(|idx| {
                self.finish_message();
                results.remove(idx).conclusion()
            });

        // we always want the results to be additive, however
        // some updates may result in fewer number of search results
        //
        // this can occur when the partially parsed json is not
        // sufficient to produce a search result (as in the case of a ModifyResult)
        //
        // we only update the search results when the latest update
        // gives us more than what we already have
        if self.current_message().results.len() <= results.len() {
            self.current_message_mut().results = results;
        }

        self.current_message_mut().content = conclusion;
    }

    /// Conclude the current response from the assistant
    ///
    /// TODO: this should perform some state-management to advance `Self::current_message`.
    fn finish_message(&mut self) {
        self.current_message_mut().status = MessageStatus::Finished;
    }
}

#[derive(serde::Serialize, Debug, Clone)]
#[serde(tag = "role", rename_all = "lowercase")]
enum UpdatableMessage {
    User(UserMessage),
    Assistant(AssistantMessage),
}

#[derive(serde::Serialize, Debug, Clone)]
struct UserMessage {
    content: String,
}

#[derive(serde::Serialize, Debug, Clone, Default)]
struct AssistantMessage {
    status: MessageStatus,
    content: Option<String>,
    search_steps: Vec<SearchStep>,
    results: Vec<SearchResult>,
}

#[derive(serde::Serialize, Debug, Copy, Clone, Default)]
#[serde(rename_all = "UPPERCASE")]
enum MessageStatus {
    Finished,

    #[default]
    Loading,
}

#[derive(serde::Serialize, Debug, Clone)]
#[serde(rename_all = "UPPERCASE", tag = "type", content = "content")]
#[non_exhaustive]
pub enum SearchStep {
    Query(String),
    Path(String),
    Code(String),
    Check(String),
    File(String),
    Prompt(String),
}

#[derive(Debug)]
pub enum Update {
    Step(SearchStep),
    Result(Vec<SearchResult>),
}

#[derive(serde::Serialize, Debug, Clone)]
pub enum SearchResult {
    Cite(CiteResult),
    New(NewResult),
    Modify(ModifyResult),
    Conclude(ConcludeResult),
}

impl SearchResult {
    pub fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let tag = v.first()?;

        match tag.as_str()? {
            "cite" => CiteResult::from_json_array(&v[1..]).map(Self::Cite),
            "new" => NewResult::from_json_array(&v[1..]).map(Self::New),
            "mod" => ModifyResult::from_json_array(&v[1..]).map(Self::Modify),
            "con" => ConcludeResult::from_json_array(&v[1..]).map(Self::Conclude),
            _ => None,
        }
    }

    fn is_conclusion(&self) -> bool {
        matches!(self, Self::Conclude(..))
    }

    fn conclusion(self) -> Option<String> {
        match self {
            Self::Conclude(ConcludeResult { comment }) => comment,
            _ => None,
        }
    }

    pub fn substitute_path_alias(self, path_aliases: &[String]) -> Self {
        match self {
            Self::Cite(cite) => Self::Cite(cite.substitute_path_alias(path_aliases)),
            Self::Modify(mod_) => Self::Modify(mod_.substitute_path_alias(path_aliases)),
            s => s,
        }
    }
}

#[derive(serde::Serialize, Default, Debug, Clone)]
pub struct CiteResult {
    #[serde(skip)]
    path_alias: Option<u64>,
    path: Option<String>,
    comment: Option<String>,
    start_line: Option<u64>,
    end_line: Option<u64>,
}

#[derive(serde::Serialize, Default, Debug, Clone)]
pub struct NewResult {
    language: Option<String>,
    code: Option<String>,
}

#[derive(serde::Serialize, Default, Debug, Clone)]
pub struct ModifyResult {
    #[serde(skip)]
    path_alias: Option<u64>,
    path: Option<String>,
    language: Option<String>,
    diff: Option<ModifyResultHunk>,
}

#[derive(serde::Serialize, Default, Debug, Clone)]
struct ModifyResultHunk {
    header: Option<ModifyResultHunkHeader>,
    lines: Vec<String>,
}

#[derive(serde::Serialize, Default, Debug, Clone)]
struct ModifyResultHunkHeader {
    old_start: Option<usize>,
    old_lines: Option<usize>,
    new_start: Option<usize>,
    new_lines: Option<usize>,
}

#[derive(serde::Serialize, Default, Debug, Clone)]
pub struct ConcludeResult {
    comment: Option<String>,
}

impl CiteResult {
    fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let path_alias = v.get(0).and_then(serde_json::Value::as_u64);
        let comment = v
            .get(1)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        let start_line = v.get(2).and_then(serde_json::Value::as_u64);
        let end_line = v.get(3).and_then(serde_json::Value::as_u64);

        Some(Self {
            path_alias,
            comment,
            start_line,
            end_line,
            ..Default::default()
        })
    }

    fn substitute_path_alias(mut self, path_aliases: &[String]) -> Self {
        self.path = self
            .path_alias
            .as_ref()
            .and_then(|alias| path_aliases.get(*alias as usize))
            .map(ToOwned::to_owned);
        self
    }
}

impl NewResult {
    fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let language = v
            .get(0)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        let code = v
            .get(1)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        Some(Self { language, code })
    }
}

impl ModifyResult {
    fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let path_alias = v.get(0).and_then(serde_json::Value::as_u64);
        let language = v
            .get(1)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        let diff = v
            .get(2)
            .and_then(serde_json::Value::as_str)
            .map(|raw_hunk| {
                let header = raw_hunk.lines().next().and_then(|s| s.parse().ok());
                let lines = raw_hunk
                    .lines()
                    .skip(1)
                    .map(ToOwned::to_owned)
                    .collect::<Vec<_>>();
                ModifyResultHunk { header, lines }
            });

        Some(Self {
            path_alias,
            language,
            diff,
            ..Default::default()
        })
    }

    fn substitute_path_alias(mut self, path_aliases: &[String]) -> Self {
        self.path = self
            .path_alias
            .as_ref()
            .and_then(|alias| {
                if let Some(p) = path_aliases.get(*alias as usize) {
                    Some(p)
                } else {
                    tracing::warn!("no path found for alias `{alias}`");
                    for (idx, p) in path_aliases.iter().enumerate() {
                        tracing::warn!("we have {idx}. {p}");
                    }
                    None
                }
            })
            .map(ToOwned::to_owned);
        self
    }
}

impl std::str::FromStr for ModifyResultHunkHeader {
    type Err = ();

    // a header looks like
    //
    //     @@ -98,20 +98,12 @@
    //
    // we want:
    //
    //     old_start: 98
    //     old_lines: 20
    //     new_start: 98
    //     old_lines: 12
    //
    // this conversion method permits partially complete headers
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.trim();

        if !s.starts_with("@@") {
            return Err(());
        }

        let s = &s[2..s.len()].trim();
        let parts: Vec<&str> = s.split_whitespace().collect();

        // we need atleast one part
        if parts.is_empty() {
            return Err(());
        }

        let parse_part = |part: &str| -> (Option<usize>, Option<usize>) {
            let mut numbers = part.split(',');
            let start = numbers.next().and_then(|s| s.parse::<usize>().ok());
            let lines = numbers.next().and_then(|s| s.parse::<usize>().ok());
            (start, lines)
        };

        let (old_start, old_lines) = parts
            .first()
            .map(|s| s.trim_start_matches('-'))
            .map(parse_part)
            .unwrap_or_default();
        let (new_start, new_lines) = parts
            .get(1)
            .map(|s| s.trim_start_matches('+'))
            .map(parse_part)
            .unwrap_or_default();

        Ok(Self {
            old_start,
            old_lines,
            new_start,
            new_lines,
        })
    }
}

impl ConcludeResult {
    fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let comment = v
            .get(0)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        Some(Self { comment })
    }
}
