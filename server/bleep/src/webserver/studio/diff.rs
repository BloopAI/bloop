use std::fmt;

use anyhow::{Context, Result};
use lazy_regex::regex;

pub fn extract(chat_response: &str) -> Result<impl Iterator<Item = DiffChunk>> {
    Ok(relaxed_parse(extract_diff(chat_response)?))
}

fn extract_diff(chat_response: &str) -> Result<&str> {
    let captures = regex!(r#"\A.*?^```diff(.*)^```.*\z"#sm)
        .captures(chat_response)
        .context("failed to parse chat response")?;
    let cap = captures
        .get(1)
        .context("diff regex didn't match anything")?;
    Ok(cap.as_str().trim())
}

/// Parse a diff, allowing for some formatting errors.
pub fn relaxed_parse(diff: &str) -> impl Iterator<Item = DiffChunk> {
    split_chunks(diff).map(|mut chunk| {
        chunk.fixup();
        chunk
    })
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiffChunk<'a> {
    pub src: &'a str,
    pub dst: &'a str,
    pub hunks: Vec<DiffHunk<'a>>,
}

impl DiffChunk<'_> {
    pub fn fixup(&mut self) {
        for hunk in &mut self.hunks {
            hunk.src_count = hunk
                .lines
                .iter()
                .map(|l| match l {
                    Line::Context(_) | Line::DelLine(_) => 1,
                    Line::AddLine(_) => 0,
                })
                .sum();

            hunk.dst_count = hunk
                .lines
                .iter()
                .map(|l| match l {
                    Line::Context(_) | Line::AddLine(_) => 1,
                    Line::DelLine(_) => 0,
                })
                .sum();
        }
    }
}

impl fmt::Display for DiffChunk<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let hunks_str = self.hunks.iter().map(|h| h.to_string()).collect::<String>();

        write!(f, "--- {}\n+++ {}\n{}", self.src, self.dst, hunks_str)
    }
}

fn split_hunks(hunks: &str) -> impl Iterator<Item = DiffHunk> {
    let hunk_regex = regex!(r#"@@ -(\d+),(\d+) \+(\d+),(\d+) @@.*\n((?:^\n|^[-+ ].*\n?)*)"#m);

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
                    if !l.is_empty() {
                        l.split_at(1)
                    } else {
                        (" ", "")
                    }
                })
                .map(|(type_, line)| match type_ {
                    " " => Line::Context(line),
                    "+" => Line::AddLine(line),
                    "-" => Line::DelLine(line),
                    _ => unreachable!("unknown character slipped through regex"),
                })
                .collect()
        },
    })
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
        writeln!(
            f,
            "@@ -{},{} +{},{} @@",
            self.src_line, self.src_count, self.dst_line, self.dst_count
        )?;

        for line in &self.lines {
            <Line as fmt::Display>::fmt(line, f)?;
        }

        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Line<'a> {
    Context(&'a str),
    AddLine(&'a str),
    DelLine(&'a str),
}

impl fmt::Display for Line<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Line::Context(line) => writeln!(f, " {line}"),
            Line::AddLine(line) => writeln!(f, "+{line}"),
            Line::DelLine(line) => writeln!(f, "-{line}"),
        }
    }
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
 baz
";
        let output = relaxed_parse(s)
            .map(|chunk| chunk.to_string())
            .collect::<String>();
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
                    Line::DelLine("foo"),
                    Line::AddLine("bar"),
                ],
            },
            DiffHunk {
                src_line: 10,
                src_count: 1,
                dst_line: 10,
                dst_count: 2,
                lines: vec![
                    Line::DelLine("bar"),
                    Line::AddLine("quux"),
                    Line::AddLine("quux2"),
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
                hunks: vec![DiffHunk {
                    src_line: 1,
                    src_count: 1,
                    dst_line: 1,
                    dst_count: 1,
                    lines: vec![
                        Line::Context("context"),
                        Line::Context("the line right below this one is intentionally empty"),
                        Line::Context(""),
                        Line::DelLine("foo"),
                        Line::AddLine("bar"),
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
                    lines: vec![
                        Line::DelLine("bar"),
                        Line::AddLine("quux"),
                        Line::AddLine("quux2"),
                    ],
                }],
            },
        ];

        let output = split_chunks(diff).collect::<Vec<_>>();

        assert_eq!(expected, output);
    }

    #[test]
    fn test_bug_split() {
        let chat_response = r#"```diff
--- server/bleep/src/analytics.rs
+++ server/bleep/src/analytics.rs
@@ -215,6 +215,22 @@ impl RudderHub {
             }));
         }
     }
+    
+    pub fn track_index_repo(&self, user: &crate::webserver::middleware::User, repo_ref: RepoRef) {
+        if let Some(options) = &self.options {
+            self.send(Message::Track(Track {
+                user_id: Some(self.tracking_id(user.username())),
+                event: "index repo".to_owned(),
+                properties: Some(json!({
+                    "device_id": self.device_id(),
+                    "repo_ref": repo_ref.to_string(),
+                    "package_metadata": options.package_metadata,
+                })),
+                ..Default::default()
+            }));
+        }
+    }
 }
 
 impl From<Option<String>> for DeviceId {

--- server/bleep/src/indexes.rs
+++ server/bleep/src/indexes.rs
@@ -61,7 +61,9 @@ impl<'a> GlobalWriteHandle<'a> {
     }
 
     pub(crate) async fn index(
-        &self,
+        &self,
+        analytics: &RudderHub,  // Pass in the RudderHub instance
+        user: &crate::webserver::middleware::User,  // Pass in the current user
         sync_handle: &SyncHandle,
         repo: &Repository,
     ) -> Result<Arc<RepoMetadata>, RepoError> {
@@ -70,6 +72,9 @@ impl<'a> GlobalWriteHandle<'a> {
 
         for h in &self.handles {
             h.index(sync_handle, repo, &metadata).await?;
+            
+            // Track the repo indexing event
+            analytics.track_index_repo(user, repo.repo_ref.clone());
         }
 
         Ok(metadata)
```"#;
        let expected = vec![
            DiffChunk {
                src: "server/bleep/src/analytics.rs",
                dst: "server/bleep/src/analytics.rs",
                hunks: vec![DiffHunk {
                    src_line: 215,
                    src_count: 7,
                    dst_line: 215,
                    dst_count: 22,
                    lines: vec![
                        Line::Context("            }));"),
                        Line::Context("        }"),
                        Line::Context("    }"),
                        Line::AddLine("    "),
                        Line::AddLine("    pub fn track_index_repo(&self, user: &crate::webserver::middleware::User, repo_ref: RepoRef) {"),
                        Line::AddLine(r#"        if let Some(options) = &self.options {"#),
                        Line::AddLine(r#"            self.send(Message::Track(Track {"#),
                        Line::AddLine(r#"                user_id: Some(self.tracking_id(user.username())),"#),
                        Line::AddLine(r#"                event: "index repo".to_owned(),"#),
                        Line::AddLine(r#"                properties: Some(json!({"#),
                        Line::AddLine(r#"                    "device_id": self.device_id(),"#),
                        Line::AddLine(r#"                    "repo_ref": repo_ref.to_string(),"#),
                        Line::AddLine(r#"                    "package_metadata": options.package_metadata,"#),
                        Line::AddLine(r#"                })),"#),
                        Line::AddLine(r#"                ..Default::default()"#),
                        Line::AddLine(r#"            }));"#),
                        Line::AddLine(r#"        }"#),
                        Line::AddLine(r#"    }"#),
                        Line::Context("}"),
                        Line::Context(""),
                        Line::Context("impl From<Option<String>> for DeviceId {"),
                        Line::Context(""),
                    ],
                }],
            },
            DiffChunk {
                src: "server/bleep/src/indexes.rs",
                dst: "server/bleep/src/indexes.rs",
                hunks: vec![
                    DiffHunk {
                        src_line: 61,
                        src_count: 7,
                        dst_line: 61,
                        dst_count: 9,
                        lines: vec![
                            Line::Context(r#"    }"#),
                            Line::Context(r#""#),
                            Line::Context(r#"    pub(crate) async fn index("#),
                            Line::DelLine(r#"        &self,"#),
                            Line::AddLine(r#"        &self,"#),
                            Line::AddLine(r#"        analytics: &RudderHub,  // Pass in the RudderHub instance"#),
                            Line::AddLine(r#"        user: &crate::webserver::middleware::User,  // Pass in the current user"#),
                            Line::Context(r#"        sync_handle: &SyncHandle,"#),
                            Line::Context(r#"        repo: &Repository,"#),
                            Line::Context(r#"    ) -> Result<Arc<RepoMetadata>, RepoError> {"#),
                        ],
                    },
                    DiffHunk {
                        src_line: 70,
                        src_count: 6,
                        dst_line: 72,
                        dst_count: 9,
                        lines: vec![
                            Line::Context(r#""#),
                            Line::Context(r#"        for h in &self.handles {"#),
                            Line::Context(r#"            h.index(sync_handle, repo, &metadata).await?;"#),
                            Line::AddLine(r#"            "#),
                            Line::AddLine(r#"            // Track the repo indexing event"#),
                            Line::AddLine(r#"            analytics.track_index_repo(user, repo.repo_ref.clone());"#),
                            Line::Context(r#"        }"#),
                            Line::Context(r#""#),
                            Line::Context(r#"        Ok(metadata)"#),
                        ],
                    },
                ],
            },
        ];

        let output = extract(chat_response).unwrap().collect::<Vec<_>>();

        assert_eq!(expected, output);
    }
}
