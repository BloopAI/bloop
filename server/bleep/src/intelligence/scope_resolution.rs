#[cfg(test)]
mod debug;
mod def;
mod import;
mod reference;
mod scope;

pub use def::LocalDef;
pub use import::LocalImport;
pub use reference::Reference;
pub use scope::{LocalScope, ScopeStack};

use super::{NameSpaceMethods, TSLanguageConfig, ALL_LANGUAGES};
use crate::{symbol::Symbol, text_range::TextRange};

use std::{collections::HashMap, str::FromStr};

use petgraph::{graph::Graph, visit::EdgeRef, Direction};
use serde::{Deserialize, Serialize};
use tracing::warn;
use tree_sitter::{Node, Query, QueryCursor};

pub type NodeIndex = petgraph::graph::NodeIndex<u32>;

/// The algorithm used to resolve scopes.
///
/// The resolution method may be parametrized on language.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
#[non_exhaustive]
pub enum ResolutionMethod {
    /// `Generic` refers to a basic lexical scoping algorithm.
    Generic,
}

impl ResolutionMethod {
    /// Build a lexical scope-graph with a scope query and a tree-sitter tree. The `src`
    /// parameter is required by tree-sitter to resolve certain kinds of query predicates
    /// such as #match? and #eq?.
    pub fn build_scope(
        &self,
        query: &Query,
        root_node: Node<'_>,
        src: &[u8],
        language: &TSLanguageConfig,
    ) -> ScopeGraph {
        match self {
            ResolutionMethod::Generic => scope_res_generic(query, root_node, src, language),
        }
    }
}

/// The type of a node in the ScopeGraph
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum NodeKind {
    /// A scope node
    Scope(LocalScope),

    /// A definition node
    Def(LocalDef),

    /// An import node
    Import(LocalImport),

    /// A reference node
    Ref(Reference),
}

impl NodeKind {
    /// Construct a scope node from a range
    pub fn scope(range: TextRange) -> Self {
        Self::Scope(LocalScope::new(range))
    }

    /// Produce the range spanned by this node
    pub fn range(&self) -> TextRange {
        match self {
            Self::Scope(l) => l.range,
            Self::Def(d) => d.range,
            Self::Ref(r) => r.range,
            Self::Import(i) => i.range,
        }
    }
}

/// Describes the relation between two nodes in the ScopeGraph
#[derive(Serialize, Deserialize, PartialEq, Eq, Copy, Clone, Debug)]
pub enum EdgeKind {
    /// The edge weight from a nested scope to its parent scope
    ScopeToScope,

    /// The edge weight from a definition to its definition scope
    DefToScope,

    /// The edge weight from an import to its definition scope
    ImportToScope,

    /// The edge weight from a reference to its definition
    RefToDef,

    /// The edge weight from a reference to its import
    RefToImport,
}

/// A graph representation of scopes and names in a single syntax tree
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScopeGraph {
    /// The raw graph
    pub graph: Graph<NodeKind, EdgeKind>,

    // Graphs do not have the concept of a `root`, but lexical scopes follow the syntax
    // tree, and as a result, have a "root" node. The root_idx points to a scope node that
    // encompasses the entire file: the global scope.
    root_idx: NodeIndex,

    /// An index into ALL_LANGUAGES which corresponds to the language for this graph
    lang_id: usize,
}

impl ScopeGraph {
    pub fn new(range: TextRange, lang_id: usize) -> Self {
        let mut graph = Graph::new();
        let root_idx = graph.add_node(NodeKind::scope(range));
        Self {
            graph,
            root_idx,
            lang_id,
        }
    }

    pub fn get_node(&self, node_idx: NodeIndex) -> Option<&NodeKind> {
        self.graph.node_weight(node_idx)
    }

    /// Insert a local scope into the scope-graph
    pub fn insert_local_scope(&mut self, new: LocalScope) {
        if let Some(parent_scope) = self.scope_by_range(new.range, self.root_idx) {
            let new_scope = NodeKind::Scope(new);
            let new_idx = self.graph.add_node(new_scope);
            self.graph
                .add_edge(new_idx, parent_scope, EdgeKind::ScopeToScope);
        }
    }

    /// Insert a def into the scope-graph
    pub fn insert_local_def(&mut self, new: LocalDef) {
        if let Some(defining_scope) = self.scope_by_range(new.range, self.root_idx) {
            let new_def = NodeKind::Def(new);
            let new_idx = self.graph.add_node(new_def);
            self.graph
                .add_edge(new_idx, defining_scope, EdgeKind::DefToScope);
        }
    }

    /// Insert a def into the scope-graph, at the parent scope of the defining scope
    pub fn insert_hoisted_def(&mut self, new: LocalDef) {
        if let Some(defining_scope) = self.scope_by_range(new.range, self.root_idx) {
            let new_def = NodeKind::Def(new);
            let new_idx = self.graph.add_node(new_def);

            // if the parent scope exists, insert this def there, if not,
            // insert into the defining scope
            let target_scope = self.parent_scope(defining_scope).unwrap_or(defining_scope);

            self.graph
                .add_edge(new_idx, target_scope, EdgeKind::DefToScope);
        }
    }

    /// Insert a def into the scope-graph, at the root scope
    pub fn insert_global_def(&mut self, new: LocalDef) {
        let new_def = NodeKind::Def(new);
        let new_idx = self.graph.add_node(new_def);
        self.graph
            .add_edge(new_idx, self.root_idx, EdgeKind::DefToScope);
    }

    /// Insert an import into the scope-graph
    pub fn insert_local_import(&mut self, new: LocalImport) {
        if let Some(defining_scope) = self.scope_by_range(new.range, self.root_idx) {
            let new_imp = NodeKind::Import(new);
            let new_idx = self.graph.add_node(new_imp);
            self.graph
                .add_edge(new_idx, defining_scope, EdgeKind::ImportToScope);
        }
    }

    /// Insert a ref into the scope-graph
    pub fn insert_ref(&mut self, new: Reference, src: &[u8]) {
        let mut possible_defs = vec![];
        let mut possible_imports = vec![];
        if let Some(local_scope_idx) = self.scope_by_range(new.range, self.root_idx) {
            // traverse the scopes from the current-scope to the root-scope
            for scope in self.scope_stack(local_scope_idx) {
                // find candidate definitions in each scope
                for local_def in self
                    .graph
                    .edges_directed(scope, Direction::Incoming)
                    .filter(|edge| *edge.weight() == EdgeKind::DefToScope)
                    .map(|edge| edge.source())
                {
                    if let NodeKind::Def(def) = &self.graph[local_def] {
                        if new.name(src) == def.name(src) {
                            match (&def.symbol_id, &new.symbol_id) {
                                // both contain symbols, but they don't belong to the same namepspace
                                (Some(d), Some(r)) if d.namespace_idx != r.namespace_idx => {}

                                // in all other cases, form an edge from the ref to def.
                                // an empty symbol belongs to all namespaces:
                                // * (None, None)
                                // * (None, Some(_))
                                // * (Some(_), None)
                                // * (Some(_), Some(_)) if def.namespace == ref.namespace
                                _ => {
                                    possible_defs.push(local_def);
                                }
                            };
                        }
                    }
                }

                // find candidate imports in each scope
                for local_import in self
                    .graph
                    .edges_directed(scope, Direction::Incoming)
                    .filter(|edge| *edge.weight() == EdgeKind::ImportToScope)
                    .map(|edge| edge.source())
                {
                    if let NodeKind::Import(import) = &self.graph[local_import] {
                        if new.name(src) == import.name(src) {
                            possible_imports.push(local_import);
                        }
                    }
                }
            }
        }

        if !possible_defs.is_empty() || !possible_imports.is_empty() {
            let new_ref = NodeKind::Ref(new);
            let ref_idx = self.graph.add_node(new_ref);
            for def_idx in possible_defs {
                self.graph.add_edge(ref_idx, def_idx, EdgeKind::RefToDef);
            }
            for imp_idx in possible_imports {
                self.graph.add_edge(ref_idx, imp_idx, EdgeKind::RefToImport);
            }
        }
    }

    fn scope_stack(&self, start: NodeIndex) -> ScopeStack<'_> {
        ScopeStack {
            scope_graph: self,
            start: Some(start),
        }
    }

    // The smallest scope that encompasses `range`. Start at `start` and narrow down if possible.
    fn scope_by_range(&self, range: TextRange, start: NodeIndex) -> Option<NodeIndex> {
        let target_range = self.graph[start].range();
        if target_range.contains(&range) {
            let child_scopes = self
                .graph
                .edges_directed(start, Direction::Incoming)
                .filter(|edge| *edge.weight() == EdgeKind::ScopeToScope)
                .map(|edge| edge.source())
                .collect::<Vec<_>>();
            for child_scope in child_scopes {
                if let Some(t) = self.scope_by_range(range, child_scope) {
                    return Some(t);
                }
            }
            return Some(start);
        }
        None
    }

    // Produce the parent scope of a given scope
    fn parent_scope(&self, start: NodeIndex) -> Option<NodeIndex> {
        if matches!(self.graph[start], NodeKind::Scope(_)) {
            return self
                .graph
                .edges_directed(start, Direction::Outgoing)
                .filter(|edge| *edge.weight() == EdgeKind::ScopeToScope)
                .map(|edge| edge.target())
                .next();
        }
        None
    }

    /// Produce a list of interesting ranges: ranges of defs and refs
    pub fn hoverable_ranges(&self) -> Box<dyn Iterator<Item = TextRange> + '_> {
        let iterator =
            self.graph
                .node_indices()
                .filter_map(|node_idx| match &self.graph[node_idx] {
                    NodeKind::Scope(_) => None,
                    NodeKind::Def(d) => Some(d.range),
                    NodeKind::Ref(r) => Some(r.range),
                    NodeKind::Import(i) => Some(i.range),
                });
        Box::new(iterator)
    }

    /// Produce possible definitions for a reference
    pub fn definitions(
        &self,
        reference_node: NodeIndex,
    ) -> Box<dyn Iterator<Item = NodeIndex> + '_> {
        let iterator = self
            .graph
            .edges_directed(reference_node, Direction::Outgoing)
            .filter(|edge| *edge.weight() == EdgeKind::RefToDef)
            .map(|edge| edge.target());
        Box::new(iterator)
    }

    /// Produce possible imports for a reference
    pub fn imports(&self, reference_node: NodeIndex) -> Box<dyn Iterator<Item = NodeIndex> + '_> {
        let iterator = self
            .graph
            .edges_directed(reference_node, Direction::Outgoing)
            .filter(|edge| *edge.weight() == EdgeKind::RefToImport)
            .map(|edge| edge.target());
        Box::new(iterator)
    }

    /// Produce possible references for a definition/import node
    pub fn references(
        &self,
        definition_node: NodeIndex,
    ) -> Box<dyn Iterator<Item = NodeIndex> + '_> {
        let iterator = self
            .graph
            .edges_directed(definition_node, Direction::Incoming)
            .filter(|edge| {
                *edge.weight() == EdgeKind::RefToDef || *edge.weight() == EdgeKind::RefToImport
            })
            .map(|edge| edge.source());
        Box::new(iterator)
    }

    pub fn node_by_range(&self, start_byte: usize, end_byte: usize) -> Option<NodeIndex> {
        self.graph
            .node_indices()
            .filter(|&idx| self.is_definition(idx) || self.is_reference(idx) || self.is_import(idx))
            .find(|&idx| {
                let node = self.graph[idx].range();
                start_byte >= node.start.byte && end_byte <= node.end.byte
            })
    }

    /// The "value" of a definition is loosely characterized as
    ///
    /// - the body of a function block
    /// - the body of a class
    /// - the parameters list defining generic types
    /// - the RHS of a value
    ///
    /// The heuristic used here is
    ///  - the smallest scope-node that encompasses the definition_node
    ///  - or the largest scope-node on the same line as the to the definition_node
    pub fn value_of_definition(&self, def_idx: NodeIndex) -> Option<NodeIndex> {
        let smallest_scope_node = self
            .scope_by_range(self.graph[def_idx].range(), self.root_idx)
            .filter(|&idx| {
                self.graph[idx].range().start.line == self.graph[def_idx].range().start.line
            });
        let largest_adjacent_node = self
            .graph
            .node_indices()
            .filter(|&idx| match self.graph[idx] {
                NodeKind::Scope(scope) => {
                    scope.range.start.line == self.graph[def_idx].range().start.line
                }
                _ => false,
            })
            .max_by_key(|idx| self.graph[*idx].range().size());

        smallest_scope_node.or(largest_adjacent_node)
    }

    pub fn node_by_position(&self, line: usize, column: usize) -> Option<NodeIndex> {
        self.graph
            .node_indices()
            .filter(|&idx| self.is_definition(idx) || self.is_reference(idx))
            .find(|&idx| {
                let node = self.graph[idx].range();
                node.start.line == line
                    && node.end.line == line
                    && node.start.column <= column
                    && node.end.column >= column
            })
    }

    pub fn symbols(&self) -> Vec<Symbol> {
        let namespaces = ALL_LANGUAGES[self.lang_id].namespaces;
        self.graph
            .node_weights()
            .filter_map(|weight| match weight {
                NodeKind::Def(LocalDef {
                    range,
                    symbol_id: Some(symbol_id),
                    ..
                }) => Some(Symbol {
                    kind: symbol_id.name(namespaces).to_owned(), // FIXME: this should use SymbolId::name
                    range: *range,
                }),
                _ => None,
            })
            .collect()
    }

    // produce a stringified name of a def/ref's symbol
    pub fn symbol_name_of(&self, idx: NodeIndex) -> Option<&'static str> {
        let namespaces = ALL_LANGUAGES[self.lang_id].namespaces;
        match &self.graph[idx] {
            NodeKind::Def(d) => d.symbol_id.map(|s| s.name(namespaces)),
            NodeKind::Ref(r) => r.symbol_id.map(|s| s.name(namespaces)),
            _ => None,
        }
    }

    // is the given ref/def a direct child of the root scope
    pub fn is_top_level(&self, idx: NodeIndex) -> bool {
        self.graph.contains_edge(idx, self.root_idx)
    }

    #[cfg(test)]
    pub fn debug(&self, src: &[u8], language: &'static TSLanguageConfig) -> debug::ScopeDebug {
        let graph = &self.graph;
        let start = self.root_idx;
        debug::ScopeDebug::new(graph, start, src, language)
    }

    #[cfg(test)]
    pub fn find_node_by_name(&self, src: &[u8], name: &[u8]) -> Option<NodeIndex> {
        self.graph.node_indices().find(|idx| {
            matches!(
                    &self.graph[*idx],
                    NodeKind::Def(d) if d.name(src) == name)
        })
    }

    pub fn is_definition(&self, node_idx: NodeIndex) -> bool {
        matches!(self.graph[node_idx], NodeKind::Def(_))
    }

    pub fn is_reference(&self, node_idx: NodeIndex) -> bool {
        matches!(self.graph[node_idx], NodeKind::Ref(_))
    }

    pub fn is_scope(&self, node_idx: NodeIndex) -> bool {
        matches!(self.graph[node_idx], NodeKind::Scope(_))
    }

    pub fn is_import(&self, node_idx: NodeIndex) -> bool {
        matches!(self.graph[node_idx], NodeKind::Import(_))
    }
}

fn scope_res_generic(
    query: &Query,
    root_node: Node<'_>,
    src: &[u8],
    language: &TSLanguageConfig,
) -> ScopeGraph {
    let namespaces = language.namespaces;

    enum Scoping {
        Global,
        Hoisted,
        Local,
    }

    // extract supported capture groups
    struct LocalDefCapture<'a> {
        index: u32,
        symbol: Option<&'a str>,
        scoping: Scoping,
    }

    struct LocalRefCapture<'a> {
        index: u32,
        symbol: Option<&'a str>,
    }

    impl FromStr for Scoping {
        type Err = String;
        fn from_str(s: &str) -> Result<Self, Self::Err> {
            match s {
                "hoist" => Ok(Self::Hoisted),
                "global" => Ok(Self::Global),
                "local" => Ok(Self::Local),
                s => Err(s.to_owned()),
            }
        }
    }

    // every capture of the form:
    //  - local.definition.<symbol>
    //  - hoist.definition.<symbol>
    // is a local_def
    let mut local_def_captures = Vec::<LocalDefCapture<'_>>::new();

    // every capture of the form local.import is a local_import
    let mut local_import_capture_index = None;

    // every capture of the form local.reference.<symbol> is a local_ref
    let mut local_ref_captures = Vec::<LocalRefCapture<'_>>::new();

    // every capture of the form local.scope is a local_scope
    let mut local_scope_capture_index = None;

    // determine indices of every capture group in the query file
    for (i, name) in query.capture_names().iter().enumerate() {
        let i = i as u32;
        let parts: Vec<_> = name.split('.').collect();

        match parts.as_slice() {
            [scoping, "definition", sym] => {
                let index = i;
                let symbol = Some(sym.to_owned());
                let scoping = Scoping::from_str(scoping).expect("invalid scope keyword");

                let l = LocalDefCapture {
                    index,
                    symbol,
                    scoping,
                };
                local_def_captures.push(l)
            }
            [scoping, "definition"] => {
                let index = i;
                let symbol = None;
                let scoping = Scoping::from_str(scoping).expect("invalid scope keyword");

                let l = LocalDefCapture {
                    index,
                    symbol,
                    scoping,
                };
                local_def_captures.push(l)
            }
            ["local", "reference", sym] => {
                let index = i;
                let symbol = Some(sym.to_owned());

                let l = LocalRefCapture { index, symbol };
                local_ref_captures.push(l);
            }
            ["local", "reference"] => {
                let index = i;
                let symbol = None;

                let l = LocalRefCapture { index, symbol };
                local_ref_captures.push(l);
            }
            ["local", "scope"] => local_scope_capture_index = Some(i),
            ["local", "import"] => local_import_capture_index = Some(i),
            _ if !name.starts_with('_') => warn!(?name, "unrecognized query capture"),
            _ => (), // allow captures that start with underscore to fly under the radar
        }
    }

    // run scope-query upon the syntax-tree
    let mut cursor = QueryCursor::new();
    let captures = cursor.captures(query, root_node, src);

    let lang_id = ALL_LANGUAGES
        .iter()
        .position(|l| l.language_ids == language.language_ids)
        .unwrap();
    let mut scope_graph = ScopeGraph::new(root_node.range().into(), lang_id);

    let capture_map = captures.fold(
        HashMap::<_, Vec<_>>::new(),
        |mut map, (match_, capture_idx)| {
            let capture = match_.captures[capture_idx];
            let range: TextRange = capture.node.range().into();
            map.entry(capture.index).or_default().push(range);
            map
        },
    );

    // insert scopes first
    if let Some(ranges) = local_scope_capture_index.and_then(|idx| capture_map.get(&idx)) {
        for range in ranges {
            let scope = LocalScope::new(*range);
            scope_graph.insert_local_scope(scope);
        }
    }

    // followed by imports
    if let Some(ranges) = local_import_capture_index.and_then(|idx| capture_map.get(&idx)) {
        for range in ranges {
            let import = LocalImport::new(*range);
            scope_graph.insert_local_import(import);
        }
    }

    // followed by defs
    for LocalDefCapture {
        index,
        symbol,
        scoping,
    } in local_def_captures
    {
        if let Some(ranges) = capture_map.get(&index) {
            for range in ranges {
                // if the symbol is present, is it one of the supported symbols for this language?
                let symbol_id = symbol.and_then(|s| namespaces.symbol_id_of(s));
                let local_def = LocalDef::new(*range, symbol_id);

                match scoping {
                    Scoping::Hoisted => scope_graph.insert_hoisted_def(local_def),
                    Scoping::Global => scope_graph.insert_global_def(local_def),
                    Scoping::Local => scope_graph.insert_local_def(local_def),
                };
            }
        }
    }

    // and then refs
    for LocalRefCapture { index, symbol } in local_ref_captures {
        if let Some(ranges) = capture_map.get(&index) {
            for range in ranges {
                // if the symbol is present, is it one of the supported symbols for this language?
                let symbol_id = symbol.and_then(|s| namespaces.symbol_id_of(s));
                let ref_ = Reference::new(*range, symbol_id);

                scope_graph.insert_ref(ref_, src);
            }
        }
    }

    scope_graph
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        intelligence::SymbolId,
        text_range::{Point, TextRange},
    };
    use expect_test::expect;

    const DUMMY_LANG_ID: usize = 0;

    // test-utility to build byte-only text-ranges
    //
    // assumes one byte per line
    fn r(start: usize, end: usize) -> TextRange {
        TextRange {
            start: Point {
                byte: start,
                line: start,
                column: 0,
            },
            end: Point {
                byte: end,
                line: end,
                column: 0,
            },
        }
    }

    // test-utility to create a local scope
    fn scope(start: usize, end: usize) -> LocalScope {
        LocalScope {
            range: r(start, end),
        }
    }

    // test-utility to create a local def
    fn definition(start: usize, end: usize) -> LocalDef {
        LocalDef {
            range: r(start, end),
            symbol_id: None,
        }
    }

    // test-utility to create a reference
    fn reference(start: usize, end: usize) -> Reference {
        Reference {
            range: r(start, end),
            symbol_id: None,
        }
    }

    // test-utility to build a stringified edge-list from a graph
    fn test_edges(graph: &Graph<NodeKind, EdgeKind>, expected: expect_test::Expect) {
        let edge_list = graph
            .edge_references()
            .map(|edge| {
                let source = graph[edge.source()].range();
                let target = graph[edge.target()].range();
                let weight = edge.weight();
                format!(
                    "{:02}..{:02} --{weight:?}-> {:02}..{:02}\n",
                    source.start.byte, source.end.byte, target.start.byte, target.end.byte,
                )
            })
            .collect::<String>();

        expected.assert_eq(&edge_list)
    }

    #[test]
    fn insert_scopes() {
        let mut s = ScopeGraph::new(r(0, 20), DUMMY_LANG_ID);

        let a = scope(0, 10);
        let c = scope(0, 5);
        let d = scope(6, 10);

        let b = scope(11, 20);
        let e = scope(11, 15);
        let f = scope(16, 20);

        for scope in [a, b, c, d, e, f] {
            s.insert_local_scope(scope);
        }

        // should build:
        //
        //     root
        //       `- a
        //          `- c
        //          `- d
        //       `- b
        //          `- e
        //          `- f
        //
        // |n| = 7
        // |e| = 6

        assert_eq!(s.graph.node_count(), 7);
        assert_eq!(s.graph.edge_count(), 6);

        // a -> root
        // b -> root
        // c -> a
        // d -> a
        // e -> b
        // f -> b
        test_edges(
            &s.graph,
            expect![[r#"
                00..10 --ScopeToScope-> 00..20
                11..20 --ScopeToScope-> 00..20
                00..05 --ScopeToScope-> 00..10
                06..10 --ScopeToScope-> 00..10
                11..15 --ScopeToScope-> 11..20
                16..20 --ScopeToScope-> 11..20
            "#]],
        );
    }

    #[test]
    fn insert_defs() {
        let mut s = ScopeGraph::new(r(0, 20), DUMMY_LANG_ID);

        // modeling the following code:
        //
        //     fn main() {
        //        let a = 2;
        //        let b = 3;
        //     }

        let main = scope(0, 10);
        let a = definition(1, 2);
        let b = definition(4, 5);

        s.insert_local_scope(main);
        s.insert_local_def(a);
        s.insert_local_def(b);

        // should build:
        //
        //     root
        //       `- main
        //           `- a
        //           `- b

        test_edges(
            &s.graph,
            expect![[r#"
                00..10 --ScopeToScope-> 00..20
                01..02 --DefToScope-> 00..10
                04..05 --DefToScope-> 00..10
            "#]],
        );
    }

    #[test]
    fn insert_hoisted_defs() {
        let mut s = ScopeGraph::new(r(0, 20), DUMMY_LANG_ID);

        let main = scope(0, 10);
        let a = definition(1, 2);
        let b = definition(4, 5);

        s.insert_local_scope(main);
        s.insert_local_def(a);
        // should hoist `b` from `main` to `root`
        s.insert_hoisted_def(b);

        // should build:
        //
        //     root
        //       `- b
        //       `- main
        //           `- a

        // root has 2 incoming edges:
        // main -> root
        // b -> root
        assert_eq!(
            s.graph
                .edges_directed(s.root_idx, Direction::Incoming)
                .count(),
            2
        );

        test_edges(
            &s.graph,
            expect![[r#"
                00..10 --ScopeToScope-> 00..20
                01..02 --DefToScope-> 00..10
                04..05 --DefToScope-> 00..20
            "#]],
        );
    }

    #[test]
    fn insert_hoisted_no_parent() {
        let mut s = ScopeGraph::new(r(0, 20), DUMMY_LANG_ID);

        let a = definition(1, 2);

        s.insert_hoisted_def(a);

        // should build:
        //
        //     root
        //       `- a
        //
        // `a` cannot be hoisted beyond `root`

        test_edges(
            &s.graph,
            expect![[r#"
                01..02 --DefToScope-> 00..20
            "#]],
        );
    }

    #[test]
    fn insert_ref() {
        let mut s = ScopeGraph::new(r(0, 20), DUMMY_LANG_ID);

        let foo = definition(0, 3);
        let foo_ref = reference(5, 8);

        let src = r"foo\nfoo".as_bytes();

        s.insert_local_def(foo);
        s.insert_ref(foo_ref, src);

        // should build
        //
        //     root
        //       `- foo <- foo_ref

        test_edges(
            &s.graph,
            expect![[r#"
            00..03 --DefToScope-> 00..20
            05..08 --RefToDef-> 00..03
        "#]],
        )
    }

    #[test]
    fn insert_ref_namespaced() {
        let mut s = ScopeGraph::new(r(0, 50), DUMMY_LANG_ID);

        // we assume the following namespaces:
        // - 0: [ 0: function, 1: method, 2: getter ]
        // - 1: [ 0: var       1: const,  2: static ]
        //
        // defs from namespace 0 should be unreachable from
        // refs from namespace 1 and vice-versa

        // create two defs:
        // - fn foo
        // - var foo
        //
        // every function call is annotated with the `function` symbol
        // every variable ref  is annotated with the `var`      symbol
        // every const ref     is annotated with the `const`    symbol
        let src = r#"fn foo() {};
var foo;
foo();
foo + 1;
[0; foo]"#
            .as_bytes();

        // function ∈ {namespace=0, symbol=0}
        let foo_func_def = {
            let mut d = definition(3, 6);
            d.symbol_id = Some(SymbolId {
                namespace_idx: 0,
                symbol_idx: 0,
            });
            d
        };

        // var ∈ {namespace=1, symbol=0}
        let foo_var_def = {
            let mut d = definition(17, 20);
            d.symbol_id = Some(SymbolId {
                namespace_idx: 1,
                symbol_idx: 0,
            });
            d
        };

        // function ∈ {namespace=0, symbol=0}
        let foo_func_ref = {
            let mut r = reference(22, 25);
            r.symbol_id = Some(SymbolId {
                namespace_idx: 0,
                symbol_idx: 0,
            });
            r
        };

        // var ∈ {namespace=1, symbol=0}
        let foo_var_ref = {
            let mut r = reference(29, 32);
            r.symbol_id = Some(SymbolId {
                namespace_idx: 1,
                symbol_idx: 0,
            });
            r
        };

        // const ∈ {namespace=1, symbol=1}
        let foo_const_ref = {
            let mut r = reference(42, 45);
            r.symbol_id = Some(SymbolId {
                namespace_idx: 1,
                symbol_idx: 1,
            });
            r
        };

        s.insert_local_def(foo_func_def);
        s.insert_local_def(foo_var_def);
        s.insert_ref(foo_func_ref, src);
        s.insert_ref(foo_var_ref, src);
        s.insert_ref(foo_const_ref, src);

        // should build
        //
        //     root
        //       `- foo_func <- foo_func_ref
        //       `- foo_var <- foo_var_ref, foo_const_ref

        test_edges(
            &s.graph,
            expect![[r#"
                03..06 --DefToScope-> 00..50
                17..20 --DefToScope-> 00..50
                22..25 --RefToDef-> 03..06
                29..32 --RefToDef-> 17..20
                42..45 --RefToDef-> 17..20
            "#]],
        )
    }

    #[test]
    fn insert_ref_no_namespace() {
        let mut s = ScopeGraph::new(r(0, 50), DUMMY_LANG_ID);

        // modeling the following code:
        //
        //     fn foo() {}
        //     var foo;
        //
        //     foo + 1
        //
        // `foo` should refer to both, `fn foo` and `var foo`,
        // the lack of namespacing should raise both defs as
        // possible defs.
        //
        // once again, we assume the following namespaces:
        // - 0: [ 0: function, 1: method, 2: getter ]
        // - 1: [ 0: var       1: const,  2: static ]

        // function ∈ {namespace=0, symbol=0}
        let foo_func_def = {
            let mut d = definition(3, 6);
            d.symbol_id = Some(SymbolId {
                namespace_idx: 0,
                symbol_idx: 0,
            });
            d
        };

        // var ∈ {namespace=1, symbol=0}
        let foo_var_def = {
            let mut d = definition(17, 20);
            d.symbol_id = Some(SymbolId {
                namespace_idx: 1,
                symbol_idx: 0,
            });
            d
        };

        let foo_ambiguous_ref = reference(23, 26);

        let src = r#"fn foo() {};
var foo;

foo + 1"#
            .as_bytes();

        s.insert_local_def(foo_func_def);
        s.insert_local_def(foo_var_def);
        s.insert_ref(foo_ambiguous_ref, src);

        // should build;
        //
        //    root
        //      `- foo_func_def <- foo_ambiguous_ref
        //      `- foo_var_def  <- foo_ambiguous_ref

        test_edges(
            &s.graph,
            expect![[r#"
            03..06 --DefToScope-> 00..50
            17..20 --DefToScope-> 00..50
            23..26 --RefToDef-> 17..20
            23..26 --RefToDef-> 03..06
        "#]],
        )
    }

    #[test]
    fn hoverable_ranges() {
        let mut s = ScopeGraph::new(r(0, 50), DUMMY_LANG_ID);

        // modeling the following code:
        //
        //    let t = 2;
        //    t + 1;
        //
        // contains 1 def, 1 ref

        let src = "let t = 2;\nt + 1;".as_bytes();

        let t_def = definition(4, 5);
        let t_ref = reference(11, 12);

        s.insert_local_def(t_def);
        s.insert_ref(t_ref, src);

        let hoverable_ranges = s.hoverable_ranges().collect::<Vec<_>>();
        assert_eq!(hoverable_ranges, vec![r(4, 5), r(11, 12)])
    }
}
