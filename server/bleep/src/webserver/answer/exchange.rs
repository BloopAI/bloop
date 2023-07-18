use crate::query::parser::SemanticQuery;
use std::borrow::Cow;

use anyhow::{Context, Result};
use base64::Engine;
use lazy_regex::regex;
use regex::Regex;
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
            Update::Article(full_text) => {
                let outcome = self
                    .outcome
                    .get_or_insert_with(|| Outcome::Article(String::new()));
                *outcome.as_article_mut().unwrap() = encode_article(&sanitize_article(&full_text));
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
                let article = xml_for_each(article, |code| match try_trim_code_xml(code) {
                    Ok(trimmed) => Some(trimmed),
                    Err(e) => {
                        trace!("failed to trim XML: {e}");
                        None
                    }
                });
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

fn encode_article(article: &str) -> String {
    xml_for_each(article, |code| encode_xml_code(code).ok())
}

fn sanitize_article(article: &str) -> String {
    xml_for_each(article, |code| Some(fixup_xml_code(code).into_owned()))
}

fn fixup_xml_code(xml: &str) -> Cow<str> {
    if !xml.trim().starts_with("<") {
        return Cow::Borrowed(xml);
    }

    if let Some(match_) = regex!("<(Generated|Quoted)Code>\\s*<Code>(.*)"sm)
        .captures(xml)
        .and_then(|cap| cap.get(2))
    {
        let mut buf = String::new();

        buf += &xml[..match_.start()];

        // First, we clean up incorrectly escaped symbols in the code block.
        {
            let s = &xml[match_.range()];

            let code_len = regex!("</Code>")
                .find(s)
                .map(|m| m.start())
                .unwrap_or(s.len());
            let (s, tail) = s.split_at(code_len);

            // The `regex` crate does not support negative lookahead, so we cannot write a regex
            // like `&(?!amp;)`. So, we just perform naive substitutions to first obtain an
            // unescaped copy of the string, and then re-escape it in order to fix up the result.
            //
            // This matters if the input string is something like `&amp;foo < &bar&lt;i32&gt;()`:
            //
            // - First, we convert that to `&foo < &bar<i32>()`
            // - Second, we convert it to `&amp;foo < &amp;bar&lt;i32&gt;`, our desired result.

            let s = regex!("&lt;"m).replace_all(s, "<");
            let s = regex!("&gt;"m).replace_all(&s, ">");
            let s = regex!("&amp;"m).replace_all(&s, "&");

            let s = regex!("&"m).replace_all(&s, "&amp;");
            let s = regex!("<"m).replace_all(&s, "&lt;");
            let s = regex!(">"m).replace_all(&s, "&gt;");

            buf += &s;
            buf += tail;
        }

        {
            // Next, we clean up the tags.
            //
            // Because the LLM is generating XML output token-by-token, we may end up in a
            // situation where closing tags are missing, or tags are half written. To fix this,
            // first we remove all half-complete opening or closing tags (e.g. `<foo` or `</`).
            // Then, we add missing closing tags, *in the order we expect them to appear in the
            // final XML output.* This is not perfect, but it should work well enough to allow us
            // to parse the XML.

            buf = regex!("<[^>]*$").replace_all(&buf, "").into_owned();

            for tag in [
                "Code",
                "Language",
                "Path",
                "StartLine",
                "EndLine",
                "QuotedCode",
                "GeneratedCode",
            ] {
                let opening_tag = format!("<{tag}>");
                let closing_tag = format!("</{tag}>");

                if buf.contains(&opening_tag) && !buf.contains(&closing_tag) {
                    buf += &closing_tag;
                }
            }
        }

        Cow::Owned(buf)
    } else {
        Cow::Borrowed(xml)
    }
}

fn encode_xml_code(xml: &str) -> Result<String> {
    let code_chunk =
        quick_xml::de::from_str::<CodeChunk>(&xml).context("failed to deserialize code chunk")?;
    let encoded_chunk: EncodedCodeChunk = code_chunk.into();

    Ok(quick_xml::se::to_string(&encoded_chunk)
        .unwrap()
        // Trim the extra element and XML info that `serde-xml-rs` serializes.
        //
        // `serde-xml-rs` will serialize an enum with the following format:
        //
        // ```
        // <?xml version="1.0" encoding="UTF-8"?>
        // <EnumName>
        //     <Variant>
        //          ...
        //     </Variant>
        // </EnumName>
        // ```
        //
        // We only really care about the serialized variant here, so we discard the extra head and
        // tail.
        .replace(
            r#"<?xml version="1.0" encoding="UTF-8"?><EncodedCodeChunk>"#,
            "",
        )
        .replace(r#"</EncodedCodeChunk>"#, ""))
}

/// An XML code chunk that is generated by the LLM.
#[derive(serde::Deserialize, Debug)]
enum CodeChunk {
    QuotedCode {
        #[serde(default, rename = "Code")]
        code: String,
        #[serde(default, rename = "Language")]
        language: String,
        #[serde(default, rename = "Path")]
        path: String,
        #[serde(rename = "StartLine")]
        start_line: Option<u32>,
        #[serde(rename = "EndLine")]
        end_line: Option<u32>,
    },
    GeneratedCode {
        #[serde(default, rename = "Code")]
        code: String,
        #[serde(default, rename = "Language")]
        language: String,
    },
}

/// This is like `CodeChunk`, but it encodes all code blocks as base64, to avoid parsing issues on
/// the front-end.
///
/// The front-end parser is not based upon cmark-gfm, so it doesn't handle whitespace properly
/// like `comrak` does. Base64 encoded code can be decoded separately, and does not include
/// whitespace that breaks simpler markdown parsers.
#[derive(serde::Serialize, Debug)]
enum EncodedCodeChunk {
    QuotedCode {
        #[serde(rename = "Base64Code")]
        base64_code: String,
        #[serde(rename = "Language")]
        language: String,
        #[serde(rename = "Path")]
        path: String,
        #[serde(rename = "StartLine")]
        #[serde(skip_serializing_if = "Option::is_none")]
        start_line: Option<u32>,
        #[serde(rename = "EndLine")]
        #[serde(skip_serializing_if = "Option::is_none")]
        end_line: Option<u32>,
    },
    GeneratedCode {
        #[serde(rename = "Base64Code")]
        base64_code: String,
        #[serde(rename = "Language")]
        language: String,
    },
}

impl From<CodeChunk> for EncodedCodeChunk {
    fn from(chunk: CodeChunk) -> Self {
        let base64_engine =
            base64::engine::GeneralPurpose::new(&base64::alphabet::STANDARD, Default::default());

        match chunk {
            CodeChunk::QuotedCode {
                code,
                language,
                path,
                start_line,
                end_line,
            } => {
                let base64_code = base64_engine.encode(&code);
                EncodedCodeChunk::QuotedCode {
                    base64_code,
                    language,
                    path,
                    start_line,
                    end_line,
                }
            }

            CodeChunk::GeneratedCode { code, language } => {
                let base64_code = base64_engine.encode(&code);
                EncodedCodeChunk::GeneratedCode {
                    base64_code,
                    language,
                }
            }
        }
    }
}

fn try_trim_code_xml(xml: &str) -> Result<String> {
    let xml = fixup_xml_code(xml);

    let code_chunk = quick_xml::de::from_str(&xml).context("couldn't parse as XML code block")?;

    Ok(match code_chunk {
        CodeChunk::QuotedCode {
            code: _,
            language,
            path,
            start_line,
            end_line,
        } => {
            let start_line = start_line
                .map(|n| format!("<StartLine>{n}</StartLine>\n"))
                .unwrap_or_default();
            let end_line = end_line
                .map(|n| format!("<EndLine>{n}</EndLine>\n"))
                .unwrap_or_default();

            format!(
                "<QuotedCode>\n\
                <Code>[REDACTED]</Code>\n\
                <Language>{language}</Language>\n\
                <Path>{path}</Path>\n\
                {start_line}\
                {end_line}\
                </QuotedCode>"
            )
        }

        CodeChunk::GeneratedCode { code: _, language } => {
            format!(
                "<GeneratedCode>\n\
                <Code>[REDACTED]</Code>\n\
                <Language>{language}</Language>\n\
                </GeneratedCode>"
            )
        }
    })
}

/// Modify every XML section of a markdown document.
///
/// The provided closure returns an option, which returns `Some(..)` with a replacement for the
/// input string, or `None` if the input string does not need to be replaced.
///
/// This function operates heuristically, in order to allow malformed XML and XML that contains
/// multiple serial newlines. This means we accept invalid markdown, and are more forgiving with
/// the input, at the expense of creating parsing edge cases that can cause trouble due to input
/// ambiguity.
///
/// One such case is this:
///
/// ```
/// This is a sample markdown document. **Hello** world.
///
/// <Code>
///     println!("code ends with </Code>");
/// </Code>
/// ```
///
/// The above markdown document contains an XML block enclosed in `<Code>...</Code>`, but it is
/// not valid as the code snippet contains unescape characters. Of note, the `println!` call
/// contains literal `<` and `>` characters, which in valid XML *must* be escaped as `&lt;` and
/// `&gt;`, respectively. Because of this, the xml block will be incorrectly parsed to terminate
/// halfway through the string literal provided in the code sample.
///
/// In general, there is no great way around this. We tolerate *most* ambiguity, but this edge case
/// remains as a consequence of ambiguous input.
///
/// For further context, we must accept ambiguous unescaped (invalid) input, as the LLM may
/// generate such documents.
fn xml_for_each(article: &str, f: impl Fn(&str) -> Option<String>) -> String {
    let mut out = String::new();
    let mut rest = article;

    while let Some(captures) = regex!(r"\n\n\s*(<(\w+)>)").captures(rest) {
        let tag = captures.get(1).unwrap();
        let name = &rest[captures.get(2).unwrap().range()];

        out += &rest[..tag.start()];

        let xml = if let Some(m) = Regex::new(&format!(r"</{name}>")).unwrap().find(rest) {
            let xml = &rest[tag.start()..m.end()];
            rest = &rest[m.end()..];
            xml
        } else {
            let xml = &rest[tag.start()..];
            rest = "";
            xml
        };

        if let Some(update) = f(xml) {
            out += &update;
        } else {
            out += xml;
        }
    }

    out += rest;
    out
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
test";

        let out = xml_for_each(input, |code| try_trim_code_xml(code).ok());

        assert_eq!(expected, out);
    }

    #[test]
    fn test_fixup_quoted_code() {
        let input = "<QuotedCode>
<Code>
fn foo<T>(t: T) -> bool {
    &amp;foo < &bar&lt;i32&gt;(t)
}
</Code>
<Language>Rust</Language>
<Path>src/main.rs</Path>
<StartLine>10</StartLine>
<EndLine>12</EndLine>
</QuotedCode>";

        let expected = "<QuotedCode>
<Code>
fn foo&lt;T&gt;(t: T) -&gt; bool {
    &amp;foo &lt; &amp;bar&lt;i32&gt;(t)
}
</Code>
<Language>Rust</Language>
<Path>src/main.rs</Path>
<StartLine>10</StartLine>
<EndLine>12</EndLine>
</QuotedCode>";

        assert_eq!(expected, &fixup_xml_code(input));
    }

    #[test]
    fn test_fixup_generated_code() {
        let input = "<GeneratedCode>
<Code>
fn foo<T>(t: T) -> bool {
    &amp;foo < &bar&lt;i32&gt;(t)
}
</Code>
<Language>Rust</Language>
</GeneratedCode>";

        let expected = "<GeneratedCode>
<Code>
fn foo&lt;T&gt;(t: T) -&gt; bool {
    &amp;foo &lt; &amp;bar&lt;i32&gt;(t)
}
</Code>
<Language>Rust</Language>
</GeneratedCode>";

        assert_eq!(expected, &fixup_xml_code(input));
    }

    #[test]
    fn test_sanitize_article() {
        let input = "First, we test some *generated code* below:

<GeneratedCode>
<Code>
fn foo<T>(t: T) -> bool {
    &amp;foo < &bar&lt;i32&gt;(t)
}
</Code>
<Language>Rust</Language>
</GeneratedCode>

Then, we test some quoted code:

<QuotedCode>
<Code>
fn foo<T>(t: T) -> bool {
    &amp;foo < &bar&lt;i32&gt;(t)
}
</Code>
<Language>Rust</Language>
<Path>src/main.rs</Path>
<StartLine>10</StartLine>
<EndLine>12</EndLine>
</QuotedCode>

# Foo

These should result in sanitized XML output, while maintaining the rest of the markdown article.
";

        let expected = "First, we test some *generated code* below:

<GeneratedCode>
<Code>
fn foo&lt;T&gt;(t: T) -&gt; bool {
    &amp;foo &lt; &amp;bar&lt;i32&gt;(t)
}
</Code>
<Language>Rust</Language>
</GeneratedCode>

Then, we test some quoted code:

<QuotedCode>
<Code>
fn foo&lt;T&gt;(t: T) -&gt; bool {
    &amp;foo &lt; &amp;bar&lt;i32&gt;(t)
}
</Code>
<Language>Rust</Language>
<Path>src/main.rs</Path>
<StartLine>10</StartLine>
<EndLine>12</EndLine>
</QuotedCode>

# Foo

These should result in sanitized XML output, while maintaining the rest of the markdown article.
";

        assert_eq!(expected, sanitize_article(&input));
    }

    #[test]
    fn test_sanitize_article_partial_generation() {
        let input = "First, we test some **partially** *generated code* below:

<GeneratedCode>
<Code>
fn foo<T>(t: T) -> bool {
    &amp;foo <
";

        let expected = "First, we test some **partially** *generated code* below:

<GeneratedCode>
<Code>
fn foo&lt;T&gt;(t: T) -&gt; bool {
    &amp;foo &lt;
</Code></GeneratedCode>";

        assert_eq!(expected, sanitize_article(&input));
    }

    #[test]
    fn test_encode_article() {
        let input = "First, we test some *generated code* below:

<GeneratedCode>
<Code>
fn foo&lt;T&gt;(t: T) -&gt; bool {
    &amp;foo &lt; &amp;bar&lt;i32&gt;(t)
}
</Code>
<Language>Rust</Language>
</GeneratedCode>

Then, we test some quoted code:

<QuotedCode>
<Code>
fn foo&lt;T&gt;(t: T) -&gt; bool {
    &amp;foo &lt; &amp;bar&lt;i32&gt;(t)
}
</Code>
<Language>Rust</Language>
<Path>src/main.rs</Path>
<StartLine>10</StartLine>
<EndLine>12</EndLine>
</QuotedCode>

# Foo

These should result in base64-encoded XML output, while maintaining the rest of the markdown article.
";

        let expected = "First, we test some *generated code* below:

<GeneratedCode><Base64Code>Zm4gZm9vPFQ+KHQ6IFQpIC0+IGJvb2wgewogICAgJmZvbyA8ICZiYXI8aTMyPih0KQp9</Base64Code><Language>Rust</Language></GeneratedCode>

Then, we test some quoted code:

<QuotedCode><Base64Code>Zm4gZm9vPFQ+KHQ6IFQpIC0+IGJvb2wgewogICAgJmZvbyA8ICZiYXI8aTMyPih0KQp9</Base64Code><Language>Rust</Language><Path>src/main.rs</Path><StartLine>10</StartLine><EndLine>12</EndLine></QuotedCode>

# Foo

These should result in base64-encoded XML output, while maintaining the rest of the markdown article.
";

        assert_eq!(expected, encode_article(&input));
    }

    #[test]
    fn test_partial_xml() {
        let input = "The `Compiler` struct in [`server/bleep/src/query/compiler.rs`](server/bleep/src/query/compiler.rs) is used to compile a list of queries into a single Tantivy query that matches any of them. Here is an example of its usage:

<QuotedCode>
<Code>
let mut compiler = Compiler::new();
compiler.literal(schema.name, |q| q.repo.clone());
let compiled_query = compiler.compile(queries, tantivy_index);
</Code>
<Language>Rust</Language>
<Path>server/bleep/s
";

        let expected = "The `Compiler` struct in [`server/bleep/src/query/compiler.rs`](server/bleep/src/query/compiler.rs) is used to compile a list of queries into a single Tantivy query that matches any of them. Here is an example of its usage:

<QuotedCode><Base64Code>bGV0IG11dCBjb21waWxlciA9IENvbXBpbGVyOjpuZXcoKTsKY29tcGlsZXIubGl0ZXJhbChzY2hlbWEubmFtZSwgfHF8IHEucmVwby5jbG9uZSgpKTsKbGV0IGNvbXBpbGVkX3F1ZXJ5ID0gY29tcGlsZXIuY29tcGlsZShxdWVyaWVzLCB0YW50aXZ5X2luZGV4KTs=</Base64Code><Language>Rust</Language><Path>server/bleep/s</Path></QuotedCode>";

        assert_eq!(expected, encode_article(&sanitize_article(&input)));
    }

    #[test]
    fn test_partial_xml_no_path() {
        let input = "## Example of Using the Query Compiler

The `Compiler` struct in [`server/bleep/src/query/compiler.rs`](server/bleep/src/query/compiler.rs) is used to compile a list of queries into a single Tantivy query that matches any of them. Here is an example of its usage:

<QuotedCode>
<Code>
  let mut compiler = Compiler::new();
  compiler.literal(schema.name, |q| q.repo.clone());
  let compiled_query = compiler.compile(queries, tantivy_index);
</Code>
<Language>Rust</Language>
</QuotedCode>
";

        let expected = "## Example of Using the Query Compiler

The `Compiler` struct in [`server/bleep/src/query/compiler.rs`](server/bleep/src/query/compiler.rs) is used to compile a list of queries into a single Tantivy query that matches any of them. Here is an example of its usage:

<QuotedCode><Base64Code>bGV0IG11dCBjb21waWxlciA9IENvbXBpbGVyOjpuZXcoKTsKICBjb21waWxlci5saXRlcmFsKHNjaGVtYS5uYW1lLCB8cXwgcS5yZXBvLmNsb25lKCkpOwogIGxldCBjb21waWxlZF9xdWVyeSA9IGNvbXBpbGVyLmNvbXBpbGUocXVlcmllcywgdGFudGl2eV9pbmRleCk7</Base64Code><Language>Rust</Language><Path/></QuotedCode>
";

        assert_eq!(expected, encode_article(&sanitize_article(&input)));
    }

    #[test]
    fn test_sanitize_multi_blocks() {
        let input = "## Example of Using the Query Compiler

The `Compiler` struct in [`server/bleep/src/query/compiler.rs`](server/bleep/src/query/compiler.rs) is used to compile a list of queries into a single Tantivy query that matches any of them. Here is an example of its usage:

<QuotedCode>
<Code>
let mut compiler = Compiler::new();

compiler.literal(schema.name, |q| q.repo.clone());
let compiled_query =
";

        let expected = "## Example of Using the Query Compiler

The `Compiler` struct in [`server/bleep/src/query/compiler.rs`](server/bleep/src/query/compiler.rs) is used to compile a list of queries into a single Tantivy query that matches any of them. Here is an example of its usage:

<QuotedCode>
<Code>
let mut compiler = Compiler::new();

compiler.literal(schema.name, |q| q.repo.clone());
let compiled_query =
</Code></QuotedCode>";

        assert_eq!(expected, sanitize_article(&input));
    }
}
