use anyhow::Result;
use regex::{Regex, RegexBuilder};
use serde::Serialize;
use smallvec::{smallvec, SmallVec};

use crate::{indexes, symbol::Symbol};
use std::ops::Range;

#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct SnippedFile {
    pub relative_path: String,
    pub repo_name: String,
    pub repo_ref: String,
    pub lang: Option<String>,
    pub snippets: Vec<Snippet>,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct Snippet {
    pub data: String,
    pub highlights: Vec<Range<usize>>,
    pub symbols: Vec<Symbol>,
    pub line_range: Range<usize>,
}

/// A marker indicating a subset of some source text, with a list of highlighted ranges.
///
/// This doesn't store the actual text data itself, just the position information for simplified
/// merging.
#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct Location {
    /// The subset's byte range in the original input string.
    pub byte_range: Range<usize>,

    /// The subset's line range in the original input string.
    pub line_range: Range<usize>,

    /// A set of byte ranges denoting highlighted text indices, on the subset string.
    pub highlights: SmallVec<[Range<usize>; 2]>,
}

impl Location {
    // This is not a real error type, it communicates that the argument was not consumed.
    #[allow(clippy::result_large_err)]
    fn join(&mut self, rhs: Self) -> Result<(), Self> {
        // Override empty snippets.
        if self.highlights.is_empty() {
            *self = rhs;
            return Ok(());
        }

        // Fail if the locations don't overlap.
        if self.line_range.end < rhs.line_range.start {
            return Err(rhs);
        }

        let offset = rhs.byte_range.start - self.byte_range.start;
        self.line_range.end = rhs.line_range.end;
        self.byte_range.end = rhs.byte_range.end;
        self.highlights
            .extend(rhs.highlights.into_iter().map(|mut h| {
                h.start += offset;
                h.end += offset;
                h
            }));

        Ok(())
    }

    /// Reify this `Location` into a `Snippet`, given the source string and symbols list.
    pub fn reify(self, s: &str, symbols: &[Symbol]) -> Snippet {
        Snippet {
            data: s[self.byte_range.clone()].to_owned(),
            line_range: self.line_range.clone(),
            highlights: self.highlights.into_vec(),
            symbols: symbols
                .iter()
                .filter(|s| {
                    s.range.start.line >= self.line_range.start
                        && s.range.end.line <= self.line_range.end
                })
                .cloned()
                .map(|mut sym| {
                    sym.range.start.byte -= self.byte_range.start;
                    sym.range.end.byte -= self.byte_range.start;
                    sym
                })
                .collect(),
        }
    }

    pub fn line_count(&self) -> usize {
        self.line_range.end - self.line_range.start
    }
}

impl SnippedFile {
    pub fn merge(mut self, rhs: Self) -> Self {
        self.snippets.extend(rhs.snippets);
        Self {
            snippets: self.snippets,
            ..rhs
        }
    }
}

#[derive(Copy, Clone, Debug)]
pub struct Snipper {
    pub context_before: usize,
    pub context_after: usize,
    pub find_symbols: bool,
    pub case_sensitive: bool,
}

impl Default for Snipper {
    fn default() -> Self {
        Self {
            context_before: 0,
            context_after: 0,
            find_symbols: false,
            case_sensitive: true,
        }
    }
}

impl Snipper {
    pub fn context(mut self, before: usize, after: usize) -> Self {
        self.context_before = before;
        self.context_after = after;
        self
    }

    pub fn find_symbols(mut self, find_symbols: bool) -> Self {
        self.find_symbols = find_symbols;
        self
    }

    pub fn case_sensitive(mut self, case_sensitive: bool) -> Self {
        self.case_sensitive = case_sensitive;
        self
    }

    pub fn all_for_doc(
        &self,
        regex: &str,
        doc: &indexes::reader::ContentDocument,
    ) -> Result<Option<SnippedFile>> {
        let query = RegexBuilder::new(regex)
            .multi_line(true)
            .case_insensitive(!self.case_sensitive)
            .build()?;

        let snippets = if self.find_symbols {
            // a symbol search should perform an intersection of
            // search results with the symbol list present in a document.
            //
            let mut symbols = doc.symbol_locations.list();
            let symbol_ranges = symbols
                .iter()
                .map(|sym| sym.range.into())
                .collect::<Vec<Range<usize>>>();

            // limit highlights to only symbols
            //
            // for a search query of `symbol:n` on this text:
            //
            //    const cool_beans = beans();
            //
            // only the `n` from `cool_beans` should be highlighted, if
            // `cool_beans` is the only symbol in the document:
            //
            //    const cool_beans = beans();
            //                  ^-- expected
            //
            //    const cool_beans = beans();
            //      ^           ^       ^-- incorrect
            //
            let highlights = query
                .find_iter(&doc.content)
                .map(|m| m.range())
                .filter(|hl_range| {
                    symbol_ranges.iter().any(|sym_range| {
                        hl_range.start >= sym_range.start && hl_range.end <= sym_range.end
                    })
                })
                .collect::<Vec<Range<usize>>>();

            // limit symbols to only those in our highlight list
            //
            // for a search query of `symbol:loud` on this text:
            //
            //    const (loud, clear) = audio();
            //
            // the symbols returned should be just `loud`, even though `clear`
            // is also a symbol present in the same snippet.
            symbols.retain(|sym_range| {
                highlights.iter().any(|hl_range| {
                    hl_range.start >= sym_range.range.start.byte
                        && hl_range.end <= sym_range.range.end.byte
                })
            });

            self.expand_many(highlights.into_iter(), &doc.content, &doc.line_end_indices)
                .map(|loc| loc.reify(&doc.content, &symbols))
                .collect::<Vec<_>>()
        } else {
            let highlights = query.find_iter(&doc.content).map(|m| m.range());
            self.expand_many(highlights.into_iter(), &doc.content, &doc.line_end_indices)
                .map(|loc| loc.reify(&doc.content, &[]))
                .collect::<Vec<_>>()
        };

        Ok(if snippets.is_empty() {
            None
        } else {
            Some(SnippedFile {
                relative_path: doc.relative_path.clone(),
                repo_name: doc.repo_name.clone(),
                repo_ref: doc.repo_ref.clone(),
                lang: doc.lang.clone(),
                snippets,
            })
        })
    }

    fn expand_many<'a>(
        &'a self,
        mut highlights: impl Iterator<Item = Range<usize>> + 'a,
        text: &'a str,
        line_ends: &'a [u32],
    ) -> impl Iterator<Item = Location> + 'a {
        // We store the "next" location here, in case we run into an early split down below due to 2
        // locations not joining together.
        let mut next = None;
        std::iter::from_fn(move || {
            let mut loc = next.take().unwrap_or(Location {
                byte_range: 0..0,
                line_range: 0..0,
                highlights: SmallVec::new(),
            });

            for highlight in &mut highlights {
                let next_loc = self.expand(highlight, text, line_ends);
                if let Err(next_loc) = loc.join(next_loc) {
                    next = Some(next_loc);
                    break;
                }
            }

            if !loc.highlights.is_empty() {
                Some(loc)
            } else {
                None
            }
        })
    }

    pub fn expand<'a>(
        &'a self,
        highlight: Range<usize>,
        text: &'a str,
        line_ends: &'a [u32],
    ) -> Location {
        let start = text[..highlight.start]
            .rmatch_indices('\n')
            .nth(self.context_before)
            .map(|(i, _)| i + 1)
            .unwrap_or(0);

        let end = text[highlight.end..]
            .match_indices('\n')
            .nth(self.context_after)
            .map(|(i, _)| i + highlight.end)
            .unwrap_or(text.len());

        let line_end = line_ends
            .iter()
            .position(|i| end <= *i as usize)
            .unwrap_or(line_ends.len());

        let line_start = line_ends
            .iter()
            .rev()
            .position(|i| (*i as usize) < start)
            .map(|i| line_ends.len() - i)
            .unwrap_or(0);

        Location {
            byte_range: start..end,
            line_range: line_start..line_end,
            highlights: smallvec![(highlight.start - start)..(highlight.end - start)],
        }
    }
}

#[derive(Serialize)]
pub struct HighlightedString {
    pub text: String,

    /// Index ranges that are highlighted as matched.
    pub highlights: SmallVec<[Range<usize>; 2]>,
}

impl HighlightedString {
    /// Create a new highlighted string with no highlights.
    pub fn new<T: Into<String>>(text: T) -> Self {
        Self {
            text: text.into(),
            highlights: Default::default(),
        }
    }

    /// Apply a regex to this string, recording the match ranges, if any.
    pub fn apply_regex(&mut self, regex: &Regex) {
        self.highlights
            .extend(regex.find_iter(&self.text).map(|m| m.range()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;
    use regex::Regex;

    impl Snippet {
        fn line_count(&self) -> usize {
            self.line_range.end - self.line_range.start
        }
    }

    /// Test helper to ensure a string is newline-terminated, and also return an array of newline
    /// indices.
    fn with_line_ends(s: &str) -> (&str, Vec<u32>) {
        assert!(s.ends_with('\n'));
        let line_ends = s
            .match_indices('\n')
            .map(|(i, _)| i as u32)
            .collect::<Vec<_>>();
        (s, line_ends)
    }

    #[test]
    fn simple_snip() {
        let (text, line_ends) = with_line_ends("foobar\n");
        let highlight = 0..3;

        let snipper = Snipper::default();

        assert_eq!(
            snipper.expand(highlight, text, &line_ends).reify(text, &[]),
            Snippet {
                data: "foobar".into(),
                line_range: 0..0,
                highlights: vec![0..3],
                symbols: vec![],
            }
        );
    }

    #[test]
    fn empty_lines() {
        let (text, line_ends) = with_line_ends("\n\nfoo\nbar\nquux\n\n\n\n\n");
        let highlight = 6..9;
        let snipper = Snipper::default().context(1, 1);

        assert_eq!(
            snipper.expand(highlight, text, &line_ends).reify(text, &[]),
            Snippet {
                data: "foo\nbar\nquux".into(),
                line_range: 2..4,
                highlights: vec![4..7],
                symbols: vec![],
            }
        );
    }

    #[test]
    fn crlf_line_ends() {
        let (text, line_ends) = with_line_ends("foo\r\nbar\r\nquux\n");
        let highlight = 5..8;
        let snipper = Snipper::default().context(1, 1);

        assert_eq!(
            snipper.expand(highlight, text, &line_ends).reify(text, &[]),
            Snippet {
                data: "foo\r\nbar\r\nquux".into(),
                line_range: 0..2,
                highlights: vec![5..8],
                symbols: vec![],
            }
        );
    }

    #[test]
    fn mixed_line_ends() {
        let (text, line_ends) = with_line_ends("foo\nbar\r\nquux\n");
        let highlight = 4..7;
        let snipper = Snipper::default().context(1, 1);

        assert_eq!(
            snipper.expand(highlight, text, &line_ends).reify(text, &[]),
            Snippet {
                data: "foo\nbar\r\nquux".to_owned(),
                line_range: 0..2,
                highlights: vec![4..7],
                symbols: vec![],
            }
        );
    }

    #[test]
    fn context_before() {
        let (text, line_ends) = with_line_ends("a\nfoo\nbar\nquux\nz\n");
        let highlight = 6..9;
        let snipper = Snipper::default().context(1, 0);

        assert_eq!(
            snipper.expand(highlight, text, &line_ends).reify(text, &[]),
            Snippet {
                data: "foo\nbar".to_owned(),
                line_range: 1..2,
                highlights: vec![4..7],
                symbols: vec![],
            }
        );
    }

    /// Check that `context_before` being larger than the available line count works.
    #[test]
    fn context_before_underflow() {
        let (text, line_ends) = with_line_ends("bar\nquux\nz\n");
        let highlight = 0..3;
        let snipper = Snipper::default().context(1, 0);

        assert_eq!(
            snipper.expand(highlight, text, &line_ends).reify(text, &[]),
            Snippet {
                data: "bar".to_owned(),
                line_range: 0..0,
                highlights: vec![0..3],
                symbols: vec![],
            }
        );
    }

    #[test]
    fn context_after() {
        let (text, line_ends) = with_line_ends("a\nfoo\nbar\nquux\nz\n");
        let highlight = 6..9;
        let snipper = Snipper::default().context(0, 1);

        assert_eq!(
            snipper.expand(highlight, text, &line_ends).reify(text, &[]),
            Snippet {
                data: "bar\nquux".to_owned(),
                line_range: 2..3,
                highlights: vec![0..3],
                symbols: vec![],
            }
        );
    }

    /// Check that `context_after` being larger than the available line count works.
    #[test]
    fn context_after_overflow() {
        let (text, line_ends) = with_line_ends("a\nfoo\nbar\n");
        let highlight = 6..9;
        let snipper = Snipper::default().context(0, 1);

        assert_eq!(
            snipper.expand(highlight, text, &line_ends).reify(text, &[]),
            Snippet {
                data: "bar\n".to_owned(),
                line_range: 2..3,
                highlights: vec![0..3],
                symbols: vec![],
            }
        );
    }

    #[test]
    fn merge_into_one() {
        let text = &[
            r#"pub const SLICE_FROM_RAW_PARTS: [&str; 4] = ["core", "slice", "raw", "from_raw_parts"];"#,
            r#"pub const SLICE_FROM_RAW_PARTS_MUT: [&str; 4] = ["core", "slice", "raw", "from_raw_parts_mut"];"#,
            r#"pub const SLICE_GET: [&str; 4] = ["core", "slice", "<impl [T]>", "get"];"#,
            r#"pub const SLICE_INTO_VEC: [&str; 4] = ["alloc", "slice", "<impl [T]>", "into_vec"];"#,
            r#"pub const SLICE_INTO: [&str; 4] = ["core", "slice", "<impl [T]>", "iter"];"#,
            r#"pub const SLICE_ITER: [&str; 4] = ["core", "slice", "iter", "Iter"];"#,
            ""
        ]
        .join("\n");

        let (text, line_ends) = with_line_ends(text);
        let regex = Regex::new("SLICE").unwrap();
        let highlights = regex.find_iter(text).map(|m| m.range());

        let snipper = Snipper::default().context(1, 1);
        let observed = snipper
            .expand_many(highlights, text, &line_ends)
            .collect::<Vec<_>>();

        assert_eq!(observed.len(), 1);
        assert_eq!(observed[0].line_count(), 6);
    }

    #[test]
    fn merge_into_two() {
        let text = &[
            r#"pub const SLICE_FROM_RAW_PARTS: [&str; 4] = ["core", "slice", "raw", "from_raw_parts"];"#,
            r#"pub const SLICE_FROM_RAW_PARTS_MUT: [&str; 4] = ["core", "slice", "raw", "from_raw_parts_mut"];"#,
            r#"pub const GET: [&str; 4] = ["core", "slice", "<impl [T]>", "get"];"#,
            r#"pub const VEC: [&str; 4] = ["alloc", "slice", "<impl [T]>", "into_vec"];"#,
            r#"pub const INTO: [&str; 4] = ["core", "slice", "<impl [T]>", "iter"];"#,
            r#"pub const SLICE_ITER: [&str; 4] = ["core", "slice", "iter", "Iter"];"#,
            "",
        ]
        .join("\n");

        let (text, line_ends) = with_line_ends(text);
        let regex = Regex::new("SLICE").unwrap();
        let highlights = regex.find_iter(text).map(|m| m.range());

        let observed = Snipper::default()
            .context(1, 1)
            .expand_many(highlights, text, &line_ends)
            .map(|l| l.reify(text, &[]))
            .collect::<Vec<_>>();

        assert_eq!(observed.len(), 2);
        assert_eq!(
            observed[0].data,
            vec![
                r#"pub const SLICE_FROM_RAW_PARTS: [&str; 4] = ["core", "slice", "raw", "from_raw_parts"];"#,
                r#"pub const SLICE_FROM_RAW_PARTS_MUT: [&str; 4] = ["core", "slice", "raw", "from_raw_parts_mut"];"#,
                r#"pub const GET: [&str; 4] = ["core", "slice", "<impl [T]>", "get"];"#,
            ].join("\n")
        );
        assert_eq!(observed[0].line_count(), 2);
        assert_eq!(
            observed[1].data,
            vec![
                r#"pub const INTO: [&str; 4] = ["core", "slice", "<impl [T]>", "iter"];"#,
                r#"pub const SLICE_ITER: [&str; 4] = ["core", "slice", "iter", "Iter"];"#,
                ""
            ]
            .join("\n")
        );
        assert_eq!(observed[1].line_count(), 2);
    }

    #[test]
    fn multiline() {
        let (text, line_ends) = with_line_ends(
            "pub const SLICE_FROM_RAW_PARTS\n\
             pub const SLICE_FROM_RAW_PARTS_MUT\n\
             pub const VEC\n\
             pub const INTO\n",
        );

        let regex = Regex::new("SLICE").unwrap();
        let highlights = regex.find_iter(text).map(|m| m.range());

        let observed = Snipper::default()
            .context(1, 1)
            .expand_many(highlights, text, &line_ends)
            .map(|l| l.reify(text, &[]))
            .collect::<Vec<_>>();

        assert_eq!(observed.len(), 1);
        assert_eq!(
            observed[0].data,
            "pub const SLICE_FROM_RAW_PARTS\npub const SLICE_FROM_RAW_PARTS_MUT\npub const VEC",
        );
        assert_eq!(observed[0].line_count(), 2);
    }

    #[test]
    fn non_ascii() {
        let (text, line_ends) = with_line_ends("pub ようこそ SLICE_FROM_RAW_PARTS\npub ようこそ SLICE_FROM_RAW_ようこそ_MUT\npub const VECようこそ\npub ようこそ INTO\n");
        let regex = Regex::new("SLICE").unwrap();
        let highlights = regex.find_iter(text).map(|m| m.range());

        let observed = Snipper::default()
            .context(1, 1)
            .expand_many(highlights, text, &line_ends)
            .map(|l| l.reify(text, &[]))
            .collect::<Vec<_>>();

        assert_eq!(observed.len(), 1);
        assert_eq!(observed[0].line_count(), 2);
        assert_eq!(
            observed[0].data,
            "pub ようこそ SLICE_FROM_RAW_PARTS\npub ようこそ SLICE_FROM_RAW_ようこそ_MUT\npub const VECようこそ"
        )
    }

    #[test]
    fn avoids_empty_snippets() {
        let (text, line_end_indices) = with_line_ends("function foo() {}\n");
        let doc = indexes::reader::ContentDocument {
            content: text.into(),
            line_end_indices,
            ..Default::default()
        };
        assert_eq!(None, Snipper::default().all_for_doc("bar", &doc).unwrap());
        assert!(Snipper::default()
            .all_for_doc("foo", &doc)
            .unwrap()
            .is_some());
    }

    #[test]
    fn test_highlighted_string() {
        let mut s = HighlightedString::new("foo bar quux");

        s.apply_regex(&Regex::new("foo").unwrap());
        s.apply_regex(&Regex::new("b.r.").unwrap());
        s.apply_regex(&Regex::new("ux$").unwrap());

        assert_eq!(s.text, "foo bar quux");
        assert_eq!(s.highlights.to_vec(), &[0..3, 4..8, 10..12]);
    }
}
