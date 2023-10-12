use anyhow::{Context, Result};
use comrak::nodes::NodeValue;
use lazy_regex::regex;

use crate::{repo::RepoRef, Application};

#[derive(serde::Deserialize)]
struct SourcedBlockInfo {
    lang: String,
    path: String,
    source_start_line: i32,
    source_end_line: i32,
}

pub async fn decode(
    app: Application,
    markdown: String,
    repo_ref: &RepoRef,
    branch: Option<&str>,
) -> Result<String> {
    let document = fixup_tags(markdown);

    // The `comrak` crate has a very unusual API which makes this logic difficult to follow. It
    // favours arena allocation instead of a tree-based AST, and requires `Write`rs to regenerate
    // markdown output.
    //
    // There are quirks to the parsing logic, comments have been added for clarity.

    // We have to collect this beforehand as comrak uses non-Send internal reference types.
    // There is no way to hold an await point in the loop because of this.
    let mut block_info = Vec::new();
    {
        let arena = comrak::Arena::new();

        // We don't have an easy built-in way to generate a string with `comrak`, so we encapsulate
        // that logic here.
        let comrak_to_string = |node| {
            let mut out = Vec::<u8>::new();
            comrak::format_commonmark(node, &Default::default(), &mut out).unwrap();
            String::from_utf8_lossy(&out)
                .trim()
                .replace("\n\n<!-- end list -->", "")
        };

        let root = comrak::parse_document(&arena, &document, &Default::default());
        let mut children = root.children();

        for block in &mut children {
            if let NodeValue::CodeBlock(block) = &mut block.data.borrow_mut().value {
                let fields = block
                    .info
                    .split(",")
                    .map(|pair| pair.split_once(":").context("found key without value"))
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

                block_info.push(info);
            }
        }
    }

    for info in block_info {
        app.indexes
            .file
            .by_path(repo_ref, &info.path, branch)
            .await?;
    }

    todo!()
}

pub fn fixup_tags(markdown: String) -> String {
    let regex = regex!(
        r"^````(\w+)\n(.*?)^````(path:[^\n,]*,source_start_line:[^\n,]*,source_end_line:[^\n,]*)?$"sm
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
}
