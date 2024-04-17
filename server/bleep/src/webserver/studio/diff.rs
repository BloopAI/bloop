use std::fmt;

use anyhow::{bail, Result};
use lazy_regex::regex;

pub fn extract(chat_response: &str) -> Result<impl Iterator<Item = DiffChunk>> {
    Ok(relaxed_parse(&extract_diff(chat_response)?)
        // We eagerly collect the iterator, and re-create it, as our input string is created in and
        // can't escape this function. This also allows us to catch parse errors earlier.
        .collect::<Vec<_>>()
        .into_iter())
}

fn extract_diff(chat_response: &str) -> Result<String> {
    let fragments = regex!(r#"^```diff.*?^(.*?)^```.*?($|\z)"#sm)
        .captures_iter(chat_response)
        .map(|c| c.get(1).unwrap().as_str())
        .collect::<String>();

    if fragments.is_empty() {
        bail!("chat response didn't contain any diff blocks");
    } else {
        Ok(fragments)
    }
}

/// Parse a diff, allowing for some formatting errors.
pub fn relaxed_parse(diff: &str) -> impl Iterator<Item = DiffChunk> + '_ {
    split_chunks(diff).map(|mut chunk| {
        chunk.fixup_hunks();
        chunk
    })
}

fn split_chunks(diff: &str) -> impl Iterator<Item = DiffChunk> + '_ {
    let chunk_regex = regex!(r#"(?: (.*)$\n^\+\+\+ (.*)$)\n((?:^$\n?|^[-+@ ].*\n?)+)"#m);

    regex!("^---"m).split(diff).filter_map(|chunk| {
        let caps = chunk_regex.captures(chunk)?;
        Some(DiffChunk {
            src: match caps.get(1).unwrap().as_str() {
                "/dev/null" => None,
                s => Some(s.to_owned()),
            },
            dst: match caps.get(2).unwrap().as_str() {
                "/dev/null" => None,
                s => Some(s.to_owned()),
            },
            hunks: split_hunks(caps.get(3).unwrap().as_str()).collect(),
        })
    })
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiffChunk {
    pub src: Option<String>,
    pub dst: Option<String>,
    pub hunks: Vec<DiffHunk>,
}

impl DiffChunk {
    pub fn fixup_hunks(&mut self) {
        self.hunks.retain_mut(|h| {
            if !h.fixup() {
                false
            } else {
                h.lines.iter().any(|l| !matches!(l, Line::Context(_)))
            }
        });
    }
}

impl fmt::Display for DiffChunk {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let hunks_str = self.hunks.iter().map(|h| h.to_string()).collect::<String>();

        let src = if let Some(s) = self.src.as_deref() {
            s
        } else {
            "/dev/null"
        };

        let dst = if let Some(s) = self.dst.as_deref() {
            s
        } else {
            "/dev/null"
        };

        write!(f, "--- {src}\n+++ {dst}\n{hunks_str}")
    }
}

fn split_hunks(hunks: &str) -> impl Iterator<Item = DiffHunk> + '_ {
    let hunk_regex =
        regex!(r#"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@.*\n((?:^\n|^[-+ ].*\n?)*)"#m);

    hunk_regex.captures_iter(hunks).map(|caps| DiffHunk {
        src_line: caps.get(1).unwrap().as_str().parse().unwrap(),
        src_count: caps
            .get(2)
            .and_then(|m| m.as_str().parse().ok())
            .unwrap_or(0),
        dst_line: caps.get(3).unwrap().as_str().parse().unwrap(),
        dst_count: caps
            .get(4)
            .and_then(|m| m.as_str().parse().ok())
            .unwrap_or(0),
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
                    " " => Line::Context(line.into()),
                    "+" => Line::AddLine(line.into()),
                    "-" => Line::DelLine(line.into()),
                    _ => unreachable!("unknown character slipped through regex"),
                })
                .collect()
        },
    })
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiffHunk {
    pub src_line: usize,
    pub dst_line: usize,
    pub src_count: usize,
    pub dst_count: usize,

    pub lines: Vec<Line>,
}

impl DiffHunk {
    fn fixup(&mut self) -> bool {
        let src = self
            .lines
            .iter()
            .filter_map(|line| match line {
                Line::Context(l) => Some(format!("{l}\n")),
                Line::AddLine(_) => None,
                Line::DelLine(l) => Some(format!("{l}\n")),
            })
            .collect::<String>();

        let dst = self
            .lines
            .iter()
            .filter_map(|line| match line {
                Line::Context(l) => Some(format!("{l}\n")),
                Line::AddLine(l) => Some(format!("{l}\n")),
                Line::DelLine(_) => None,
            })
            .collect::<String>();

        let patch = diffy::DiffOptions::default()
            .set_context_len(usize::MAX)
            .create_patch(&src, &dst);
        let patch = patch.to_string();

        let mut new_hunks = split_hunks(&patch).collect::<Vec<_>>();

        if new_hunks.is_empty() {
            return false;
        }

        assert_eq!(
            new_hunks.len(),
            1,
            "regenerated hunk's patch was malformed:\n\n{patch}"
        );
        self.lines = new_hunks.pop().unwrap().lines.into_iter().collect();

        self.src_count = self
            .lines
            .iter()
            .map(|l| match l {
                Line::Context(_) | Line::DelLine(_) => 1,
                Line::AddLine(_) => 0,
            })
            .sum();

        self.dst_count = self
            .lines
            .iter()
            .map(|l| match l {
                Line::Context(_) | Line::AddLine(_) => 1,
                Line::DelLine(_) => 0,
            })
            .sum();

        true
    }
}

impl fmt::Display for DiffHunk {
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Line {
    Context(String),
    AddLine(String),
    DelLine(String),
}

impl fmt::Display for Line {
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

        assert_eq!(extract_diff(s).unwrap(), "foo bar\n");
    }

    #[test]
    fn test_extract_diff_complex() {
        let s = "```diff
x

    ```diff
foo bar
 ```
```";

        assert_eq!(
            extract_diff(s).unwrap(),
            "x\n\n    ```diff\nfoo bar\n ```\n"
        );
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
@@ -10 +10 @@
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
@@ -10,1 +10,1 @@
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
                    Line::Context("context".to_owned()),
                    Line::Context(
                        "the line right below this one is intentionally empty".to_owned(),
                    ),
                    Line::Context("".to_owned()),
                    Line::DelLine("foo".to_owned()),
                    Line::AddLine("bar".to_owned()),
                ],
            },
            DiffHunk {
                src_line: 10,
                src_count: 1,
                dst_line: 10,
                dst_count: 2,
                lines: vec![
                    Line::DelLine("bar".to_owned()),
                    Line::AddLine("quux".to_owned()),
                    Line::AddLine("quux2".to_owned()),
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
                src: Some("foo.rs".to_owned()),
                dst: Some("foo.rs".to_owned()),
                hunks: vec![DiffHunk {
                    src_line: 1,
                    src_count: 1,
                    dst_line: 1,
                    dst_count: 1,
                    lines: vec![
                        Line::Context("context".to_owned()),
                        Line::Context(
                            "the line right below this one is intentionally empty".to_owned(),
                        ),
                        Line::Context("".to_owned()),
                        Line::DelLine("foo".to_owned()),
                        Line::AddLine("bar".to_owned()),
                    ],
                }],
            },
            DiffChunk {
                src: Some("bar.rs".to_owned()),
                dst: Some("bar.rs".to_owned()),
                hunks: vec![DiffHunk {
                    src_line: 10,
                    src_count: 1,
                    dst_line: 10,
                    dst_count: 2,
                    lines: vec![
                        Line::DelLine("bar".to_owned()),
                        Line::AddLine("quux".to_owned()),
                        Line::AddLine("quux2".to_owned()),
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
                src: Some("server/bleep/src/analytics.rs".to_owned()),
                dst: Some("server/bleep/src/analytics.rs".to_owned()),
                hunks: vec![DiffHunk {
                    src_line: 215,
                    src_count: 7,
                    dst_line: 215,
                    dst_count: 22,
                    lines: vec![
                        Line::Context("            }));".to_owned()),
                        Line::Context("        }".to_owned()),
                        Line::Context("    }".to_owned()),
                        Line::AddLine("    ".to_owned()),
                        Line::AddLine("    pub fn track_index_repo(&self, user: &crate::webserver::middleware::User, repo_ref: RepoRef) {".to_owned()),
                        Line::AddLine(r#"        if let Some(options) = &self.options {"#.to_owned()),
                        Line::AddLine(r#"            self.send(Message::Track(Track {"#.to_owned()),
                        Line::AddLine(r#"                user_id: Some(self.tracking_id(user.username())),"#.to_owned()),
                        Line::AddLine(r#"                event: "index repo".to_owned(),"#.to_owned()),
                        Line::AddLine(r#"                properties: Some(json!({"#.to_owned()),
                        Line::AddLine(r#"                    "device_id": self.device_id(),"#.to_owned()),
                        Line::AddLine(r#"                    "repo_ref": repo_ref.to_string(),"#.to_owned()),
                        Line::AddLine(r#"                    "package_metadata": options.package_metadata,"#.to_owned()),
                        Line::AddLine(r#"                })),"#.to_owned()),
                        Line::AddLine(r#"                ..Default::default()"#.to_owned()),
                        Line::AddLine(r#"            }));"#.to_owned()),
                        Line::AddLine(r#"        }"#.to_owned()),
                        Line::AddLine(r#"    }"#.to_owned()),
                        Line::Context("}".to_owned()),
                        Line::Context("".to_owned()),
                        Line::Context("impl From<Option<String>> for DeviceId {".to_owned()),
                        Line::Context("".to_owned()),
                    ],
                }],
            },
            DiffChunk {
                src: Some("server/bleep/src/indexes.rs".to_owned()),
                dst: Some("server/bleep/src/indexes.rs".to_owned()),
                hunks: vec![
                    DiffHunk {
                        src_line: 61,
                        src_count: 7,
                        dst_line: 61,
                        dst_count: 9,
                        lines: vec![
                            Line::Context(r#"    }"#.to_owned()),
                            Line::Context(r#""#.to_owned()),
                            Line::Context(r#"    pub(crate) async fn index("#.to_owned()),
                            Line::Context(r#"        &self,"#.to_owned()),
                            Line::AddLine(r#"        analytics: &RudderHub,  // Pass in the RudderHub instance"#.to_owned()),
                            Line::AddLine(r#"        user: &crate::webserver::middleware::User,  // Pass in the current user"#.to_owned()),
                            Line::Context(r#"        sync_handle: &SyncHandle,"#.to_owned()),
                            Line::Context(r#"        repo: &Repository,"#.to_owned()),
                            Line::Context(r#"    ) -> Result<Arc<RepoMetadata>, RepoError> {"#.to_owned()),
                        ],
                    },
                    DiffHunk {
                        src_line: 70,
                        src_count: 6,
                        dst_line: 72,
                        dst_count: 9,
                        lines: vec![
                            Line::Context(r#""#.to_owned()),
                            Line::Context(r#"        for h in &self.handles {"#.to_owned()),
                            Line::Context(r#"            h.index(sync_handle, repo, &metadata).await?;"#.to_owned()),
                            Line::AddLine(r#"            "#.to_owned()),
                            Line::AddLine(r#"            // Track the repo indexing event"#.to_owned()),
                            Line::AddLine(r#"            analytics.track_index_repo(user, repo.repo_ref.clone());"#.to_owned()),
                            Line::Context(r#"        }"#.to_owned()),
                            Line::Context(r#""#.to_owned()),
                            Line::Context(r#"        Ok(metadata)"#.to_owned()),
                        ],
                    },
                ],
            },
        ];

        let output = extract(chat_response).unwrap().collect::<Vec<_>>();

        assert_eq!(expected, output);
    }

    #[test]
    fn test_split_chunks_no_count() {}

    #[test]
    fn test_fixup_remove_redundancy() {
        let mut hunk = DiffHunk {
            src_line: 10,
            src_count: 5,
            dst_line: 10,
            dst_count: 5,
            lines: vec![
                Line::DelLine("fn main() {".to_owned()),
                Line::AddLine("fn main() {".to_owned()),
                Line::Context("    let a = 123;".to_owned()),
                Line::DelLine("    println!(\"the value of `a` is {a:?}\");".to_owned()),
                Line::AddLine("    dbg!(&a);".to_owned()),
                Line::Context("    drop(a);".to_owned()),
                Line::Context("}".to_owned()),
            ],
        };

        hunk.fixup();

        let expected = DiffHunk {
            src_line: 10,
            src_count: 5,
            dst_line: 10,
            dst_count: 5,
            lines: vec![
                Line::Context("fn main() {".to_owned()),
                Line::Context("    let a = 123;".to_owned()),
                Line::DelLine("    println!(\"the value of `a` is {a:?}\");".to_owned()),
                Line::AddLine("    dbg!(&a);".to_owned()),
                Line::Context("    drop(a);".to_owned()),
                Line::Context("}".to_owned()),
            ],
        };

        assert_eq!(expected, hunk);
    }

    #[test]
    fn test_extract_redundant() {
        let chat_response = "```diff
--- server/bleep/src/query/parser.rs
+++ server/bleep/src/query/parser.rs
@@ -64,7 +64,7 @@
     }
 
     pub fn from_str(query: String, repo_ref: String) -> Self {
-        Self {
+        Self {
             target: Some(Literal::Plain(Cow::Owned(query))),
             repos: [Literal::Plain(Cow::Owned(repo_ref))].into(),
             ..Default::default()
```";

        for _ in extract(&chat_response).unwrap() {}
    }

    #[test]
    fn test_multiple_diff_blocks() {
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
```

```diff
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

        let expected = r#"--- server/bleep/src/analytics.rs
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
"#;

        let output = extract_diff(chat_response).unwrap();

        assert_eq!(expected, output);
    }
}
