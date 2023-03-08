pub mod code_navigation;
mod language;
mod namespace;
mod scope_resolution;

use std::path::Path;

pub use {
    language::{Language, MemoizedQuery, TSLanguage, TSLanguageConfig, ALL_LANGUAGES},
    namespace::*,
    scope_resolution::{NodeKind, ScopeGraph},
};

use scope_resolution::ResolutionMethod;
use stack_graphs::graph::StackGraph;
use tree_sitter::{Parser, Tree};
use tree_sitter_graph::Variables;
use tree_sitter_stack_graphs::{
    loader::{FileAnalyzers, LanguageConfiguration as StackGraphConfig, LoadError},
    NoCancellation,
};

/// A tree-sitter representation of a file
pub struct TreeSitterFile<'a> {
    /// The original source that was used to generate this file.
    src: &'a [u8],

    /// The syntax tree of this file.
    tree: Tree,

    /// The supplied language for this file.
    language: &'static TSLanguageConfig,
}

#[derive(Debug)]
pub enum TreeSitterFileError {
    UnsupportedLanguage,
    ParseTimeout,
    LanguageMismatch,
    QueryError(tree_sitter::QueryError),
    FileTooLarge,
    LoadError,
}

impl<'a> TreeSitterFile<'a> {
    /// Create a TreeSitterFile out of a sourcefile
    pub fn try_build(src: &'a [u8], lang_id: &str) -> Result<Self, TreeSitterFileError> {
        // no scope-res for files larger than 500kb
        if src.len() > 500 * 10usize.pow(3) {
            return Err(TreeSitterFileError::FileTooLarge);
        }

        let language = match TSLanguage::from_id(lang_id) {
            Language::Supported(language) => Ok(language),
            Language::Unsupported => Err(TreeSitterFileError::UnsupportedLanguage),
        }?;

        let mut parser = Parser::new();
        parser
            .set_language((language.grammar)())
            .map_err(|_| TreeSitterFileError::LanguageMismatch)?;

        // do not permit files that take >1s to parse
        parser.set_timeout_micros(10u64.pow(6));

        let tree = parser
            .parse(src, None)
            .ok_or(TreeSitterFileError::ParseTimeout)?;

        Ok(Self {
            src,
            tree,
            language,
        })
    }

    /// Produce a lexical scope-graph for this TreeSitterFile.
    pub fn scope_graph(self) -> Result<ScopeGraph, TreeSitterFileError> {
        let query = self
            .language
            .scope_query
            .query(self.language.grammar)
            .map_err(TreeSitterFileError::QueryError)?;
        let root_node = self.tree.root_node();

        Ok(ResolutionMethod::Generic.build_scope(query, root_node, self.src, self.language))
    }
}

pub fn try_build_stack_graph(
    src: &str,
    lang_id: &str,
    source_path: &Path,
) -> Result<StackGraph, TreeSitterFileError> {
    let language = match TSLanguage::from_id(lang_id) {
        Language::Supported(language) => Ok(language),
        Language::Unsupported => Err(TreeSitterFileError::UnsupportedLanguage),
    }?;

    let mut graph = StackGraph::new();
    let handle = graph.add_file(&source_path.to_string_lossy()).unwrap();

    let config = StackGraphConfig::from_tsg_str(
        tree_sitter_typescript::language_typescript(),
        Some(String::from("source")),
        None,
        vec![String::from("ts"), String::from("tsx")],
        include_str!("./intelligence/language/typescript/ruleset.tsg"),
        None,
        None,
        FileAnalyzers::new(),
        &NoCancellation,
    )
    .unwrap();
    let globals = Variables::new();
    config
        .sgl
        .build_stack_graph_into(&mut graph, handle, src, &globals, &NoCancellation);
    Ok(graph)
}
