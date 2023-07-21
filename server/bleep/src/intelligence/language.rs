mod c;
mod c_sharp;
mod cpp;
mod go;
mod java;
mod javascript;
mod php;
mod python;
mod r;
mod ruby;
mod rust;
mod typescript;

#[cfg(test)]
mod test_utils;

use once_cell::sync::OnceCell;
use tree_sitter_stack_graphs::{
    loader::{FileAnalyzers, LanguageConfiguration as StackGraphConfig, LoadError},
    NoCancellation,
};

use super::NameSpaces;

/// A collection of all language definitions
pub static ALL_LANGUAGES: &[&TSLanguageConfig] = &[
    &c::C,
    &go::GO,
    &javascript::JAVASCRIPT,
    &python::PYTHON,
    &rust::RUST,
    &typescript::TYPESCRIPT,
    &c_sharp::C_SHARP,
    &java::JAVA,
    &cpp::CPP,
    &ruby::RUBY,
    &r::R,
    &php::PHP,
];

/// A generic language wrapper type.
///
/// The backing grammars/parser are supplied through the `Config` type.
pub enum Language<Config: 'static> {
    /// A supported language, with some `Config`.
    Supported(&'static Config),

    /// An unsupported language
    Unsupported,
}

/// Languages based on tree-sitter grammars
#[derive(Debug)]
pub struct TSLanguageConfig {
    /// A list of language names that can be processed by these scope queries
    /// e.g.: ["Typescript", "TSX"], ["Rust"]
    pub language_ids: &'static [&'static str],

    /// Extensions that can help classify the file: .rs, .rb, .cabal
    pub file_extensions: &'static [&'static str],

    /// tree-sitter grammar for this language
    pub grammar: fn() -> tree_sitter::Language,

    /// Compiled tree-sitter scope query for this language.
    pub scope_query: MemoizedQuery,

    /// Compiled tree-sitter stack-graphs for this language.
    pub stack_graph_config: Option<MemoizedStackGraphConfig>,

    /// Compiled tree-sitter hoverables query
    pub hoverable_query: MemoizedQuery,

    /// Namespaces defined by this language,
    /// E.g.: type namespace, variable namespace, function namespace
    pub namespaces: NameSpaces,
}

#[derive(Debug)]
pub struct MemoizedQuery {
    slot: OnceCell<tree_sitter::Query>,
    scope_query: &'static str,
}

impl MemoizedQuery {
    pub const fn new(scope_query: &'static str) -> Self {
        Self {
            slot: OnceCell::new(),
            scope_query,
        }
    }

    /// Get a reference to the relevant tree sitter compiled query.
    ///
    /// This method compiles the query if it has not already been compiled.
    pub fn query(
        &self,
        grammar: fn() -> tree_sitter::Language,
    ) -> Result<&tree_sitter::Query, tree_sitter::QueryError> {
        self.slot
            .get_or_try_init(|| tree_sitter::Query::new(grammar(), self.scope_query))
    }
}

pub struct MemoizedStackGraphConfig {
    slot: OnceCell<StackGraphConfig>,
    ruleset: &'static str,
}

impl std::fmt::Debug for MemoizedStackGraphConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MemoizedStackGraphConfig").finish()
    }
}

impl MemoizedStackGraphConfig {
    pub const fn new(ruleset: &'static str) -> Self {
        Self {
            slot: OnceCell::new(),
            ruleset,
        }
    }

    // Get the underlying config
    pub fn stack_graph_config(
        &self,
        grammar: fn() -> tree_sitter::Language,
        file_extensions: &[&str],
    ) -> Result<&StackGraphConfig, LoadError> {
        self.slot.get_or_try_init(|| {
            StackGraphConfig::from_sources(
                grammar(),
                Some(String::from("source")),
                None,
                file_extensions
                    .iter()
                    .map(|t| t.to_string())
                    .collect::<Vec<_>>(),
                std::path::PathBuf::from("<empty>"), // this path is for diagnostics only, we don't need this
                self.ruleset,
                None,
                None,
                FileAnalyzers::new(),
                &NoCancellation,
            )
        })
    }
}

// StackGraphConfig::sgl is of type StackGraphLanguage [0] which contains some raw pointers
// deep down (maybe has to do with tree-sitter FFI), which makes it !Sync and !Send, workaround
// it for now with this, which seems to be safe-ish.
//
// [0]: https://docs.rs/tree-sitter-stack-graphs/latest/tree_sitter_stack_graphs/struct.StackGraphLanguage.html
unsafe impl Sync for MemoizedStackGraphConfig {}

pub type TSLanguage = Language<TSLanguageConfig>;

impl TSLanguage {
    /// Find a tree-sitter language configuration from a language identifier
    ///
    /// See [0] for a list of valid language identifiers.
    ///
    /// [0]: https://github.com/monkslc/hyperpolyglot/blob/master/src/codegen/languages.rs
    pub fn from_id(lang_id: &str) -> Self {
        ALL_LANGUAGES
            .iter()
            .copied()
            .find(|target| {
                target
                    .language_ids
                    .iter()
                    .any(|&id| id.to_lowercase() == lang_id.to_lowercase())
            })
            .map_or(Language::Unsupported, Language::Supported)
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::intelligence::NameSpaceMethods;

    use std::collections::HashSet;

    use tree_sitter::Query;

    // ensure that the symbols in all queries files are supported symbols
    #[test]
    fn verify_all_symbol_kinds() {
        let mut failed_languages = Vec::new();

        for language in ALL_LANGUAGES {
            let kinds = language.namespaces.all_symbols();
            if !has_valid_symbol_kinds(language.scope_query.query(language.grammar).unwrap(), kinds)
            {
                for id in language.language_ids {
                    failed_languages.push(*id);
                }
            }
        }

        if !failed_languages.is_empty() {
            panic!("invalid symbol kinds for {}", failed_languages.join(", "))
        }
    }

    fn has_valid_symbol_kinds(query: &Query, kinds: Vec<&str>) -> bool {
        let query_file_symbol_names = query
            .capture_names()
            .iter()
            .filter_map(|name| name.split('.').nth(2))
            .map(ToOwned::to_owned)
            .collect::<HashSet<_>>();

        let supported_symbol_kinds = kinds
            .iter()
            .map(ToString::to_string)
            .collect::<HashSet<_>>();

        query_file_symbol_names == supported_symbol_kinds
    }
}
