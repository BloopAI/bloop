use tree_sitter::{Node, Parser};

use crate::text_range::TextRange;

pub struct Section<'s> {
    pub data: &'s str,
    pub ancestry: Vec<&'s str>,
    pub header: Option<&'s str>,
    pub section_range: TextRange,
    pub node_range: TextRange,
}

impl<'a> Section<'a> {
    pub fn ancestry_str(&self) -> String {
        self.ancestry.join(" > ")
    }

    /// may not be idempotent
    pub fn ancestry_from_str(s: &str) -> Vec<&str> {
        s.split(" > ").filter(|h| !h.is_empty()).collect()
    }
}

// - collect non-section child-nodes for the current node
// - these form a single chunk to be embedded
// - repeat above on every section child-node
const MAX_DEPTH: usize = 1;
pub fn sectionize<'s, 'b>(
    start_node: &'b Node,
    sections: &'b mut Vec<Section<'s>>,
    mut ancestry: Vec<&'s str>,
    depth: usize,
    src: &'s str,
) {
    let mut cursor = start_node.walk();

    // discover section and non-section nodes among direct child nodes
    let (section_nodes, non_section_nodes): (Vec<_>, Vec<_>) = start_node
        .named_children(&mut cursor)
        .partition(|child| child.kind() == "section");

    // extract header of start_node
    let own_header = non_section_nodes
        .iter()
        .find(|child| child.kind() == "atx_heading")
        .map(|child| src[child.byte_range()].trim());

    // do not sectionize after h4
    if depth > MAX_DEPTH {
        sections.push(Section {
            data: &src[start_node.byte_range()],
            ancestry: ancestry.clone(),
            header: own_header,
            section_range: start_node.range().into(),
            node_range: start_node.range().into(),
        });
        return;
    }

    // collect ranges of all non-section nodes
    let own_section_range = non_section_nodes
        .into_iter()
        .map(|node| node.range())
        .reduce(cover);

    if let Some(r) = own_section_range {
        sections.push(Section {
            data: &src[r.start_byte..r.end_byte],
            ancestry: ancestry.clone(),
            section_range: r.into(),
            node_range: start_node.range().into(),
            header: own_header,
        });
    }

    // add current header to ancestry and recurse
    if let Some(h) = own_header {
        ancestry.push(h.trim());
    }

    for sub_section in section_nodes {
        sectionize(&sub_section, sections, ancestry.clone(), depth + 1, src);
    }
}

fn cover(a: tree_sitter::Range, b: tree_sitter::Range) -> tree_sitter::Range {
    let start_byte = a.start_byte.min(b.start_byte);
    let end_byte = a.end_byte.max(b.end_byte);
    let start_point = a.start_point.min(b.start_point);
    let end_point = a.end_point.max(b.end_point);

    tree_sitter::Range {
        start_byte,
        end_byte,
        start_point,
        end_point,
    }
}

pub fn by_section<'s>(src: &'s str) -> Vec<Section<'s>> {
    let mut parser = Parser::new();
    parser.set_language(tree_sitter_md::language()).unwrap();

    let tree = parser.parse(src.as_bytes(), None).unwrap();
    let root_node = tree.root_node();

    let mut sections = Vec::new();
    sectionize(&root_node, &mut sections, vec![], 0, src);

    sections
}
