pub use expect_test::expect;

use std::collections::HashSet;

use crate::intelligence::{scope_resolution::NodeKind, Language, TreeSitterFile};

use expect_test::Expect;

#[rustfmt::skip]
pub fn counts(src: &str, lang_id: &str) -> (usize, usize, usize, usize) {
    let tsf = TreeSitterFile::try_build(src.as_bytes(), lang_id).unwrap();
    let scope_graph = tsf.scope_graph().unwrap();
    let nodes = scope_graph.graph.node_weights();
    nodes.fold((0, 0, 0, 0), |(s, d, r, i), node| match node {
        NodeKind::Scope(_) => (s + 1, d,     r    , i    ),
        NodeKind::Def(_)   => (s,     d + 1, r    , i    ),
        NodeKind::Ref(_)   => (s,     d,     r + 1, i    ),
        NodeKind::Import(_)=> (s,     d,     r    , i + 1),
    })
}

pub fn assert_eq_defs(src: &[u8], lang_id: &str, defs: Vec<(&str, &str)>) {
    let language = match Language::from_id(lang_id) {
        Language::Supported(config) => config,
        _ => panic!("testing unsupported language"),
    };
    let namespaces = language.namespaces;

    let tsf = TreeSitterFile::try_build(src, lang_id).unwrap();
    let scope_graph = tsf.scope_graph().unwrap();

    let expected_defs: HashSet<_> = defs.into_iter().collect();
    let observed_defs: HashSet<(&str, &str)> = scope_graph
        .graph
        .node_weights()
        .filter_map(|node| match node {
            NodeKind::Def(def) if def.symbol_id.is_some() => {
                let name = std::str::from_utf8(def.name(src)).unwrap();
                let symbol = def.symbol_id.map(|sym_id| sym_id.name(namespaces)).unwrap();
                Some((name, symbol))
            }
            _ => None,
        })
        .collect();

    assert_eq!(expected_defs, observed_defs)
}

pub fn test_scopes(lang_id: &str, src: &[u8], expected: Expect) {
    let graph = build_graph(lang_id, src);
    let language = match Language::from_id(lang_id) {
        Language::Supported(config) => config,
        _ => panic!("testing unsupported language"),
    };
    let observed = graph.debug(src, language);
    expected.assert_debug_eq(&observed)
}

pub fn build_graph(lang_id: &str, src: &[u8]) -> crate::intelligence::ScopeGraph {
    let tsf = TreeSitterFile::try_build(src, lang_id).unwrap();
    tsf.scope_graph().unwrap()
}
