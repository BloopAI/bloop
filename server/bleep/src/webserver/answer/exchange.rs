use crate::query::parser::SemanticQuery;
use std::{borrow::Cow, mem};

use anyhow::{Context, Result};
use chrono::prelude::{DateTime, Utc};
use lazy_regex::regex;
use regex::Regex;
use serde::Deserialize;
use tracing::trace;

use crate::webserver::answer;

/// A continually updated conversation exchange.
///
/// This contains the query from the user, the intermediate steps the model takes, and the final
/// conclusion from the model alongside the answer, if any.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Default)]
pub struct Exchange {
    pub id: uuid::Uuid,
    pub query: SemanticQuery<'static>,
    pub answer: Option<String>,
    pub search_steps: Vec<SearchStep>,
    conclusion: Option<String>,
    pub paths: Vec<String>,
    pub code_chunks: Vec<answer::CodeChunk>,
    #[serde(skip_serializing_if = "Option::is_none")]
    query_timestamp: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_timestamp: Option<DateTime<Utc>>,
}

impl Exchange {
    pub fn new(id: uuid::Uuid, query: SemanticQuery<'static>) -> Self {
        Self {
            id,
            query,
            query_timestamp: Some(Utc::now()),
            ..Default::default()
        }
    }

    /// Advance this exchange.
    ///
    /// An update should not result in fewer search results or fewer search steps.
    pub fn apply_update(&mut self, update: Update) {
        match update {
            Update::StartStep(search_step) => self.search_steps.push(search_step),
            Update::ReplaceStep(search_step) => match (self.search_steps.last_mut(), search_step) {
                (Some(l @ SearchStep::Path { .. }), r @ SearchStep::Path { .. }) => *l = r,
                (Some(l @ SearchStep::Code { .. }), r @ SearchStep::Code { .. }) => *l = r,
                (Some(l @ SearchStep::Proc { .. }), r @ SearchStep::Proc { .. }) => *l = r,
                _ => panic!("Tried to replace a step that was not found"),
            },
            Update::Article(full_text) => {
                let answer = self.answer.get_or_insert_with(String::new);
                *answer = sanitize_article(&full_text);
            }
            Update::Conclude(conclusion) => {
                self.response_timestamp = Some(Utc::now());
                self.conclusion = Some(conclusion);
            }
        }
    }

    /// Get the query associated with this exchange, if it has been made.
    pub fn query(&self) -> Option<String> {
        self.query.target().map(|q| q.to_string())
    }

    /// Get the answer associated with this exchange, if it has been made.
    ///
    /// If the final answer is in `filesystem` format, this returns a conclusion. If the the final
    /// answer is an `article`, this returns the full text.
    pub fn answer(&self) -> Option<&str> {
        match self.answer {
            Some(_) => {
                if self.conclusion.is_some() {
                    self.answer.as_deref()
                } else {
                    None
                }
            }
            None => None,
        }
    }

    /// Encode this answer for display on the front-end.
    ///
    /// This converts all XML blocks to markdown code snippets. We want to only do this on-the-fly,
    /// because it is important to keep XML in the exchange list for LLM contexts. Otherwise, if
    /// the model "sees" previous answers in markdown format, it is more likely to generate
    /// markdown a second time and ignore the XML format.
    pub fn encode(mut self) -> Self {
        if let Some(article) = self.answer.as_mut() {
            *article = encode_article(article);
        }

        self
    }

    /// Like `answer`, but returns a summary for `filesystem` answers, or a trimmed `article`.
    pub fn answer_summarized(&self) -> Result<Option<String>> {
        if self.conclusion.as_ref().is_none() {
            return Ok(None);
        }

        Ok(Some(match self.answer.as_ref() {
            None => return Ok(None),
            Some(article) => {
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
        }))
    }

    /// Return a copy of this exchange, with all function call responses redacted.
    ///
    /// This is used to reduce the size of an exchange when we send it over the wire, by removing
    /// data that the front-end does not use.
    pub fn compressed(&self) -> Self {
        let mut ex = self.clone();

        ex.code_chunks.clear();
        ex.paths.clear();
        ex.search_steps = mem::take(&mut ex.search_steps)
            .into_iter()
            .map(|step| step.compressed())
            .collect();

        ex
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase", tag = "type", content = "content")]
#[non_exhaustive]
pub enum SearchStep {
    Path {
        query: String,
        response: String,
    },
    Code {
        query: String,
        response: String,
    },
    Proc {
        query: String,
        paths: Vec<String>,
        response: String,
    },
}

impl SearchStep {
    /// Create a "compressed" clone of this step, by redacting all response data.
    ///
    /// Used in `Exchange::compressed`.
    fn compressed(&self) -> Self {
        match self {
            Self::Path { query, .. } => Self::Path {
                query: query.clone(),
                response: "[hidden, compressed]".into(),
            },
            Self::Code { query, .. } => Self::Code {
                query: query.clone(),
                response: "[hidden, compressed]".into(),
            },
            Self::Proc { query, paths, .. } => Self::Proc {
                query: query.clone(),
                paths: paths.clone(),
                response: "[hidden, compressed]".into(),
            },
        }
    }

    pub fn get_response(&self) -> String {
        match self {
            Self::Path { response, .. } => response.clone(),
            Self::Code { response, .. } => response.clone(),
            Self::Proc { response, .. } => response.clone(),
        }
    }
}

#[derive(Debug)]
pub enum Update {
    StartStep(SearchStep),
    ReplaceStep(SearchStep),
    Article(String),
    Conclude(String),
}

fn encode_article(article: &str) -> String {
    xml_for_each(article, |code| xml_to_markdown(code).ok())
}

fn sanitize_article(article: &str) -> String {
    xml_for_each(article, |code| Some(fixup_xml_code(code).into_owned()))
}

fn fixup_xml_code(xml: &str) -> Cow<str> {
    if !xml.trim().starts_with('<') {
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

fn xml_to_markdown(xml: &str) -> Result<String> {
    let code_chunk =
        quick_xml::de::from_str::<CodeChunk>(xml).context("failed to deserialize code chunk")?;

    Ok(code_chunk.to_markdown())
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
        #[serde(default, rename = "StartLine", deserialize_with = "deserialize_lineno")]
        start_line: Option<u32>,
        #[serde(default, rename = "EndLine", deserialize_with = "deserialize_lineno")]
        end_line: Option<u32>,
    },
    GeneratedCode {
        #[serde(default, rename = "Code")]
        code: String,
        #[serde(default, rename = "Language")]
        language: String,
    },
}

fn deserialize_lineno<'a, D: serde::Deserializer<'a>>(de: D) -> Result<Option<u32>, D::Error> {
    let opt = Option::deserialize(de)?;
    let opt = opt.and_then(|s: String| {
        if s.is_empty() {
            Some(0)
        } else {
            s.parse().ok()
        }
    });

    Ok(opt)
}

impl CodeChunk {
    fn to_markdown(&self) -> String {
        let (ty, code, lang, path, start, end) = match self {
            CodeChunk::QuotedCode {
                code,
                language,
                path,
                start_line,
                end_line,
            } => (
                "Quoted",
                code,
                language,
                path.as_str(),
                *start_line,
                *end_line,
            ),
            CodeChunk::GeneratedCode { code, language } => {
                ("Generated", code, language, "", None, None)
            }
        };

        format!(
            "```type:{ty},lang:{lang},path:{path},lines:{}-{}\n{code}\n```",
            start.unwrap_or(0),
            end.unwrap_or(0)
        )
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
/// ```xml
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

    while let Some(captures) = regex!(r"\n\s*(<(\w+)>)").captures(rest) {
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

```type:Generated,lang:Rust,path:,lines:0-0
fn foo<T>(t: T) -> bool {
    &foo < &bar<i32>(t)
}
```

Then, we test some quoted code:

```type:Quoted,lang:Rust,path:src/main.rs,lines:10-12
fn foo<T>(t: T) -> bool {
    &foo < &bar<i32>(t)
}
```

# Foo

These should result in base64-encoded XML output, while maintaining the rest of the markdown article.
";

        assert_eq!(expected, encode_article(&input));
    }

    #[test]
    fn test_encode_partial_xml() {
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

```type:Quoted,lang:Rust,path:server/bleep/s,lines:0-0
let mut compiler = Compiler::new();
compiler.literal(schema.name, |q| q.repo.clone());
let compiled_query = compiler.compile(queries, tantivy_index);
```";

        assert_eq!(expected, encode_article(&sanitize_article(&input)));
    }

    #[test]
    fn test_encode_partial_xml_no_path() {
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

```type:Quoted,lang:Rust,path:,lines:0-0
let mut compiler = Compiler::new();
compiler.literal(schema.name, |q| q.repo.clone());
let compiled_query = compiler.compile(queries, tantivy_index);
```
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

    #[test]
    fn test_encode_partial_xml_empty_line_number() {
        let input = "## Example of Using the Query Compiler

The `Compiler` struct in [`server/bleep/src/query/compiler.rs`](server/bleep/src/query/compiler.rs) is used to compile a list of queries into a single Tantivy query that matches any of them. Here is an example of its usage:

<QuotedCode>
<Code>
let mut compiler = Compiler::new();
compiler.literal(schema.name, |q| q.repo.clone());
let compiled_query = compiler.compile(queries, tantivy_index);
</Code>
<Language>Rust</Language>
<StartLine>";

        let expected = "## Example of Using the Query Compiler

The `Compiler` struct in [`server/bleep/src/query/compiler.rs`](server/bleep/src/query/compiler.rs) is used to compile a list of queries into a single Tantivy query that matches any of them. Here is an example of its usage:

```type:Quoted,lang:Rust,path:,lines:0-0
let mut compiler = Compiler::new();
compiler.literal(schema.name, |q| q.repo.clone());
let compiled_query = compiler.compile(queries, tantivy_index);
```";

        assert_eq!(expected, encode_article(&sanitize_article(&input)));
    }
}
