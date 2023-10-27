use std::fmt;

use anyhow::{Context, Result};
use lazy_regex::regex;

pub fn extract(chat_response: &str) -> Result<impl Iterator<Item = DiffChunk>> {
    Ok(relaxed_parse(extract_diff(&chat_response)?))
}

fn extract_diff(chat_response: &str) -> Result<&str> {
    let captures = regex!(r#"\A.*?^```diff(.*)^```.*\z"#sm)
        .captures(&chat_response)
        .context("failed to parse chat response")?;
    let cap = captures
        .get(1)
        .context("diff regex didn't match anything")?;
    Ok(cap.as_str().trim())
}

/// Parse a diff, allowing for some formatting errors.
fn relaxed_parse(diff: &str) -> impl Iterator<Item = DiffChunk> {
    split_chunks(diff).map(|mut chunk| {
        for hunk in &mut chunk.hunks {
            hunk.src_count = hunk
                .lines
                .iter()
                .map(|l| match l {
                    Line::Context(_) | Line::Del(_) => 1,
                    Line::Add(_) => 0,
                })
                .sum();

            hunk.dst_count = hunk
                .lines
                .iter()
                .map(|l| match l {
                    Line::Context(_) | Line::Add(_) => 1,
                    Line::Del(_) => 0,
                })
                .sum();
        }

        chunk
    })
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiffChunk<'a> {
    pub src: &'a str,
    pub dst: &'a str,
    pub hunks: Vec<DiffHunk<'a>>,
}

fn split_chunks(diff: &str) -> impl Iterator<Item = DiffChunk> {
    let chunk_regex = regex!(r#"(?: (.*)$\n^\+\+\+ (.*)$)\n((?:^$\n?|^[-+@ ].*\n?)+)"#m);

    regex!("^---"m).split(diff).filter_map(|chunk| {
        let caps = chunk_regex.captures(chunk)?;
        Some(DiffChunk {
            src: caps.get(1).unwrap().as_str(),
            dst: caps.get(2).unwrap().as_str(),
            hunks: split_hunks(caps.get(3).unwrap().as_str()).collect(),
        })
    })
}

impl fmt::Display for DiffChunk<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let hunks_str = self
            .hunks
            .iter()
            .map(|h| h.to_string())
            .collect::<Vec<_>>()
            .join("\n");

        write!(f, "--- {}\n+++ {}\n{}", self.src, self.dst, hunks_str)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiffHunk<'a> {
    pub src_line: usize,
    pub dst_line: usize,
    pub src_count: usize,
    pub dst_count: usize,

    pub lines: Vec<Line<'a>>,
}

impl fmt::Display for DiffHunk<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "@@ -{},{} +{},{} @@",
            self.src_line, self.src_count, self.dst_line, self.dst_count
        )?;

        for line in &self.lines {
            writeln!(f)?;
            match line {
                Line::Context(line) => write!(f, " {line}")?,
                Line::Add(line) => write!(f, "+{line}")?,
                Line::Del(line) => write!(f, "-{line}")?,
            }
        }

        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Line<'a> {
    Context(&'a str),
    Add(&'a str),
    Del(&'a str),
}

fn split_hunks(hunks: &str) -> impl Iterator<Item = DiffHunk> {
    let hunk_regex = regex!(r#"@@ -(\d+),(\d+) \+(\d+),(\d+) @@\n((?:^\n|^[-+ ].*\n?)*)"#m);

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
+bar
@@ -10,1 +10,1 @@
 quux
 quux2
+quux3
 quux4
--- bar.rs
+++ bar.rs
@@ -1,1 +1,1 @@
-bar
+fred
@@ -100,1 +100,1 @@
 baz
-bar
+thud
 baz
+thud
 baz";

        let expected = "\
--- foo.rs
+++ foo.rs
@@ -1,1 +1,1 @@
-foo
+bar
@@ -10,3 +10,4 @@
 quux
 quux2
+quux3
 quux4
--- bar.rs
+++ bar.rs
@@ -1,1 +1,1 @@
-bar
+fred
@@ -100,4 +100,5 @@
 baz
-bar
+thud
 baz
+thud
 baz";
        let output = relaxed_parse(s)
            .map(|chunk| chunk.to_string())
            .collect::<Vec<_>>()
            .join("\n");
        assert_eq!(expected, output);
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
                lines: vec![Line::Del("bar"), Line::Add("quux"), Line::Add("quux2")],
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
                hunks: vec![DiffHunk {
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
                }],
            },
            DiffChunk {
                src: "bar.rs",
                dst: "bar.rs",
                hunks: vec![DiffHunk {
                    src_line: 10,
                    src_count: 1,
                    dst_line: 10,
                    dst_count: 2,
                    lines: vec![Line::Del("bar"), Line::Add("quux"), Line::Add("quux2")],
                }],
            },
        ];

        let output = split_chunks(diff).collect::<Vec<_>>();

        assert_eq!(expected, output);
    }
}
