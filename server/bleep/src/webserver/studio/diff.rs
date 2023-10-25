use anyhow::{Context, Result};

use crate::Application;

pub async fn extract(app: Application, chat_response: String) -> Result<String> {
    let diff = extract_diff(&chat_response)?;
    split_chunks(&diff).map(|chunk| {
    });

    todo!()
}

fn extract_diff(chat_response: &str) -> Result<String> {
    let captures = lazy_regex::regex!(r#"\A.*?^```diff(.*)^```.*\z"#sm)
        .captures(&chat_response)
        .context("failed to parse chat response")?;
    let cap = captures
        .get(1)
        .context("diff regex didn't match anything")?;
    Ok(cap.as_str().trim().to_owned())
}

/// Parse a diff, allowing for some formatting errors.
fn relaxed_parse(diff: &str) -> Result<String> {
    todo!()
}

#[derive(Debug, PartialEq, Eq)]
struct DiffChunk<'a> {
    src: &'a str,
    dst: &'a str,
    hunks: Vec<DiffHunk<'a>>,
}

fn split_chunks(diff: &str) -> impl Iterator<Item = DiffChunk> {
    let file_regex =
        lazy_regex::regex!(r#"(?:^--- (.*)$\n^\+\+\+ (.*)$)\n((?:^$\n?|^[-+@ ].*\n?)+)"#m);
    file_regex.captures_iter(diff).map(|caps| DiffChunk {
        src: caps.get(1).unwrap().as_str(),
        dst: caps.get(2).unwrap().as_str(),
        hunks: split_hunks(dbg!(caps.get(3).unwrap().as_str())).collect(),
    })
}

#[derive(Debug, PartialEq, Eq)]
struct DiffHunk<'a> {
    src_line: usize,
    dst_line: usize,
    src_count: usize,
    dst_count: usize,

    lines: Vec<Line<'a>>,
}

#[derive(Debug, PartialEq, Eq)]
enum Line<'a> {
    Context(&'a str),
    Add(&'a str),
    Del(&'a str),
}

fn split_hunks(hunks: &str) -> impl Iterator<Item = DiffHunk> {
    let hunk_regex =
        lazy_regex::regex!(r#"@@ -(\d+),(\d+) \+(\d+),(\d+) @@\n((?:^\n|^[-+ ].*\n?)*)"#m);

    hunk_regex.captures_iter(hunks).map(|caps| DiffHunk {
        src_line: caps.get(1).unwrap().as_str().parse().unwrap(),
        src_count: caps.get(2).unwrap().as_str().parse().unwrap(),
        dst_line: caps.get(3).unwrap().as_str().parse().unwrap(),
        dst_count: caps.get(4).unwrap().as_str().parse().unwrap(),
        lines: {
            caps.get(5)
                .unwrap()
                .as_str()
                .lines()
                .map(|l| {
                    if l.len() > 0 {
                        l.split_at(1)
                    } else {
                        (" ", "")
                    }
                })
                .map(|(type_, line)| match type_ {
                    " " => Line::Context(line),
                    "+" => Line::Add(line),
                    "-" => Line::Del(line),
                    _ => unreachable!("unknown character slipped through regex"),
                })
                .collect()
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    use pretty_assertions::assert_eq;

    #[test]
    fn test_extract_diff() {
        let s = "```diff
foo bar
```";

        assert_eq!(extract_diff(s).unwrap(), "foo bar");
    }

    #[test]
    fn test_extract_diff_complex() {
        let s = "```diff
x

    ```diff
foo bar
```
```";

        assert_eq!(extract_diff(s).unwrap(), "x\n\n    ```diff\nfoo bar\n```");
    }

    #[test]
    fn test_relaxed_parse() {
        let s = "\
--- foo.rs
+++ foo.rs
@@ -1,1 +1,1 @@
-foo
+bar";
        assert_eq!(relaxed_parse(s).unwrap(), s);
    }

    #[test]
    fn test_split_hunks() {
        let hunks = "@@ -1,1 +1,1 @@
 context
 the line right below this one is intentionally empty

-foo
+bar
@@ -10,1 +10,2 @@
-bar
+quux
+quux2";

        let expected = vec![
            DiffHunk {
                src_line: 1,
                src_count: 1,
                dst_line: 1,
                dst_count: 1,
                lines: vec![
                    Line::Context("context"),
                    Line::Context("the line right below this one is intentionally empty"),
                    Line::Context(""),
                    Line::Del("foo"),
                    Line::Add("bar"),
                ],
            },
            DiffHunk {
                src_line: 10,
                src_count: 1,
                dst_line: 10,
                dst_count: 2,
                lines: vec![
                    Line::Del("bar"),
                    Line::Add("quux"),
                    Line::Add("quux2"),
                ],
            },
        ];

        let output = split_hunks(hunks).collect::<Vec<_>>();

        assert_eq!(expected, output);
    }

    #[test]
    fn test_split_chunks() {
        let diff = "    A simple diff description.

--- foo.rs
+++ foo.rs
@@ -1,1 +1,1 @@
 context
 the line right below this one is intentionally empty

-foo
+bar
--- bar.rs
+++ bar.rs
@@ -10,1 +10,2 @@
-bar
+quux
+quux2";

        let expected = vec![
            DiffChunk {
                src: "foo.rs",
                dst: "foo.rs",
                hunks: vec![
                    DiffHunk {
                        src_line: 1,
                        src_count: 1,
                        dst_line: 1,
                        dst_count: 1,
                        lines: vec![
                            Line::Context("context"),
                            Line::Context("the line right below this one is intentionally empty"),
                            Line::Context(""),
                            Line::Del("foo"),
                            Line::Add("bar"),
                        ],
                    },
                ],
            },
            DiffChunk {
                src: "bar.rs",
                dst: "bar.rs",
                hunks: vec![
                    DiffHunk {
                        src_line: 10,
                        src_count: 1,
                        dst_line: 10,
                        dst_count: 2,
                        lines: vec![
                            Line::Del("bar"),
                            Line::Add("quux"),
                            Line::Add("quux2"),
                        ],
                    },
                ],
            },
        ];

        let output = split_chunks(diff).collect::<Vec<_>>();

        assert_eq!(expected, output);
    }
}
