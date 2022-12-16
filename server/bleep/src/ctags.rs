use std::{
    collections::HashMap,
    ffi::OsStr,
    path::{Path, PathBuf},
    process::Stdio,
};

use crate::{
    symbol::Symbol,
    text_range::{Point, TextRange},
};

use anyhow::{bail, Context, Result};
use futures::{stream, StreamExt};
use ignore::WalkBuilder;
use once_cell::sync::OnceCell;
use serde::Deserialize;
use tokio::{io::AsyncWriteExt, process::Command};

use tracing::{debug, warn};

pub static CTAGS_BINARY: OnceCell<PathBuf> = OnceCell::new();
pub type SymbolMap = HashMap<PathBuf, Vec<Symbol>>;

#[derive(Debug, Deserialize)]
struct RawSymbol {
    #[allow(unused)]
    #[serde(rename = "_type")]
    type_: String,
    #[allow(unused)]
    name: String,
    path: String,
    line: u32,
    kind: String,
}

fn find_files(path: &Path) -> Vec<String> {
    WalkBuilder::new(path)
        .ignore(true)
        .git_ignore(true)
        .hidden(false)
        .build()
        .filter_map(|res| match res {
            Ok(de) => Some(de),
            Err(e) => {
                warn!(%e, "access failure; skipping");
                None
            }
        })
        .filter(|de| matches!(de.file_type(), Some(ft) if ft.is_file()))
        .map(|de| {
            dunce::canonicalize(de.path())
                .unwrap()
                .to_string_lossy()
                .to_string()
        })
        .collect()
}

async fn call_ctags(paths: Vec<String>, exclude_langs_list: &[&str]) -> Result<String> {
    // There might be a way to generate this list from intelligence::ALL_LANGUAGES,
    // but not all lang_ids are valid ctags' languages though, so we hardcode some here:
    let exclude_langs = exclude_langs_list
        .iter()
        .map(|name| format!("-{name},"))
        .collect::<String>();

    // this flag is of the form:  `--languages=+all,-lang1,lang2,lang3,`
    let language_exclude_list_flag = format!("--languages=+all,{exclude_langs}");

    let args = vec![
        "--output-format=json",
        "--fields=+n-P",
        language_exclude_list_flag.as_str(),
        "-L",
        "-",
        "-f",
        "-",
    ];

    let mut child = Command::new(
        CTAGS_BINARY
            .get()
            .map(|p| p.as_os_str())
            .unwrap_or_else(|| OsStr::new("ctags")),
    )
    .args(args)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .spawn()?;

    let mut stdin = child
        .stdin
        .take()
        .context("child did not have a handle to stdin")?;

    stdin
        .write_all(paths.join("\n").as_bytes())
        .await
        .context("could not write to stdin")?;

    drop(stdin);

    let output = child.wait_with_output().await?;
    if !output.status.success() {
        bail!(
            "ctags failed with error {}",
            String::from_utf8(output.stderr)?
        )
    }
    Ok(String::from_utf8(output.stdout)?)
}

pub async fn ctags_for_file(repo_disk_path: &Path, file: &Path) -> Result<Option<Vec<Symbol>>> {
    call_ctags(vec![file.to_string_lossy().to_string()], &[])
        .await
        .map(|output| parse_symbols(repo_disk_path, vec![output]))
        .map(|sm| sm.into_values().next())
}

pub async fn get_symbols(repo_disk_path: &Path, exclude_langs: &[&str]) -> SymbolMap {
    let paths = find_files(repo_disk_path);

    let threads = std::thread::available_parallelism()
        .expect("we would not have got this far")
        .get();

    let mut files = vec![vec![]; threads];
    for (i, f) in paths.into_iter().enumerate() {
        files[i % threads].push(f);
    }

    let outputs = stream::iter(
        files
            .into_iter()
            .map(|paths| async move { call_ctags(paths, exclude_langs).await }),
    )
    .buffer_unordered(threads)
    .filter_map(|result| async move { result.ok() })
    .map(|output| async { parse_symbols(repo_disk_path, vec![output]) })
    .buffer_unordered(threads)
    .fold(HashMap::new(), |mut acc, input| async move {
        acc.extend(input);
        acc
    })
    .await;

    outputs
}

fn parse_symbols(repo_disk_path: &Path, outputs: Vec<String>) -> SymbolMap {
    let mut cur_file = None;
    let symbol_map = outputs
        .iter()
        .flat_map(|stdout| stdout.lines())
        .filter_map(|l| serde_json::from_str(l).ok())
        .filter_map(move |raw: RawSymbol| {
            let absolute_file_path = Path::new(&raw.path);
            let relative_file_path = absolute_file_path
                .strip_prefix(repo_disk_path)
                .expect("Repo path is not a prefix of file path");

            let (body, line_ends) = match cur_file {
                Some((ref path, ref body, ref line_ends)) if path == &raw.path => (body, line_ends),
                _ => {
                    // TODO: Parallelize this per-file.
                    let body = std::fs::read_to_string(absolute_file_path).ok()?;

                    // Create a cached list of line endings, including an implicit line ending
                    // before the first character and an extra line ending at the end of the file.
                    let mut line_ends = vec![-1];
                    line_ends.extend(body.match_indices('\n').map(|(i, _)| i as i32));
                    line_ends.push(body.len() as i32);

                    cur_file = Some((raw.path.clone(), body, line_ends));
                    let (_, body, line_ends) = cur_file.as_ref().unwrap();

                    (body, line_ends)
                }
            };
            let line_start = (*line_ends.get(raw.line as usize - 1)? + 1) as usize;
            let line_end = *line_ends.get(raw.line as usize)? as usize;

            let column = match body[line_start..line_end].find(&raw.name) {
                Some(c) => c,
                // The symbol name isn't present. This happens with anonymous functions,
                // which ctags give arbitrary names, e.g. 'anonymousFunctione906f681370'
                _ => {
                    debug!("couldn't find ctags symbol name");
                    return None;
                }
            };

            let start = {
                let byte = line_start + column;
                // To 0-indexed line numbers
                let line = raw.line as usize - 1;
                Point::new(byte, line, column)
            };
            let end = {
                let end_column = column + raw.name.len();
                let byte = line_start + end_column;
                // To 0-indexed line numbers
                let line = raw.line as usize - 1;
                Point::new(byte, line, end_column)
            };
            let range = TextRange::new(start, end);

            Some((
                relative_file_path.to_path_buf(),
                Symbol {
                    kind: raw.kind,
                    range,
                },
            ))
        })
        .fold(HashMap::new(), |mut acc, (k, v)| {
            acc.entry(k).or_insert_with(Vec::new).push(v);
            acc
        });

    symbol_map
}

#[cfg(test)]
mod tests {
    use tempdir::TempDir;

    use super::*;
    use crate::text_range::Point;

    #[tokio::test]
    async fn run_ctags() {
        let path = dunce::canonicalize(Path::new(".")).unwrap();
        let symbols = get_symbols(&path, &[]).await;
        assert!(!symbols.is_empty());
    }

    #[tokio::test]
    async fn exclude_js_files() {
        let exclude_langs = &["javascript", "typescript", "python", "go", "c", "rust"];
        let dir = TempDir::new("parse-ctags").unwrap();
        let dir_path = dunce::canonicalize(dir.path()).unwrap();

        // create js file with 2 symbols
        let js_file_path = dir_path.join("foo.js");
        let js_file_content = "function foo() {}\nfunction bar() {}";

        // create go file with 2 symbols
        let go_file_path = dir_path.join("foo.go");
        let go_file_content = "func foo() {}\nfunc bar() {}";

        // create haskell file with 2 symbols
        let hs_file_path = dir_path.join("foo.hs");
        let hs_file_content = "foo = ()\nbar = ()";

        std::fs::write(&js_file_path, js_file_content).unwrap();
        std::fs::write(&go_file_path, go_file_content).unwrap();
        std::fs::write(&hs_file_path, hs_file_content).unwrap();

        // js files should be excluded
        let symbols = get_symbols(&js_file_path, exclude_langs).await;
        assert!(symbols.is_empty());

        // go files should be excluded
        let symbols = get_symbols(&go_file_path, exclude_langs).await;
        assert!(symbols.is_empty());

        // haskell files should be included
        let symbols = get_symbols(&hs_file_path, exclude_langs).await;
        assert_eq!(symbols.values().flatten().count(), 2);
    }

    #[test]
    fn parse_ctags() {
        let dir = TempDir::new("parse-ctags").unwrap();
        let body = "function foo() {}\nfunction bar() {}";
        let file_path = dir.path().join("foo.js");

        std::fs::write(&file_path, body).unwrap();

        let ctags_output = vec![
            format!(
                r#"{{"_type": "tag", "name": "foo", "path": "{}", "line": 1, "kind": "function"}}"#,
                file_path.to_string_lossy()
            ),
            format!(
                r#"{{"_type": "tag", "name": "bar", "path": "{}", "line": 2, "kind": "function"}}"#,
                file_path.to_string_lossy()
            ),
        ];

        let symbol_map = parse_symbols(dir.path(), ctags_output)
            .into_iter()
            .collect::<Vec<_>>();

        assert_eq!(
            symbol_map,
            &[(
                PathBuf::from("foo.js"),
                vec![
                    Symbol {
                        kind: "function".to_owned(),
                        range: TextRange::new(Point::new(9, 0, 9), Point::new(12, 0, 12))
                    },
                    Symbol {
                        kind: "function".to_owned(),
                        range: TextRange::new(Point::new(27, 1, 9), Point::new(30, 1, 12))
                    },
                ]
            )]
        );
    }
}
