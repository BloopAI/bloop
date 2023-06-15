use std::{collections::HashMap, path::Path};

use once_cell::sync::Lazy;
use regex::Regex;
use smallvec::SmallVec;
use tracing::warn;

mod fs;
mod git;
pub(super) mod language;

pub use fs::FileWalker;
pub use git::{BranchFilter, GitWalker};

use crate::background::SyncPipes;

// Empirically calculated using:
//     cat **/*.rs | awk '{SUM+=length;N+=1}END{print SUM/N}'
pub const AVG_LINE_LEN: u64 = 30;
pub const MAX_LINE_COUNT: u64 = 20000;
pub const MAX_FILE_LEN: u64 = AVG_LINE_LEN * MAX_LINE_COUNT;

pub trait FileSource {
    fn len(&self) -> usize;
    fn for_each(self, signal: &SyncPipes, iterator: impl Fn(RepoDirEntry) + Sync + Send);
}

pub enum RepoDirEntry {
    Dir(RepoDir),
    File(RepoFile),
    Other,
}

impl RepoDirEntry {
    pub fn path(&self) -> Option<&str> {
        match self {
            Self::File(file) => Some(file.path.as_str()),
            Self::Dir(dir) => Some(dir.path.as_str()),
            Self::Other => None,
        }
    }

    pub fn buffer(&self) -> Option<&str> {
        match self {
            Self::File(file) => Some(file.buffer.as_str()),
            _ => None,
        }
    }
}

pub struct RepoDir {
    pub path: String,
    pub branches: Vec<String>,
}

pub struct RepoFile {
    pub path: String,
    pub buffer: String,
    pub branches: Vec<String>,
}

#[derive(Hash, Eq, PartialEq)]
pub enum FileType {
    File,
    Dir,
    Other,
}

fn should_index_entry(de: &ignore::DirEntry) -> bool {
    should_index(&de.path())
}

fn should_index<P: AsRef<Path>>(p: &P) -> bool {
    let path = p.as_ref();

    // TODO: Make this more robust
    if path.components().any(|c| c.as_os_str() == ".git") {
        return false;
    }

    #[rustfmt::skip]
    const EXT_BLACKLIST: &[&str] = &[
        // graphics
        "png", "jpg", "jpeg", "ico", "bmp", "bpg", "eps", "pcx", "ppm", "tga", "tiff", "wmf", "xpm",
        "svg",
        // fonts
        "ttf", "woff2", "fnt", "fon", "otf",
        // documents
        "pdf", "ps", "doc", "dot", "docx", "dotx", "xls", "xlsx", "xlt", "odt", "ott", "ods", "ots", "dvi", "pcl",
        // media
        "mp3", "ogg", "ac3", "aac", "mod", "mp4", "mkv", "avi", "m4v", "mov", "flv",
        // compiled
        "jar", "pyc", "war", "ear",
        // compression
        "tar", "gz", "bz2", "xz", "7z", "bin", "apk", "deb", "rpm",
        // executable
        "com", "exe", "out", "coff", "obj", "dll", "app", "class",
        // misc.
        "log", "wad", "bsp", "bak", "sav", "dat", "lock",
    ];

    let Some(ext) = path.extension() else {
        return true;
    };

    let ext = ext.to_string_lossy();
    if EXT_BLACKLIST.contains(&&*ext) {
        return false;
    }

    static VENDOR_PATTERNS: Lazy<HashMap<&'static str, SmallVec<[Regex; 1]>>> = Lazy::new(|| {
        let patterns: &[(&[&str], &[&str])] = &[
            (
                &["go", "proto"],
                &["^(vendor|third_party)/.*\\.\\w+$", "\\w+\\.pb\\.go$"],
            ),
            (
                &["js", "jsx", "ts", "tsx", "css", "md", "json", "txt", "conf"],
                &["^(node_modules|vendor|dist)/.*\\.\\w+$"],
            ),
        ];

        patterns
            .iter()
            .flat_map(|(exts, rxs)| exts.iter().map(move |&e| (e, rxs)))
            .map(|(ext, rxs)| {
                let regexes = rxs
                    .iter()
                    .filter_map(|source| match Regex::new(source) {
                        Ok(r) => Some(r),
                        Err(e) => {
                            warn!(%e, "failed to compile vendor regex {source:?}");
                            None
                        }
                    })
                    .collect();

                (ext, regexes)
            })
            .collect()
    });

    match VENDOR_PATTERNS.get(&*ext) {
        None => true,
        Some(rxs) => !rxs.iter().any(|r| r.is_match(&path.to_string_lossy())),
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_should_index() {
        let tests = [
            // Ignore these extensions completely.
            ("image.png", false),
            ("image.jpg", false),
            ("image.jpeg", false),
            ("font.ttf", false),
            ("font.otf", false),
            ("font.woff2", false),
            ("icon.ico", false),
            // Simple paths that should be indexed.
            ("foo.js", true),
            ("bar.ts", true),
            ("quux/fred.ts", true),
            // Typical vendored paths.
            ("vendor/jquery.js", false),
            ("dist/react.js", false),
            ("vendor/github.com/Microsoft/go-winio/file.go", false),
            (
                "third_party/protobuf/google/protobuf/descriptor.proto",
                false,
            ),
            ("src/defs.pb.go", false),
            // These are not typically vendored in Rust.
            ("dist/main.rs", true),
            ("vendor/foo.rs", true),
            // Ignore .git directory.
            (".git/HEAD", false),
            (".git/config", false),
            (".gitignore", true),
            (".github/workflows/ci.yml", true),
        ];

        for (path, index) in tests {
            assert_eq!(should_index(&Path::new(path)), index);
        }
    }
}
