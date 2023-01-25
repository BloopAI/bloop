use std::fmt;

use super::{EdgeKind, LocalDef, NodeKind};
use crate::{intelligence::TSLanguageConfig, text_range::TextRange};

use petgraph::{
    graph::{Graph, NodeIndex},
    visit::EdgeRef,
    Direction,
};

pub struct ScopeDebug {
    range: TextRange,
    defs: Vec<DefDebug>,
    scopes: Vec<ScopeDebug>,
    language: &'static TSLanguageConfig,
}

struct DefDebug {
    name: String,
    range: TextRange,
    context: String,
    refs: Vec<RefDebug>,
    symbol: String,
}

struct RefDebug {
    context: String,
}

impl DefDebug {
    fn new(
        range: TextRange,
        name: String,
        refs: Vec<TextRange>,
        symbol: String,
        src: &[u8],
    ) -> Self {
        Self {
            name,
            range,
            context: context(range, src),
            refs: refs
                .into_iter()
                .map(|r| context(r, src))
                .map(|context| RefDebug { context })
                .collect(),
            symbol,
        }
    }
}

impl ScopeDebug {
    fn empty(range: TextRange, language: &'static TSLanguageConfig) -> Self {
        Self {
            range,
            defs: Vec::new(),
            scopes: Vec::new(),
            language,
        }
    }

    fn build(&mut self, graph: &Graph<NodeKind, EdgeKind>, start: NodeIndex<u32>, src: &[u8]) {
        let mut defs = graph
            .edges_directed(start, Direction::Incoming)
            .filter(|edge| *edge.weight() == EdgeKind::DefToScope)
            .map(|edge| {
                let def_node = edge.source();

                // range of this def
                let range = graph[def_node].range();

                // text source of this def
                let text = std::str::from_utf8(&src[range.start.byte..range.end.byte])
                    .unwrap()
                    .to_owned();

                // all references of this def, sorted by range
                let mut refs = graph
                    .edges_directed(def_node, Direction::Incoming)
                    .filter(|edge| *edge.weight() == EdgeKind::RefToDef)
                    .map(|edge| graph[edge.source()].range())
                    .collect::<Vec<_>>();

                refs.sort();

                // symbol, if any
                let symbol = match &graph[def_node] {
                    NodeKind::Def(LocalDef {
                        symbol_id: Some(symbol_id),
                        ..
                    }) => symbol_id.name(self.language.namespaces).to_string(),
                    _ => "none".to_string(),
                };

                DefDebug::new(range, text, refs, symbol, src)
            })
            .collect::<Vec<_>>();

        // sort defs by their ranges
        defs.sort_by(|a, b| a.range.cmp(&b.range));

        let mut scopes = graph
            .edges_directed(start, Direction::Incoming)
            .filter(|edge| *edge.weight() == EdgeKind::ScopeToScope)
            .map(|edge| {
                let source_scope = edge.source();
                let mut scope_debug = ScopeDebug::empty(graph[source_scope].range(), self.language);
                scope_debug.build(graph, source_scope, src);
                scope_debug
            })
            .collect::<Vec<_>>();

        scopes.sort_by(|a, b| a.range.cmp(&b.range));

        self.defs = defs;
        self.scopes = scopes;
    }

    pub fn new(
        graph: &Graph<NodeKind, EdgeKind>,
        start: NodeIndex<u32>,
        src: &[u8],
        lang_config: &'static TSLanguageConfig,
    ) -> Self {
        let mut scope_debug = Self::empty(graph[start].range(), lang_config);
        scope_debug.build(graph, start, src);
        scope_debug
    }
}

impl fmt::Debug for ScopeDebug {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("scope")
            .field("definitions", &self.defs)
            .field("child scopes", &self.scopes)
            .finish()
    }
}

impl fmt::Debug for DefDebug {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut s = f.debug_struct(&self.name);
        let d = s
            .field("kind", &self.symbol)
            .field("context", &self.context);

        if self.refs.is_empty() {
            d
        } else {
            d.field(&format!("referenced in ({})", self.refs.len()), &self.refs)
        }
        .finish()
    }
}

impl fmt::Debug for RefDebug {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "`{}`", self.context)
    }
}

fn context(range: TextRange, src: &[u8]) -> String {
    // first new line before start
    let context_start = src
        .iter()
        .enumerate()
        .take(range.start.byte)
        .rev()
        .find_map(|(idx, &c)| (c == b'\n').then_some(idx))
        .unwrap_or(range.start.byte - 1)
        .saturating_add(1);

    // first new line after end
    let context_end: usize = src
        .iter()
        .enumerate()
        .skip(range.end.byte)
        .find_map(|(idx, &c)| (c == b'\n').then_some(idx))
        .unwrap_or(range.end.byte + 1)
        .saturating_sub(1);

    let from_utf8 = |bytes| std::str::from_utf8(bytes).unwrap();
    format!(
        "{}§{}§{}",
        from_utf8(&src[context_start..range.start.byte]).trim_start(),
        from_utf8(&src[range.start.byte..range.end.byte]),
        from_utf8(&src[range.end.byte..=context_end]).trim_end()
    )
}
