use crate::query::parser::SemanticQuery;
use anyhow::{Context, Result};
use tracing::trace;

/// A continually updated conversation exchange.
///
/// This contains the query from the user, the intermediate steps the model takes, and the final
/// conclusion from the model alongside the outcome, if any.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Default)]
pub struct Exchange {
    pub query: SemanticQuery<'static>,
    pub outcome: Option<Outcome>,
    search_steps: Vec<SearchStep>,
    conclusion: Option<String>,
}

impl Exchange {
    pub fn new(query: SemanticQuery<'static>) -> Self {
        Self {
            query,
            ..Default::default()
        }
    }

    /// Advance this exchange.
    ///
    /// An update should not result in fewer search results or fewer search steps.
    pub fn apply_update(&mut self, update: Update) {
        match update {
            Update::Step(search_step) => self.search_steps.push(search_step),
            Update::Filesystem(file_results) => {
                self.set_file_results(file_results);
            }
            Update::Article(text) => {
                let outcome = self
                    .outcome
                    .get_or_insert_with(|| Outcome::Article(String::new()));
                *outcome.as_article_mut().unwrap() = text;
            }
            Update::Conclude(conclusion) => {
                self.conclusion = Some(conclusion);
            }
        }
    }

    /// Get the query associated with this exchange, if it has been made.
    pub fn query(&self) -> Option<&str> {
        self.search_steps.iter().find_map(|step| match step {
            SearchStep::Query(q) => Some(q.as_str()),
            _ => None,
        })
    }

    /// Get the answer associated with this exchange, if it has been made.
    ///
    /// If the final answer is in `filesystem` format, this returns a conclusion. If the the final
    /// answer is an `article`, this returns the full text.
    pub fn answer(&self) -> Option<&str> {
        match self.outcome {
            Some(Outcome::Article(..)) => {
                if self.conclusion.is_some() {
                    self.outcome.as_ref().and_then(Outcome::as_article)
                } else {
                    None
                }
            }
            Some(Outcome::Filesystem(..)) => self.conclusion.as_deref(),
            None => None,
        }
    }

    /// Like `answer`, but returns a summary for `filesystem` answers, or a trimmed `article`.
    pub fn answer_summarized(&self) -> Result<Option<String>> {
        if self.conclusion.as_ref().is_none() {
            return Ok(None);
        }

        Ok(Some(match self.outcome.as_ref() {
            None => return Ok(None),
            Some(Outcome::Article(article)) => {
                let article = trim_code(article);
                let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo")?;
                super::limit_tokens(&article, bpe, 500).to_owned()
            }
            Some(Outcome::Filesystem(file_results)) => file_results
                .iter()
                .filter_map(|result| match result {
                    FileResult::Cite(cite) => Some(cite.summarize()),
                    _ => None,
                })
                .chain(self.conclusion.clone())
                .collect::<Vec<_>>()
                .join("\n"),
        }))
    }

    /// Set the current search result list.
    fn set_file_results(&mut self, mut new_results: Vec<FileResult>) {
        let results = self
            .outcome
            .get_or_insert_with(|| Outcome::Filesystem(Vec::new()))
            .as_filesystem_mut()
            // We know this will never happen, as the LLM selects either article or filesystem
            // mode, and cannot mix updates. This is guaranteed by the use of two different
            // prompts.
            .expect("encountered article outcome");

        // fish out the conclusion from the result list, if any
        let conclusion = new_results
            .iter()
            .position(FileResult::is_conclusion)
            .and_then(|idx| new_results.remove(idx).conclusion());

        // we always want the results to be additive, however
        // some updates may result in fewer number of search results
        //
        // this can occur when the partially parsed json is not
        // sufficient to produce a search result (as in the case of a ModifyResult)
        //
        // we only update the search results when the latest update
        // gives us more than what we already have
        if results.len() <= new_results.len() {
            *results = new_results;
        }

        self.conclusion = conclusion;
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub enum Outcome {
    Article(String),
    Filesystem(Vec<FileResult>),
}

impl Outcome {
    fn as_filesystem_mut(&mut self) -> Option<&mut Vec<FileResult>> {
        match self {
            Self::Article(_) => None,
            Self::Filesystem(outcome) => Some(outcome),
        }
    }

    fn as_article(&self) -> Option<&str> {
        match self {
            Self::Article(text) => Some(text.as_str()),
            Self::Filesystem(_) => None,
        }
    }

    fn as_article_mut(&mut self) -> Option<&mut String> {
        match self {
            Self::Article(text) => Some(text),
            Self::Filesystem(_) => None,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "UPPERCASE", tag = "type", content = "content")]
#[non_exhaustive]
pub enum SearchStep {
    Query(String),
    Path(String),
    Code(String),
    Proc(String),
    Prompt(String),
}

#[derive(Debug)]
pub enum Update {
    Step(SearchStep),
    Filesystem(Vec<FileResult>),
    Article(String),
    Conclude(String),
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub enum FileResult {
    Cite(CiteResult),
    Directory(DirectoryResult),
    Modify(ModifyResult),
    Conclude(ConcludeResult),
}

impl FileResult {
    pub fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let tag = v.first()?;

        match tag.as_str()? {
            "cite" => CiteResult::from_json_array(&v[1..]).map(Self::Cite),
            "dir" => DirectoryResult::from_json_array(&v[1..]).map(Self::Directory),
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

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
pub struct CiteResult {
    #[serde(skip)]
    path_alias: Option<u64>,
    path: Option<String>,
    comment: Option<String>,
    start_line: Option<u64>,
    end_line: Option<u64>,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
pub struct DirectoryResult {
    path: Option<String>,
    comment: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
pub struct ModifyResult {
    #[serde(skip)]
    path_alias: Option<u64>,
    path: Option<String>,
    language: Option<String>,
    diff: Option<ModifyResultHunk>,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
struct ModifyResultHunk {
    header: Option<ModifyResultHunkHeader>,
    lines: Vec<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
struct ModifyResultHunkHeader {
    old_start: Option<usize>,
    old_lines: Option<usize>,
    new_start: Option<usize>,
    new_lines: Option<usize>,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
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

    fn summarize(&self) -> String {
        fn _summarize(s: &CiteResult) -> Option<String> {
            let comment = s.comment.as_ref()?;
            let path = s.path.as_ref()?;
            Some(format!("{path}: {comment}",))
        }

        _summarize(self).unwrap_or_default()
    }
}

impl DirectoryResult {
    fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let path = v
            .get(0)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        let comment = v
            .get(1)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        Some(Self { path, comment })
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

fn trim_code(s: &str) -> String {
    #[derive(serde::Deserialize, Debug)]
    enum CodeChunk {
        QuotedCode {
            #[serde(rename = "Code")]
            _code: String,
            #[serde(rename = "Language")]
            language: String,
            #[serde(rename = "Path")]
            path: String,
            #[serde(rename = "StartLine")]
            start_line: u32,
            #[serde(rename = "EndLine")]
            end_line: u32,
        },
        GeneratedCode {
            #[serde(rename = "Code")]
            _code: String,
            #[serde(rename = "Language")]
            language: String,
        },
    }

    fn try_trim_xml(text: &str) -> Result<String> {
        dbg!(text);
        let code_chunk =
            serde_xml_rs::from_str(text).context("couldn't parse as XML code block")?;

        dbg!(&code_chunk);

        Ok(match code_chunk {
            CodeChunk::QuotedCode {
                _code,
                language,
                path,
                start_line,
                end_line,
            } => {
                format!(
                    "<QuotedCode>\n\
                    <Code>[REDACTED]</Code>\n\
                    <Language>{language}</Language>\n\
                    <Path>{path}</Path>\n\
                    <StartLine>{start_line}</StartLine>\n\
                    <EndLine>{end_line}</EndLine>\n\
                    </QuotedCode>"
                )
            }

            CodeChunk::GeneratedCode { _code, language } => {
                format!(
                    "<GeneratedCode>\n\
                    <Code>[REDACTED]</Code>\n\
                    <Language>{language}</Language>\n\
                    </GeneratedCode>"
                )
            }
        })
    }

    let arena = comrak::Arena::new();
    let options = comrak::ComrakOptions::default();
    let root = comrak::parse_document(&arena, s, &options);

    for child in root.children() {
        let mut node = child.data.borrow_mut();
        if let comrak::nodes::NodeValue::HtmlBlock(html_block) = &mut node.value {
            match try_trim_xml(&html_block.literal) {
                Ok(trimmed) => html_block.literal = trimmed,
                Err(e) => trace!("failed to trim XML: {e}"),
            }
        }
    }

    let mut out = Vec::<u8>::new();
    comrak::format_commonmark(root, &options, &mut out).unwrap();
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;

    #[test]
    fn test_trim_code() {
        let input = "Sample Markdown test.

<QuotedCode>
<Code>
fn foo() -> i32 {
    42
}
</Code>
<Language>Rust</Language>
<Path>src/main.rs</Path>
<StartLine>10</StartLine>
<EndLine>12</EndLine>
</QuotedCode>

<GeneratedCode>
<Code>
fn foo() -> i32 {
    42
}
</Code>
<Language>Rust</Language>
</GeneratedCode>

test
test
test";

        let expected = "Sample Markdown test.

<QuotedCode>
<Code>[REDACTED]</Code>
<Language>Rust</Language>
<Path>src/main.rs</Path>
<StartLine>10</StartLine>
<EndLine>12</EndLine>
</QuotedCode>

<GeneratedCode>
<Code>[REDACTED]</Code>
<Language>Rust</Language>
</GeneratedCode>

test
test
test
";

        assert_eq!(expected, trim_code(input));
    }
}
