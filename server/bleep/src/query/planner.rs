use std::fmt::Display;

use regex_syntax::hir::{Class, Hir, HirKind, Literal, RepetitionKind, RepetitionRange};

mod optimize;

/// The maximum number of characters allowed in a character class before a break occurs.
const MAX_CLASS_RANGE_LEN: u32 = 10;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("encountered unexpected byte literal")]
    LiteralByte,
    #[error("got invalid regex")]
    InvalidRegex(#[from] Box<regex_syntax::Error>),
}

pub fn plan(regex: &str) -> Result<Fragment, Error> {
    let hir = regex_syntax::Parser::new().parse(regex).map_err(Box::new)?;

    // TODO: Optimizations are run twice in order to capture new available passes when possible.
    // Instead, the optimizer should be smart enough to re-run relevant passes recursively only
    // when applicable.
    step(hir).map(optimize::run).map(optimize::run)
}

fn step(hir: Hir) -> Result<Fragment, Error> {
    let fragment = match hir.into_kind() {
        HirKind::Empty => Fragment::empty(),
        HirKind::Literal(Literal::Unicode(lit)) => Fragment::Literal(lit.into()),
        HirKind::Literal(Literal::Byte(_)) => Err(Error::LiteralByte)?,

        HirKind::Class(Class::Unicode(cls)) => {
            let total_size = cls
                .iter()
                .map(|range| {
                    let start = range.start();
                    let end = range.end();
                    // Add 1, because this is an inclusive range.
                    (end as u32 + 1) - start as u32
                })
                .sum::<u32>();

            if total_size > MAX_CLASS_RANGE_LEN {
                Fragment::Break
            } else {
                let chars = cls
                    .iter()
                    .flat_map(|range| range.start() as u32..=range.end() as u32)
                    .map(|n| char::from_u32(n).unwrap().to_string())
                    .map(Fragment::Literal)
                    .collect();

                Fragment::Dense(Op::Or, chars)
            }
        }
        HirKind::Class(Class::Bytes(_)) => Err(Error::LiteralByte)?,
        HirKind::Anchor(_) => Fragment::Break,
        HirKind::WordBoundary(_) => Fragment::Break,
        HirKind::Repetition(repetition) => match repetition.kind {
            RepetitionKind::OneOrMore => step(*repetition.hir)?.and(Fragment::Break),
            RepetitionKind::Range(RepetitionRange::Bounded(n, _))
            | RepetitionKind::Range(RepetitionRange::Exactly(n))
            | RepetitionKind::Range(RepetitionRange::AtLeast(n))
                if n > 0 =>
            {
                step(*repetition.hir)?.and(Fragment::Break)
            }

            RepetitionKind::ZeroOrMore | RepetitionKind::Range(_) | RepetitionKind::ZeroOrOne => {
                Fragment::Break
            }
        },
        HirKind::Group(group) => step(*group.hir)?,

        HirKind::Concat(hirs) => hirs
            .into_iter()
            .map(step)
            .try_fold(Fragment::empty(), |a, r| r.map(|e| Fragment::and(a, e)))?,

        HirKind::Alternation(alts) => alts
            .into_iter()
            .map(step)
            .reduce(|a, e| Ok(a?.or(e?)))
            .transpose()?
            .unwrap_or_else(Fragment::empty),
    };

    Ok(fragment)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Fragment {
    /// A dense fragment.
    ///
    /// This is a fragment that cannot yet be collapsed into a `Query` because its children are not
    /// long enough to be trigrams.
    Dense(Op, Vec<Self>),

    /// A literal string.
    ///
    /// This can be any length, including zero.
    Literal(String),

    /// An arbitrary length fragment of any content.
    Break,
}

impl Fragment {
    fn empty() -> Self {
        Self::Literal(String::new())
    }

    fn and(self, other: Self) -> Self {
        match (self, other) {
            // Remove empty strings.
            (Fragment::Literal(s), rhs) if s.is_empty() => rhs,
            (lhs, Fragment::Literal(s)) if s.is_empty() => lhs,

            // Join breaks.
            (Fragment::Break, Fragment::Break) => Fragment::Break,

            // Join literals.
            (Fragment::Literal(lit), Fragment::Literal(olit)) => Fragment::Literal(lit + &olit),

            (Fragment::Dense(Op::And, mut lhs), Fragment::Dense(Op::And, rhs)) => {
                lhs.extend(rhs);
                Fragment::Dense(Op::And, lhs)
            }

            // String joining optimization.
            (Fragment::Dense(Op::And, mut lhs), Fragment::Literal(rhs))
                if lhs.last().and_then(Fragment::as_literal).is_some() =>
            {
                *lhs.last_mut().unwrap().as_literal_mut().unwrap() += &rhs;
                Fragment::Dense(Op::And, lhs)
            }

            (Fragment::Dense(Op::And, mut lhs), rhs) => {
                lhs.push(rhs);
                Fragment::Dense(Op::And, lhs)
            }

            (lhs, Fragment::Dense(Op::And, mut rhs)) => {
                rhs.insert(0, lhs);
                Fragment::Dense(Op::And, rhs)
            }

            (lhs, rhs) => Fragment::Dense(Op::And, vec![lhs, rhs]),
        }
    }

    fn or(self, other: Self) -> Self {
        match (self, other) {
            // (()|xyz) matches empty string
            (Fragment::Literal(s), _) if s.is_empty() => Fragment::Literal(String::new()),
            (_, Fragment::Literal(s)) if s.is_empty() => Fragment::Literal(String::new()),

            // Join breaks.
            (Fragment::Break, Fragment::Break) => Fragment::Break,

            (Fragment::Literal(lhs), Fragment::Literal(rhs)) => {
                Fragment::Dense(Op::Or, vec![Fragment::Literal(lhs), Fragment::Literal(rhs)])
            }

            (Fragment::Dense(Op::Or, mut lhs), Fragment::Dense(Op::Or, rhs)) => {
                lhs.extend(rhs);
                Fragment::Dense(Op::Or, lhs)
            }

            (Fragment::Dense(Op::Or, mut sub), rhs) => {
                sub.push(rhs);
                Fragment::Dense(Op::Or, sub)
            }

            (lhs, Fragment::Dense(Op::Or, mut sub)) => {
                sub.insert(0, lhs);
                Fragment::Dense(Op::Or, sub)
            }

            (lhs, rhs) => Fragment::Dense(Op::Or, vec![lhs, rhs]),
        }
    }

    fn as_literal(&self) -> Option<&String> {
        if let Self::Literal(s) = self {
            Some(s)
        } else {
            None
        }
    }

    fn as_literal_mut(&mut self) -> Option<&mut String> {
        if let Self::Literal(s) = self {
            Some(s)
        } else {
            None
        }
    }
}

impl Display for Fragment {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Break => write!(f, " * "),
            Self::Literal(s) => write!(f, "{s}"),
            Self::Dense(op, children) => {
                let mut join = "";
                let op = match op {
                    Op::And => " AND ",
                    Op::Or => " OR ",
                };

                for fragment in children {
                    write!(f, "{join}({fragment})")?;
                    join = op;
                }

                Ok(())
            }
        }
    }
}

#[derive(Debug, PartialEq, Eq, Default, Copy, Clone)]
pub enum Op {
    #[default]
    And,
    Or,
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn string_literal() {
        assert_eq!(plan("abcde").unwrap(), Fragment::Literal("abcde".into()),);
    }

    #[test]
    fn simple_inline() {
        assert_eq!(plan("ab(cd)").unwrap(), Fragment::Literal("abcd".into()));
    }

    #[test]
    fn double_alternation() {
        // (a|b|c)(de|fg)h
        //
        // optimization:
        //
        // inline        => ((a(de|fg)h) | (b(de|fg)h) | (c(de|fg)h))
        // inline        => (((ade|afg)h) | ((bde|bfg)h) | ((cde|cfg)h))
        // inline        => ((adeh|afgh) | (bdeh|bfgh) | (cdeh|cfgh))
        // flatten_or    => adeh | afgh | bdeh | bfgh | cdeh | cfgh

        let fragment = plan("(a|b|c)(de|fg)h").unwrap();
        let expected = Fragment::Dense(
            Op::Or,
            vec![
                Fragment::Literal("adeh".into()),
                Fragment::Literal("afgh".into()),
                Fragment::Literal("bdeh".into()),
                Fragment::Literal("bfgh".into()),
                Fragment::Literal("cdeh".into()),
                Fragment::Literal("cfgh".into()),
            ],
        );

        assert_eq!(fragment, expected);
    }

    #[test]
    fn nested_or() {
        // (((abc|def)|ghi)|jkl|(123|(456|(789)))|000)
        // => abc|def|ghi|jkl|123|456|789|000

        let fragment = plan("(((abc|def)|ghi)|jkl|((123|(456|(789))))|000)").unwrap();
        let expected = Fragment::Dense(
            Op::Or,
            vec![
                Fragment::Literal("abc".into()),
                Fragment::Literal("def".into()),
                Fragment::Literal("ghi".into()),
                Fragment::Literal("jkl".into()),
                Fragment::Literal("123".into()),
                Fragment::Literal("456".into()),
                Fragment::Literal("789".into()),
                Fragment::Literal("000".into()),
            ],
        );

        assert_eq!(fragment, expected);
    }

    #[test]
    fn basic_inline() {
        // ab(de|fg)
        // inline        => abde|abfg
        let fragment = plan("ab(de|fg)").unwrap();
        let expected = Fragment::Dense(
            Op::Or,
            vec![
                Fragment::Literal("abde".into()),
                Fragment::Literal("abfg".into()),
            ],
        );

        assert_eq!(fragment, expected);
    }

    #[test]
    fn small_literal_alt() {
        let frag = plan("ab|cd").unwrap();
        assert_eq!(
            frag,
            Fragment::Dense(
                Op::Or,
                vec![
                    Fragment::Literal("ab".into()),
                    Fragment::Literal("cd".into()),
                ],
            )
        );
    }

    #[test]
    fn simple_wildcard() {
        let frag = plan("abc.def").unwrap();
        assert_eq!(
            frag,
            Fragment::Dense(
                Op::And,
                vec![
                    Fragment::Literal("abc".into()),
                    Fragment::Break,
                    Fragment::Literal("def".into()),
                ],
            ),
        );
    }

    #[test]
    fn repetition() {
        let frag = plan("abc.*def").unwrap();
        assert_eq!(
            frag,
            Fragment::Dense(
                Op::And,
                vec![
                    Fragment::Literal("abc".into()),
                    Fragment::Break,
                    Fragment::Literal("def".into()),
                ],
            ),
        );

        let frag = plan("abcz*def").unwrap();
        assert_eq!(
            frag,
            Fragment::Dense(
                Op::And,
                vec![
                    Fragment::Literal("abc".into()),
                    Fragment::Break,
                    Fragment::Literal("def".into()),
                ],
            ),
        );

        let frag = plan("abcz+def").unwrap();
        assert_eq!(
            frag,
            Fragment::Dense(
                Op::And,
                vec![
                    Fragment::Literal("abcz".into()),
                    Fragment::Break,
                    Fragment::Literal("def".into()),
                ],
            ),
        );

        let frag = plan("async+.fn.main").unwrap();
        assert_eq!(
            frag,
            Fragment::Dense(
                Op::And,
                vec![
                    Fragment::Literal("async".into()),
                    Fragment::Break,
                    Fragment::Break,
                    Fragment::Literal("fn".into()),
                    Fragment::Break,
                    Fragment::Literal("main".into()),
                ],
            ),
        );
    }

    #[test]
    fn simple_range() {
        let frag = plan("abc[d-f]g").unwrap();
        assert_eq!(
            frag,
            Fragment::Dense(
                Op::Or,
                vec![
                    Fragment::Literal("abcdg".into()),
                    Fragment::Literal("abceg".into()),
                    Fragment::Literal("abcfg".into()),
                ],
            ),
        );
    }
}
