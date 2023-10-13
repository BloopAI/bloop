use anyhow::{Context, Result};
use comrak::nodes::NodeValue;
use lazy_regex::regex;
use tracing::debug;

use crate::Application;

use super::ContextFile;

#[derive(serde::Deserialize)]
struct SourcedBlockInfo {
    lang: String,
    path: String,
    source_start_line: i32,
    source_end_line: i32,
}

pub(super) async fn decode(
    app: Application,
    markdown: String,
    context: Vec<ContextFile>,
) -> String {
    match decode_inner(app, markdown.clone(), context).await {
        Ok(decoded) => decoded,
        Err(e) => {
            debug!("decoding failed: {e}");
            markdown
        }
    }
}

pub(super) async fn decode_inner(
    app: Application,
    markdown: String,
    context: Vec<ContextFile>,
) -> Result<String> {
    let document = dbg!(fixup_tags(dbg!(markdown)));

    // The `comrak` crate has a very unusual API which makes this logic difficult to follow. It
    // favours arena allocation instead of a tree-based AST, and requires `Write`rs to regenerate
    // markdown output.
    //
    // There are quirks to the parsing logic, comments have been added for clarity.

    // We don't have an easy built-in way to generate a string with `comrak`, so we encapsulate
    // that logic here.
    let comrak_to_string = |node| {
        let mut out = Vec::<u8>::new();
        comrak::format_commonmark(node, &Default::default(), &mut out).unwrap();
        String::from_utf8_lossy(&out)
            .trim()
            .replace("\n\n<!-- end list -->", "")
    };

    // We have to collect this beforehand as comrak uses non-Send internal reference types.
    // There is no way to hold an await point in the loop because of this.
    let mut code_blocks = Vec::new();
    {
        let arena = comrak::Arena::new();
        let root = comrak::parse_document(&arena, &document, &Default::default());
        let mut children = root.children();

        for block in &mut children {
            if let NodeValue::CodeBlock(block) = &mut block.data.borrow_mut().value {
                let fields = dbg!(&block.info)
                    .split(',')
                    .map(|pair| {
                        dbg!(pair)
                            .split_once(':')
                            .context("found key without value")
                    })
                    .collect::<Result<Vec<_>>>()?
                    .into_iter()
                    .map(|(k, v)| {
                        let key = k.to_owned();
                        let value = if let Ok(i) = v.parse::<i32>() {
                            serde_json::Value::Number(i.into())
                        } else {
                            v.into()
                        };

                        (key, value)
                    })
                    .collect::<serde_json::Value>();

                let info: SourcedBlockInfo =
                    serde_json::from_value(fields).context("invalid param format")?;

                code_blocks.push((info, block.literal.clone()));
            }
        }
    }

    let mut diffs = Vec::new();
    for (info, body) in code_blocks {
        let context_file = context
            .iter()
            .find(|file| file.path == info.path)
            .context("unknown file in source block")?;

        let file_body = app
            .indexes
            .file
            .by_path(
                &context_file.repo,
                &info.path,
                context_file.branch.as_deref(),
            )
            .await?
            .context("file not found")?;

        let mut buf = String::new();

        buf += &file_body
            .content
            .lines()
            .take(info.source_start_line as usize - 1)
            .collect::<Vec<_>>()
            .join("\n");
        buf.push('\n');
        buf += body.trim();
        buf.push('\n');
        buf += &file_body
            .content
            .lines()
            .skip(info.source_end_line as usize)
            .collect::<Vec<_>>()
            .join("\n");

        let diff = unified_diff::diff(
            file_body.content.trim().as_bytes(),
            &file_body.relative_path,
            buf.trim().as_bytes(),
            &file_body.relative_path,
            3,
        );
        diffs.push((info.lang, String::from_utf8_lossy(&diff).into_owned()));
    }

    let arena = comrak::Arena::new();
    let root = comrak::parse_document(&arena, &document, &Default::default());
    let mut children = root.children();

    for block in &mut children {
        if let NodeValue::CodeBlock(block) = &mut block.data.borrow_mut().value {
            let (_info, diff) = diffs.remove(0);
            block.info = "diff".to_owned();
            block.literal = diff;
        }
    }

    Ok(comrak_to_string(root))
}

pub fn fixup_tags(markdown: String) -> String {
    let regex = regex!(
        r"^````*(\w+)\n(.*?)^````*(?:\n)?(path:[^\n,]*,source_start_line:[^\n,]*,source_end_line:[^\n,]*)?$"sm
    );

    regex
        .replace_all(&markdown, |caps: &regex::Captures| {
            let lang = caps.get(1).unwrap().as_str();
            let body = caps.get(2).unwrap().as_str();

            let params = match caps.get(3).map(|m| m.as_str()) {
                Some(p) => format!(",{p}"),
                None => "".to_owned(),
            };

            format!("````lang:{lang}{params}\n{body}````")
        })
        .into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn test_simple() {
        let input = "````rust
fn foo() -> i32 {
    123
}
````

````lang:rust,path:src/main.rs,source_start_line:1,source_end_line:3
fn bar() -> i32 {
    456
}
````";

        let expected = "````lang:rust
fn foo() -> i32 {
    123
}
````

````lang:rust,path:src/main.rs,source_start_line:1,source_end_line:3
fn bar() -> i32 {
    456
}
````";

        assert_eq!(expected, fixup_tags(input.to_owned()));
    }

    #[test]
    fn test_post_paragraph() {
        let input = "````rust
fn foo() -> i32 {
    123
}
````path:src/main.rs,source_start_line:1,source_end_line:3

A sentence after a block.";

        let expected = "````lang:rust,path:src/main.rs,source_start_line:1,source_end_line:3
fn foo() -> i32 {
    123
}
````

A sentence after a block.";

        assert_eq!(expected, fixup_tags(input.to_owned()));
    }

    #[test]
    fn test_with_embedded_markdown() {
        let input = "Generated code, with markdown doc comments:

````rust
/**
```
assert_eq!(foo(), 123);
```
*/
fn foo() -> i32 {
    123
}
````

A sourced block:

````rust
/**
```
assert_eq!(bar(), 456);
```
*/
fn bar() -> i32 {
    456
}
````path:src/main.rs,source_start_line:1,source_end_line:8

Another paragraph.";

        let expected = "Generated code, with markdown doc comments:

````lang:rust
/**
```
assert_eq!(foo(), 123);
```
*/
fn foo() -> i32 {
    123
}
````

A sourced block:

````lang:rust,path:src/main.rs,source_start_line:1,source_end_line:8
/**
```
assert_eq!(bar(), 456);
```
*/
fn bar() -> i32 {
    456
}
````

Another paragraph.";

        assert_eq!(expected, fixup_tags(input.to_owned()));
    }

    #[test]
    fn test_triple_backtick() {
        let input = "Here is the modified `Query` struct with `branch` renamed to `tag`:

```rust
#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct Query<'a> {
    pub open: Option<bool>,
    pub case_sensitive: Option<bool>,
    pub global_regex: Option<bool>,

    pub org: Option<Literal<'a>>,
    pub repo: Option<Literal<'a>>,
    pub path: Option<Literal<'a>>,
    pub lang: Option<Cow<'a, str>>,
    pub tag: Option<Literal<'a>>,  // renamed from branch
    pub target: Option<Target<'a>>,
}
```path:server/bleep/src/query/parser.rs,source_start_line:7,source_end_line:18
Please note that this change will require updates in other parts of the code where `branch` is used.";

        let expected = "Here is the modified `Query` struct with `branch` renamed to `tag`:

````lang:rust,path:server/bleep/src/query/parser.rs,source_start_line:7,source_end_line:18
#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct Query<'a> {
    pub open: Option<bool>,
    pub case_sensitive: Option<bool>,
    pub global_regex: Option<bool>,

    pub org: Option<Literal<'a>>,
    pub repo: Option<Literal<'a>>,
    pub path: Option<Literal<'a>>,
    pub lang: Option<Cow<'a, str>>,
    pub tag: Option<Literal<'a>>,  // renamed from branch
    pub target: Option<Target<'a>>,
}
````
Please note that this change will require updates in other parts of the code where `branch` is used.";

        assert_eq!(expected, fixup_tags(input.to_owned()));
    }
}
