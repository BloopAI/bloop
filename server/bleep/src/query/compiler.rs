use std::{
    borrow::Cow,
    collections::{HashMap, HashSet},
    mem,
};

use anyhow::{Context, Result};
use compact_str::CompactString;
use either::Either;
use smallvec::SmallVec;
use tantivy::{
    query::{AllQuery, BooleanQuery, BoostQuery, TermQuery},
    schema::{Field, IndexRecordOption},
    Index, Term,
};

use crate::query::{
    parser::{Literal, Query},
    planner,
};

type DynQuery = Box<dyn tantivy::query::Query>;

enum Extraction<'a> {
    /// Match a literal against a tantivy `text` field.
    Literal(Literal<'a>),

    /// Match a string against a tantivy `bytes` field.
    ByteString(&'a Cow<'a, str>),
}

/// A closure that tries to pull out an `Extraction` variant, given a `Query` reference.
type Extractor = dyn for<'a> FnMut(&'a Query<'a>) -> Option<Extraction<'a>>;

#[derive(Default)]
pub struct Compiler {
    priority: HashSet<Field>,
    extractors: HashMap<Field, Box<Extractor>>,
}

impl Compiler {
    /// Create a new Compiler.
    pub fn new() -> Self {
        Self::default()
    }

    /// Mark a list of fields as being high priority in compiled search queries.
    pub fn priority(mut self, fields: &[Field]) -> Self {
        self.priority = fields.iter().copied().collect();
        self
    }

    /// Add a literal field to the compiler.
    ///
    /// This takes a Tantivy `Field`, alongside a closure that returns an `Option<&Literal>` when
    /// given `&Query`. The compiler will craft a query that matches the literal against the index
    /// `Field`, using the indexer specified in the Tantivy schema.
    pub fn literal<F>(mut self, tantivy_field: Field, mut extractor: F) -> Self
    where
        F: for<'b> FnMut(&'b Query<'b>) -> Option<Literal<'b>> + 'static,
    {
        self.extractors.insert(
            tantivy_field,
            Box::new(move |q| extractor(q).map(Extraction::Literal)),
        );

        self
    }

    /// Add a byte string field to the compiler.
    ///
    /// Matches `Cow<str>` against a tantivy `bytes` field.
    pub fn byte_string<F>(mut self, tantivy_field: Field, mut extractor: F) -> Self
    where
        F: for<'b> FnMut(&'b Query<'b>) -> Option<&'b Cow<'b, str>> + 'static,
    {
        self.extractors.insert(
            tantivy_field,
            Box::new(move |q| extractor(q).map(Extraction::ByteString)),
        );
        self
    }

    /// Compile a list of queries into a single Tantivy query that matches any
    /// of them.
    pub fn compile<'a, I>(mut self, queries: I, index: &Index) -> Result<DynQuery>
    where
        I: Iterator<Item = &'a Query<'a>>,
    {
        let mut sub_queries: SmallVec<[DynQuery; 2]> = SmallVec::new();

        for query in queries {
            let mut intersection = Vec::new();

            for (field, extractor) in &mut self.extractors {
                let Some(extraction) = extractor(query) else {
                    continue
                };

                let field_query = match extraction {
                    Extraction::Literal(Literal::Plain(text)) => {
                        let tokenizer = index
                            .tokenizer_for_field(*field)
                            .context("field is missing tokenizer")?;

                        let mut token_stream = tokenizer.token_stream(&text);
                        let tokens = std::iter::from_fn(move || {
                            token_stream.next().map(|tok| CompactString::new(&tok.text))
                        });

                        let terms = if query.is_case_sensitive() {
                            tokens.map(|s| str_to_query(*field, &s)).collect::<Vec<_>>()
                        } else {
                            tokens
                                .map(|s| {
                                    let terms = case_permutations(&s)
                                        .map(|s| str_to_query(*field, &s))
                                        .collect();

                                    Box::new(BooleanQuery::union(terms)) as DynQuery
                                })
                                .collect()
                        };

                        let mut field_query: DynQuery = Box::new(BooleanQuery::intersection(terms));

                        if self.priority.contains(field) {
                            field_query = Box::new(BoostQuery::new(field_query, 10.0));
                        }

                        field_query
                    }
                    Extraction::Literal(Literal::Regex(regex)) => {
                        let plan = planner::plan(&regex)?;
                        plan_to_query(plan, *field, query.is_case_sensitive())
                    }

                    Extraction::ByteString(bs) => {
                        let term = Term::from_field_bytes(*field, bs.as_bytes());
                        let q = TermQuery::new(term, IndexRecordOption::Basic);
                        Box::new(q) as DynQuery
                    }
                };

                intersection.push(field_query);
            }

            sub_queries.push(Box::new(BooleanQuery::intersection(intersection)));
        }

        Ok(if sub_queries.len() == 1 {
            sub_queries.pop().unwrap()
        } else {
            Box::new(BooleanQuery::union(sub_queries.into_vec()))
        })
    }
}

fn plan_to_query(plan: planner::Fragment, field: Field, case_sensitive: bool) -> DynQuery {
    match plan {
        planner::Fragment::Literal(s) => {
            let queries = trigrams(&s)
                .flat_map(|s| {
                    if case_sensitive {
                        Either::Left(std::iter::once(s))
                    } else {
                        Either::Right(case_permutations(&s))
                    }
                })
                .map(|token| Term::from_field_text(field, &token))
                .map(|term| TermQuery::new(term, IndexRecordOption::WithFreqs))
                .map(|q| Box::new(q) as DynQuery)
                .collect::<Vec<_>>();

            Box::new(BooleanQuery::intersection(queries))
        }

        planner::Fragment::Dense(op, children) => {
            let subqueries = children
                .into_iter()
                .map(|f| plan_to_query(f, field, case_sensitive))
                .collect();

            Box::new(match op {
                planner::Op::Or => BooleanQuery::union(subqueries),
                planner::Op::And => BooleanQuery::intersection(subqueries),
            })
        }

        planner::Fragment::Break => Box::new(AllQuery),
    }
}

fn str_to_query(field: Field, s: &str) -> DynQuery {
    let term = Term::from_field_text(field, s);
    let q = TermQuery::new(term, IndexRecordOption::WithFreqs);
    Box::new(q) as DynQuery
}

/// Split a string into trigrams, returning a bigram or unigram if the string is shorter than 3
/// characters.
fn trigrams(s: &str) -> impl Iterator<Item = CompactString> {
    let mut chars = s.chars().collect::<SmallVec<[char; 6]>>();

    std::iter::from_fn(move || match chars.len() {
        0 => None,
        1 | 2 | 3 => Some(mem::take(&mut chars).into_iter().collect()),
        _ => {
            let out = chars.iter().take(3).collect();
            chars.remove(0);
            Some(out)
        }
    })
}

/// Get all case permutations of a string.
///
/// This permutes each character by ASCII lowercase and uppercase variants. Characters which do not
/// have case variants remain unchanged.
fn case_permutations(s: &str) -> impl Iterator<Item = CompactString> {
    // This implements a bitmask-based algorithm. The purpose is not speed; rather, a bitmask is
    // a simple way to get all combinations of a set of flags without allocating, sorting, or doing
    // anything else that is fancy.
    //
    // For example, given a list of 4 characters, we can represent which one is uppercased with a
    // bitmask: `0011` means that the last two characters are uppercased. To make things simpler
    // for the algorithm, we can reverse the bitmask to get `1100`; this allows us to create a
    // *new* bitmask specific to that character by simply doing `(1 << character_index)`. To see
    // this clearer, we can use a real string and break down all the masks:
    //
    //  - Example string: "abCD"
    //  - uppercase_bitmask: 1100
    //
    //  - "a" @ index 0, bitmask: (1 << 0) = 0001
    //  - "b" @ index 1, bitmask: (1 << 1) = 0010
    //  - "C" @ index 1, bitmask: (1 << 2) = 0100   (uppercased)
    //  - "D" @ index 1, bitmask: (1 << 3) = 1000   (uppercased)
    //                                 ----------
    //  - OR all of the uppercased masks   = 1100   (the uppercase bitmask)
    //
    // Using this, we can iterate through all combinations of letter casings by simply incrementing
    // the mask number, resulting in `0000`, `0001`, `0010`, `0011`, `0100`, etc...
    //
    // The algorithm below uses this mask to create all permutations of casings.

    let chars = s
        .chars()
        .map(|c| c.to_ascii_lowercase())
        .collect::<SmallVec<[char; 3]>>();

    // Make sure not to overflow. The end condition is a mask with the highest bit set, and we use
    // `u32` masks.
    debug_assert!(chars.len() <= 31);

    let num_chars = chars.len();

    let mut mask = 0b000;
    let end_mask = 1 << num_chars;
    let non_ascii_mask = chars
        .iter()
        .enumerate()
        .filter_map(|(i, c)| {
            if *c == c.to_ascii_uppercase() {
                Some(i)
            } else {
                None
            }
        })
        .map(|i| 1 << i)
        .fold(0u32, |a, e| a | e);

    std::iter::from_fn(move || {
        // Skip over variants that try to uppercase non-ascii letters.
        while mask < end_mask && (mask & non_ascii_mask) != 0 {
            mask += 1;
        }

        if mask >= end_mask {
            return None;
        }

        let permutation = chars
            .iter()
            .enumerate()
            .map(|(i, c)| {
                if mask & (1 << i) != 0 {
                    c.to_ascii_uppercase()
                } else {
                    *c
                }
            })
            .collect::<CompactString>();

        mask += 1;

        Some(permutation)
    })
}

#[cfg(test)]
mod tests {
    use tantivy::query::Occur;

    use super::*;

    #[test]
    fn test_trigrams() {
        let out = trigrams("abcde").collect::<Vec<_>>();
        assert_eq!(out, &["abc", "bcd", "cde"]);

        let out = trigrams("abc").collect::<Vec<_>>();
        assert_eq!(out, &["abc"]);

        let out = trigrams("ab").collect::<Vec<_>>();
        assert_eq!(out, &["ab"]);

        let out = trigrams("a").collect::<Vec<_>>();
        assert_eq!(out, &["a"]);

        let out = trigrams("").count();
        assert_eq!(out, 0);

        let out = trigrams("ab㐀de").collect::<Vec<_>>();
        assert_eq!(out, &["ab㐀", "b㐀d", "㐀de"]);
    }

    #[test]
    fn test_case_permutations() {
        let out = case_permutations("abc").collect::<Vec<_>>();
        assert_eq!(
            out,
            &["abc", "Abc", "aBc", "ABc", "abC", "AbC", "aBC", "ABC"]
        );

        let out = case_permutations("ab").collect::<Vec<_>>();
        assert_eq!(out, &["ab", "Ab", "aB", "AB"]);

        let out = case_permutations("a").collect::<Vec<_>>();
        assert_eq!(out, &["a", "A"]);

        let out = case_permutations("").collect::<Vec<_>>();
        assert_eq!(out, &[""]);

        let out = case_permutations("a㐀").collect::<Vec<_>>();
        assert_eq!(out, &["a㐀", "A㐀"]);

        let out = case_permutations("a㐀b").collect::<Vec<_>>();
        assert_eq!(out, &["a㐀b", "A㐀b", "a㐀B", "A㐀B"]);
    }

    #[test]
    fn test_plan_to_query() {
        // Call the planner directly for simplicity; it has its own tests.
        let plan = planner::plan("async").unwrap();
        let field = Field::from_field_id(123);
        let case_sensitive = true;

        let query = plan_to_query(plan, field, case_sensitive);
        let query = query.downcast_ref::<BooleanQuery>().unwrap();

        assert_eq!(query.clauses().len(), 3);

        let expected = ["asy", "syn", "ync"];
        for (clause, expected) in query.clauses().iter().zip(expected) {
            let (occur, query) = clause;
            assert_eq!(*occur, Occur::Must);

            let term = query.downcast_ref::<TermQuery>().unwrap();
            assert_eq!(term.term().as_str().unwrap(), expected);
        }
    }
}
