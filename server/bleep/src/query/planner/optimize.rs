use super::{Fragment, Op};

/// Recursively optimize a fragment.
pub(super) fn run(fragment: Fragment) -> Fragment {
    match fragment {
        f @ Fragment::Literal(_) | f @ Fragment::Break => f,
        Fragment::Dense(op, sub) => {
            let children = sub.into_iter().map(run).collect();
            let fragment = Fragment::Dense(op, children);

            match op {
                Op::And => inline(flatten_and(fragment)),
                Op::Or => flatten_or(fragment),
            }
        }
    }
}

fn flatten_or(fragment: Fragment) -> Fragment {
    if let Fragment::Dense(Op::Or, sub) = fragment {
        let mut simplified = Vec::new();

        for child in sub {
            if let Fragment::Dense(Op::Or, sub) = child {
                simplified.extend(sub);
            } else {
                simplified.push(child);
            }
        }

        Fragment::Dense(Op::Or, simplified)
    } else {
        fragment
    }
}

fn flatten_and(fragment: Fragment) -> Fragment {
    if let Fragment::Dense(Op::And, sub) = fragment {
        let mut simplified = Vec::new();

        for child in sub {
            if let Fragment::Dense(Op::And, sub) = child {
                simplified.extend(sub);
            } else {
                simplified.push(child);
            }
        }

        Fragment::Dense(Op::And, simplified)
    } else {
        fragment
    }
}

fn inline(fragment: Fragment) -> Fragment {
    if let Fragment::Dense(Op::And, parent) = fragment {
        let mut out = Vec::new();

        for rhs in parent {
            let lhs = if let Some(lhs) = out.pop() {
                lhs
            } else {
                out.push(rhs);
                continue;
            };

            match (lhs, rhs) {
                (Fragment::Dense(Op::Or, sub), rhs) => {
                    let mut sub2 = Vec::new();
                    for lhs in sub.into_iter() {
                        sub2.push(lhs.and(rhs.clone()));
                    }
                    out.push(Fragment::Dense(Op::Or, sub2));
                }

                (lhs, Fragment::Dense(Op::Or, sub)) => {
                    let mut sub2 = Vec::new();
                    for rhs in sub.into_iter() {
                        sub2.push(lhs.clone().and(rhs));
                    }
                    out.push(Fragment::Dense(Op::Or, sub2));
                }

                (lhs, rhs) => {
                    out.push(lhs.and(rhs));
                }
            }
        }

        if out.len() == 1 {
            out.pop().unwrap()
        } else {
            Fragment::Dense(Op::Or, out)
        }
    } else {
        fragment
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn basic_nested_or() {
        let fragment = Fragment::Dense(
            Op::Or,
            vec![
                Fragment::Dense(
                    Op::Or,
                    vec![
                        Fragment::Literal("abc".into()),
                        Fragment::Literal("def".into()),
                    ],
                ),
                Fragment::Literal("ghi".into()),
            ],
        );

        assert_eq!(
            flatten_or(fragment),
            Fragment::Dense(
                Op::Or,
                vec![
                    Fragment::Literal("abc".into()),
                    Fragment::Literal("def".into()),
                    Fragment::Literal("ghi".into()),
                ],
            )
        );
    }

    #[test]
    fn basic_inline() {
        let fragment = Fragment::Dense(
            Op::And,
            vec![
                Fragment::Literal("123".into()),
                Fragment::Dense(
                    Op::Or,
                    vec![
                        Fragment::Literal("abc".into()),
                        Fragment::Literal("def".into()),
                    ],
                ),
                Fragment::Literal("ghi".into()),
            ],
        );

        assert_eq!(
            inline(fragment),
            Fragment::Dense(
                Op::Or,
                vec![
                    Fragment::Literal("123abcghi".into()),
                    Fragment::Literal("123defghi".into()),
                ],
            )
        );
    }

    #[test]
    fn inline_nested() {
        // (a|b|c)(de|fg)h

        let fragment = Fragment::Dense(
            Op::And,
            vec![
                Fragment::Dense(
                    Op::Or,
                    vec![
                        Fragment::Literal("a".into()),
                        Fragment::Literal("b".into()),
                        Fragment::Literal("c".into()),
                    ],
                ),
                Fragment::Dense(
                    Op::Or,
                    vec![
                        Fragment::Literal("de".into()),
                        Fragment::Literal("fg".into()),
                    ],
                ),
                Fragment::Literal("h".into()),
            ],
        );

        let expected = Fragment::Dense(
            Op::Or,
            vec![
                Fragment::Dense(
                    Op::And,
                    vec![
                        Fragment::Literal("a".into()),
                        Fragment::Dense(
                            Op::Or,
                            vec![
                                Fragment::Literal("de".into()),
                                Fragment::Literal("fg".into()),
                            ],
                        ),
                        Fragment::Literal("h".into()),
                    ],
                ),
                Fragment::Dense(
                    Op::And,
                    vec![
                        Fragment::Literal("b".into()),
                        Fragment::Dense(
                            Op::Or,
                            vec![
                                Fragment::Literal("de".into()),
                                Fragment::Literal("fg".into()),
                            ],
                        ),
                        Fragment::Literal("h".into()),
                    ],
                ),
                Fragment::Dense(
                    Op::And,
                    vec![
                        Fragment::Literal("c".into()),
                        Fragment::Dense(
                            Op::Or,
                            vec![
                                Fragment::Literal("de".into()),
                                Fragment::Literal("fg".into()),
                            ],
                        ),
                        Fragment::Literal("h".into()),
                    ],
                ),
            ],
        );

        assert_eq!(inline(fragment), expected);
        assert_eq!(
            run(expected),
            Fragment::Dense(
                Op::Or,
                vec![
                    Fragment::Literal("adeh".into()),
                    Fragment::Literal("afgh".into()),
                    Fragment::Literal("bdeh".into()),
                    Fragment::Literal("bfgh".into()),
                    Fragment::Literal("cdeh".into()),
                    Fragment::Literal("cfgh".into()),
                ]
            )
        );
    }

    #[test]
    fn inline_break() {
        let fragment = Fragment::Dense(
            Op::And,
            vec![
                Fragment::Literal("abc".into()),
                Fragment::Break,
                Fragment::Literal("def".into()),
            ],
        );

        assert_eq!(run(fragment.clone()), fragment);
    }
}
