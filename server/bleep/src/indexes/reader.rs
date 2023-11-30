use anyhow::Result;
use async_trait::async_trait;
use tantivy::{
    schema::{Field, Value},
    Index,
};

use super::{file::File, repo::Repo, DocumentRead};
use crate::{
    intelligence::TreeSitterFile,
    query::{
        compiler::Compiler,
        parser::{self, Query, Target},
    },
    symbol::SymbolLocations,
    text_range::TextRange,
};

#[derive(Default, Debug, Clone)]
pub struct ContentDocument {
    pub content: String,
    pub lang: Option<String>,
    pub relative_path: String,
    pub repo_name: String,
    pub repo_ref: String,
    pub line_end_indices: Vec<u32>,
    pub symbol_locations: SymbolLocations,
    pub branches: Option<String>,
    pub indexed: bool,
}

impl std::hash::Hash for ContentDocument {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.repo_ref.hash(state);
        self.branches.hash(state);
        self.relative_path.hash(state);
        self.content.hash(state);
    }
}

impl PartialEq for ContentDocument {
    fn eq(&self, other: &Self) -> bool {
        self.repo_ref == other.repo_ref
            && self.branches == other.branches
            && self.relative_path == other.relative_path
            && self.content == other.content
    }
}
impl Eq for ContentDocument {}

impl ContentDocument {
    pub fn hoverable_ranges(&self) -> Option<Vec<TextRange>> {
        TreeSitterFile::try_build(self.content.as_bytes(), self.lang.as_ref()?)
            .and_then(TreeSitterFile::hoverable_ranges)
            .ok()
    }
}

#[derive(Debug)]
pub struct FileDocument {
    pub relative_path: String,
    pub repo_name: String,
    pub repo_ref: String,
    pub lang: Option<String>,
    pub branches: String,
    pub indexed: bool,
    pub is_dir: bool,
}

pub struct RepoDocument {
    pub org: String,
    pub name: String,
    pub repo_ref: String,
}

pub struct ContentReader;

#[async_trait]
impl DocumentRead for ContentReader {
    type Schema = File;
    type Document = ContentDocument;

    fn query_matches(&self, query: &Query<'_>) -> bool {
        matches!(
            query,
            Query {
                open: Some(false) | None,
                target: Some(Target::Content(..) | Target::Symbol(..)),
                ..
            }
        )
    }

    fn compile<'a, I>(
        &self,
        schema: &File,
        queries: I,
        tantivy_index: &Index,
    ) -> Result<Box<dyn tantivy::query::Query>>
    where
        I: Iterator<Item = &'a Query<'a>>,
    {
        Compiler::new()
            .priority(&[schema.relative_path])
            .literal(schema.relative_path, |q| q.path.clone())
            .literal(schema.repo_name, |q| q.repo.clone())
            .literal(schema.branches, |q| q.branch.clone())
            .byte_string(schema.lang, |q| q.lang.as_ref().map(AsRef::as_ref))
            .literal(schema.symbols, |q| {
                q.target.as_ref().and_then(Target::symbol).cloned()
            })
            .literal(schema.content, |q| {
                q.target.as_ref().and_then(Target::content).cloned()
            })
            .compile(queries, tantivy_index)
    }

    fn read_document(&self, schema: &File, doc: tantivy::Document) -> Self::Document {
        let relative_path = read_text_field(&doc, schema.relative_path);
        let repo_ref = read_text_field(&doc, schema.repo_ref);
        let repo_name = read_text_field(&doc, schema.repo_name);
        let content = read_text_field(&doc, schema.content);
        let lang = read_lang_field(&doc, schema.lang);
        let branches = read_lang_field(&doc, schema.branches);
        let indexed = read_bool_field(&doc, schema.indexed);

        let line_end_indices = doc
            .get_first(schema.line_end_indices)
            .unwrap()
            .as_bytes()
            .unwrap()
            .chunks_exact(4)
            .map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect();

        let symbol_locations = bincode::deserialize(
            doc.get_first(schema.symbol_locations)
                .unwrap()
                .as_bytes()
                .unwrap(),
        )
        .unwrap_or_default();

        ContentDocument {
            relative_path,
            repo_name,
            repo_ref,
            content,
            symbol_locations,
            line_end_indices,
            lang,
            branches,
            indexed,
        }
    }
}

pub struct FileReader;

#[async_trait]
impl DocumentRead for FileReader {
    type Document = FileDocument;
    type Schema = File;

    fn query_matches(&self, query: &Query<'_>) -> bool {
        matches!(
            query,
            // Match both language or filename searches. Handles searches like:
            //   lang:Rust
            //   path:server
            //   lang:Rust path:server
            Query {
                open: Some(false) | None,
                target: None,
                lang: Some(..),
                ..
            } | Query {
                open: Some(false) | None,
                target: None,
                path: Some(..),
                ..
            }
        )
    }

    fn compile<'a, I>(
        &self,
        schema: &Self::Schema,
        queries: I,
        tantivy_index: &Index,
    ) -> Result<Box<dyn tantivy::query::Query>>
    where
        I: Iterator<Item = &'a Query<'a>>,
    {
        Compiler::new()
            .literal(schema.relative_path, |q| q.path.clone())
            .literal(schema.repo_name, |q| q.repo.clone())
            .literal(schema.branches, |q| q.branch.clone())
            .byte_string(schema.lang, |q| q.lang.as_ref().map(AsRef::as_ref))
            .compile(queries, tantivy_index)
    }

    fn read_document(&self, schema: &Self::Schema, doc: tantivy::Document) -> Self::Document {
        let relative_path = read_text_field(&doc, schema.relative_path);
        let repo_ref = read_text_field(&doc, schema.repo_ref);
        let repo_name = read_text_field(&doc, schema.repo_name);
        let lang = read_lang_field(&doc, schema.lang);
        let branches = read_text_field(&doc, schema.branches);
        let indexed = read_bool_field(&doc, schema.indexed);
        let is_dir = read_bool_field(&doc, schema.is_directory);

        FileDocument {
            relative_path,
            repo_name,
            repo_ref,
            lang,
            branches,
            indexed,
            is_dir,
        }
    }
}

pub struct RepoReader;

#[async_trait]
impl DocumentRead for RepoReader {
    type Document = RepoDocument;
    type Schema = Repo;

    fn query_matches(&self, query: &Query<'_>) -> bool {
        matches!(
            query,
            Query {
                open: Some(false) | None,
                repo: Some(..),
                path: None,
                target: None,
                ..
            }
        )
    }

    fn compile<'a, I>(
        &self,
        schema: &Repo,
        queries: I,
        tantivy_index: &Index,
    ) -> Result<Box<dyn tantivy::query::Query>>
    where
        I: Iterator<Item = &'a Query<'a>>,
    {
        Compiler::new()
            .literal(schema.name, |q| q.repo.clone())
            .compile(queries, tantivy_index)
    }

    fn read_document(&self, schema: &Repo, doc: tantivy::Document) -> Self::Document {
        let org = read_text_field(&doc, schema.org);
        let name = read_text_field(&doc, schema.name);
        let repo_ref = read_text_field(&doc, schema.repo_ref);

        RepoDocument {
            org,
            name,
            repo_ref,
        }
    }
}

pub struct OpenReader;

#[derive(Debug)]
pub struct OpenDocument {
    pub relative_path: String,
    pub repo_name: String,
    pub repo_ref: String,
    pub lang: Option<String>,
    pub content: String,
    pub line_end_indices: Vec<u32>,
    pub indexed: bool,
}

#[async_trait]
impl DocumentRead for OpenReader {
    type Document = OpenDocument;
    type Schema = File;

    fn query_matches(&self, query: &Query<'_>) -> bool {
        matches!(
            query,
            Query {
                open: Some(true),

                // All open queries must specify at least the repository name. We don't accept regex
                // inputs for this type of query.
                repo: Some(parser::Literal::Plain(..)),
                path: None | Some(parser::Literal::Plain(..)),

                // We want to make sure this query isn't a symbol or content search, which doesn't
                // make sense for a file open.
                target: None,
                ..
            }
        )
    }

    fn compile<'a, I>(
        &self,
        schema: &File,
        queries: I,
        tantivy_index: &Index,
    ) -> Result<Box<dyn tantivy::query::Query>>
    where
        I: Iterator<Item = &'a Query<'a>>,
    {
        Compiler::new()
            .literal(schema.repo_name, |q| q.repo.clone())
            .literal(schema.branches, |q| q.branch.clone())
            .literal(schema.relative_path, |q| match &q.path {
                // We coerce path searches to always return sibling files. These are sorted later
                // by users of this reader.
                Some(parser::Literal::Plain(s)) => {
                    Some(parser::Literal::Plain(match base_name(s) {
                        s if s.is_empty() => return None,
                        s => s.into(),
                    }))
                }
                _ => None,
            })
            .byte_string(schema.lang, |q| q.lang.as_ref().map(AsRef::as_ref))
            .compile(queries, tantivy_index)
    }

    fn read_document(&self, schema: &File, doc: tantivy::Document) -> Self::Document {
        let relative_path = read_text_field(&doc, schema.relative_path);
        let repo_name = read_text_field(&doc, schema.repo_name);
        let repo_ref = read_text_field(&doc, schema.repo_ref);
        let lang = read_lang_field(&doc, schema.lang);
        let content = read_text_field(&doc, schema.content);
        let line_end_indices = doc
            .get_first(schema.line_end_indices)
            .unwrap()
            .as_bytes()
            .unwrap()
            .chunks_exact(4)
            .map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect();
        let indexed = read_bool_field(&doc, schema.indexed);

        Self::Document {
            relative_path,
            repo_name,
            repo_ref,
            lang,
            content,
            line_end_indices,
            indexed,
        }
    }
}

/// Get the basename of a path, returning an empty string if the path contains no separators.
///
/// ## Examples
///
/// - `"bar/foo.txt" -> "bar/"`
/// - `"bar/" -> "bar/"`
/// - `"foo.txt" -> ""`
pub fn base_name(path: &str) -> &str {
    path.rfind('/').map(|i| &path[..i + 1]).unwrap_or("")
}

fn read_bool_field(doc: &tantivy::Document, field: Field) -> bool {
    doc.get_first(field).unwrap().as_bool().unwrap()
}

fn read_text_field(doc: &tantivy::Document, field: Field) -> String {
    let Some(field) = doc.get_first(field) else {
        return Default::default();
    };

    field.as_text().unwrap().into()
}

fn read_lang_field(doc: &tantivy::Document, lang: Field) -> Option<String> {
    let lang_str = crate::query::languages::proper_case(
        doc.get_first(lang)
            .and_then(Value::as_bytes)
            .map(String::from_utf8_lossy)
            .unwrap_or_default(),
    )
    .into_owned();

    // None if "", Some(l) otherwise
    if lang_str.is_empty() {
        None
    } else {
        Some(lang_str)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_base_name() {
        assert_eq!(base_name("bar/foo.txt"), format!("bar/"));
        assert_eq!(base_name("bar/"), format!("bar/"));
        assert_eq!(base_name("foo.txt"), "");
    }
}
