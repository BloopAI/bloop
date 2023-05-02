use pest::{iterators::Pair, Parser};
use regex::Regex;
use smallvec::{smallvec, SmallVec};
use std::{borrow::Cow, collections::HashSet, mem};

#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct Query<'a> {
    pub open: Option<bool>,
    pub case_sensitive: Option<bool>,
    pub global_regex: Option<bool>,

    pub org: Option<Literal<'a>>,
    pub repo: Option<Literal<'a>>,
    pub path: Option<Literal<'a>>,
    pub lang: Option<Cow<'a, str>>,
    pub branch: Option<Literal<'a>>,
    pub target: Option<Target<'a>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum Target<'a> {
    Symbol(Literal<'a>),
    Content(Literal<'a>),
}

#[derive(Debug, PartialEq, Eq)]
#[allow(clippy::large_enum_variant)]
pub enum ParsedQuery<'a> {
    Semantic(SemanticQuery<'a>),
    Grep(Vec<Query<'a>>),
}

#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct SemanticQuery<'a> {
    pub repos: HashSet<Literal<'a>>,
    pub paths: HashSet<Literal<'a>>,
    pub langs: HashSet<Cow<'a, str>>,
    pub branch: HashSet<Literal<'a>>,
    pub target: Option<Literal<'a>>,
}

impl<'a> SemanticQuery<'a> {
    pub fn repos(&self) -> impl Iterator<Item = &Cow<'_, str>> {
        self.repos.iter().filter_map(|t| t.as_plain())
    }

    pub fn paths(&self) -> impl Iterator<Item = &Cow<'_, str>> {
        self.paths.iter().filter_map(|t| t.as_plain())
    }

    pub fn langs(&self) -> impl Iterator<Item = &Cow<'_, str>> {
        self.langs.iter()
    }

    pub fn target(&self) -> Option<&Cow<'_, str>> {
        self.target.as_ref().and_then(|t| t.as_plain())
    }

    pub fn branch(&self) -> impl Iterator<Item = &Cow<'_, str>> {
        self.branch.iter().filter_map(|t| t.as_plain())
    }
}

impl<'a> Query<'a> {
    /// Merge this query with another, overwriting current terms by terms in the new query, if they
    /// exist.
    fn merge(self, rhs: Self) -> Self {
        Self {
            open: rhs.open.or(self.open),
            case_sensitive: rhs.case_sensitive.or(self.case_sensitive),
            global_regex: rhs.global_regex.or(self.global_regex),

            org: rhs.org.or(self.org),
            repo: rhs.repo.or(self.repo),
            path: rhs.path.or(self.path),
            lang: rhs.lang.or(self.lang),
            branch: rhs.branch.or(self.branch),

            target: match (self.target, rhs.target) {
                (Some(Target::Content(lhs)), Some(Target::Content(rhs))) => {
                    Some(Target::Content(lhs.join_as_regex(rhs)))
                }

                // TODO: Do we want to return an error here?
                (lhs, rhs) => rhs.or(lhs),
            },
        }
    }

    /// Fetch all `merge`s of this `Query` with a list of query groups.
    ///
    /// This is useful to flatten out a nested tree of queries. For example, with the following input
    /// string:
    ///
    /// ```text
    /// (repo:enterprise-search or repo:query-planner) (org:bloop or org:google) ParseError
    /// ```
    ///
    /// This method will effectively flatten out the combinators, resulting in the equivalent list
    /// of queries:
    ///
    /// ```text
    ///    (repo:enterprise-search org:bloop  ParseError)
    /// or (repo:query-planner     org:bloop  ParseError)
    /// or (repo:enterprise-search org:google ParseError)
    /// or (repo:query-planner     org:google ParseError)
    /// ```
    ///
    /// The input argument `iter` expects an iterator, where each item is another iterator over a
    /// set of queries joined with `or`. Because a list of queries is effectively an `or`, you can
    /// interpret the input as being a list of `or` groups that are `and`ed together.
    fn cross<I>(self, mut iter: I) -> SmallVec<[Self; 1]>
    where
        I: Clone + Iterator,
        I::Item: Iterator<Item = Self>,
    {
        if let Some(queries) = iter.next() {
            let mut list = smallvec![];

            for rhs in queries {
                list.extend(self.clone().merge(rhs).cross(iter.clone()));
            }

            list
        } else {
            smallvec![self]
        }
    }

    pub fn is_case_sensitive(&self) -> bool {
        self.case_sensitive.unwrap_or(true)
    }

    fn set_global_regex(&mut self, value: Option<bool>) {
        self.global_regex = value;
        if let Some(true) = value {
            self.org.as_mut().map(Literal::make_regex);
            self.repo.as_mut().map(Literal::make_regex);
            self.path.as_mut().map(Literal::make_regex);
            self.target.as_mut().map(Target::make_regex);
        }
    }
}

impl<'a> Target<'a> {
    /// Get the inner literal for this target, regardless of the variant.
    pub fn literal(&self) -> &Literal<'_> {
        match self {
            Self::Symbol(lit) => lit,
            Self::Content(lit) => lit,
        }
    }

    /// Get the symbol literal, if present
    pub fn symbol(&self) -> Option<&Literal<'_>> {
        match self {
            Self::Symbol(lit) => Some(lit),
            Self::Content(_) => None,
        }
    }

    /// Get the content literal, if present
    pub fn content(&self) -> Option<&Literal<'_>> {
        match self {
            Self::Symbol(_) => None,
            Self::Content(lit) => Some(lit),
        }
    }

    fn make_regex(&mut self) {
        match self {
            Self::Symbol(lit) => lit.make_regex(),
            Self::Content(lit) => lit.make_regex(),
        }
    }
}

#[derive(pest_derive::Parser)]
#[grammar = "query/grammar.pest"] // relative to src
struct PestParser;

#[derive(Debug, PartialEq, thiserror::Error)]
pub enum ParseError {
    #[error("parse error: {0:?}")]
    Pest(#[from] Box<pest::error::Error<Rule>>),
    #[error("unparsed token: {0:?}")]
    UnparsedToken(String),
    #[error("multiple mode designators")]
    MultiMode,
}

#[derive(Debug, PartialEq, Eq, Clone, Hash)]
pub enum Literal<'a> {
    Plain(Cow<'a, str>),
    Regex(Cow<'a, str>),
}

impl<'a> Default for Literal<'a> {
    fn default() -> Self {
        Self::Plain(Cow::Borrowed(""))
    }
}

impl Literal<'_> {
    fn join_as_regex(self, rhs: Self) -> Self {
        let lhs = self.regex_str();
        let rhs = rhs.regex_str();
        Self::Regex(Cow::Owned(format!("{lhs}\\s+{rhs}")))
    }

    fn join_as_plain(self, rhs: Self) -> Option<Self> {
        let lhs = self.as_plain()?;
        let rhs = rhs.as_plain()?;
        Some(Self::Plain(Cow::Owned(format!("{lhs} {rhs}"))))
    }

    /// Convert this literal into a regex string.
    ///
    /// If this literal is a regex, it is returned as-is. If it is a plain text literal, it is
    /// escaped first before returning.
    pub fn regex_str(&self) -> Cow<'_, str> {
        match self {
            Self::Plain(text) => Cow::Owned(regex::escape(text)),
            Self::Regex(r) => r.clone(),
        }
    }

    pub fn regex(&self) -> Result<Regex, regex::Error> {
        Regex::new(&self.regex_str())
    }

    pub fn as_plain(&self) -> Option<&Cow<str>> {
        match self {
            Self::Plain(p) => Some(p),
            Self::Regex(..) => None,
        }
    }

    /// Force this literal into the `Regex` variant.
    fn make_regex(&mut self) {
        *self = match std::mem::take(self) {
            Self::Plain(s) | Self::Regex(s) => Self::Regex(s),
        }
    }
}

impl<'a> From<Pair<'a, Rule>> for Literal<'a> {
    fn from(pair: Pair<'a, Rule>) -> Self {
        match pair.as_rule() {
            Rule::unquoted_literal => Self::Plain(pair.as_str().trim().into()),
            Rule::quoted_literal => Self::Plain(unescape(pair.as_str(), '"').into()),
            Rule::single_quoted_literal => Self::Plain(unescape(pair.as_str(), '\'').into()),
            Rule::regex_quoted_literal => Self::Regex(unescape(pair.as_str(), '/').into()),
            Rule::raw_text => Self::Plain(pair.as_str().trim().into()),
            _ => unreachable!(),
        }
    }
}

/// Unescape a string, with a specific terminating character.
///
/// Newline and tab strings (`\n` and `\t`) are replaced with the respective character. Backslashes
/// are preserved with a double escape (`\\`). If the terminating character is encountered, it is
/// returned without a preceding backslash. All other escape characters are not interpreted, and
/// backslashes are preserved.
///
///
/// ```rust,ignore
/// unescape("ab\\/c", '/') = "ab/c"
/// unescape("ab\\/c", '"') = "ab\\/c"
/// unescape("ab\\nc", '"') = "ab\nc"
/// unescape("ab\\\"c", '"') = "ab\\\"c"
/// ```
fn unescape(s: &str, term: char) -> String {
    let mut result = String::new();
    let mut chars = s.chars();

    while let Some(c) = chars.next() {
        if c != '\\' {
            result.push(c);
            continue;
        }

        match chars.next() {
            Some('n') => result.push('\n'),
            Some('t') => result.push('\t'),
            Some(c) if c == term => result.push(c),
            Some(c) => {
                result.push('\\');
                result.push(c);
            }
            None => continue,
        }
    }

    result
}

#[derive(Debug, PartialEq, Clone, Eq)]
enum ForceParsingAs {
    Grep,
    Semantic,
}

#[derive(Debug, PartialEq, Clone)]
enum Expr<'a> {
    Or(Vec<Expr<'a>>),
    And(Vec<Expr<'a>>),

    Org(Literal<'a>),
    Repo(Literal<'a>),
    Symbol(Literal<'a>),
    Path(Literal<'a>),
    Lang(Cow<'a, str>),
    Content(Literal<'a>),
    Branch(Literal<'a>),

    CaseSensitive(bool),
    Open(bool),
    GlobalRegex(bool),

    /// This is only parsed so we it doesn't mix with the actual query
    /// Not actively used anywhere.
    GlobalMode(ForceParsingAs),
}

impl<'a> Expr<'a> {
    fn parse(pair: Pair<'a, Rule>, top_level: bool) -> Result<Self, Pair<'a, Rule>> {
        use Expr::*;

        Ok(match pair.as_rule() {
            Rule::unquoted_literal
            | Rule::quoted_literal
            | Rule::single_quoted_literal
            | Rule::regex_quoted_literal => Content(Literal::from(pair)),

            Rule::content => Content(Literal::from(pair.into_inner().next().unwrap())),
            Rule::path => Path(Literal::from(pair.into_inner().next().unwrap())),
            Rule::repo => Repo(Literal::from(pair.into_inner().next().unwrap())),
            Rule::symbol => Symbol(Literal::from(pair.into_inner().next().unwrap())),
            Rule::org => Org(Literal::from(pair.into_inner().next().unwrap())),
            Rule::branch => Branch(Literal::from(pair.into_inner().next().unwrap())),
            Rule::lang => Lang(pair.into_inner().as_str().into()),

            Rule::open => {
                let inner = pair.into_inner().next().unwrap();
                match inner.as_str() {
                    "true" => Open(true),
                    "false" => Open(false),
                    _ => unreachable!(),
                }
            }

            Rule::case => {
                // Avoid parsing this flag unless it's at the top level.
                if !top_level {
                    return Err(pair);
                }

                let inner = pair.into_inner().next().unwrap();
                match inner.as_rule() {
                    Rule::case_sensitive => CaseSensitive(true),
                    Rule::case_ignore => CaseSensitive(false),
                    _ => unreachable!(),
                }
            }

            Rule::global_regex => {
                // Avoid parsing this flag unless it's at the top level.
                if !top_level {
                    return Err(pair);
                }

                let inner = pair.into_inner().next().unwrap();
                match inner.as_str() {
                    "true" => GlobalRegex(true),
                    "false" => GlobalRegex(false),
                    _ => unreachable!(),
                }
            }

            Rule::mode_selector => {
                // Avoid parsing this flag unless it's at the top level.
                if !top_level {
                    return Err(pair);
                }

                let inner = pair.into_inner().next().unwrap();
                match inner.as_str() {
                    "grep" => GlobalMode(ForceParsingAs::Grep),
                    "semantic" => GlobalMode(ForceParsingAs::Semantic),
                    _ => unreachable!(),
                }
            }

            Rule::group => {
                // Descend into the group, disabling the `top_level` flag.
                Self::parse(pair.into_inner().next().unwrap(), false)?
            }

            Rule::intersection => {
                let mut unions = Vec::new();
                let mut els = Vec::new();

                for pair in pair.into_inner() {
                    match pair.as_rule() {
                        Rule::or => unions.push(mem::take(&mut els)),
                        _ => els.push(Self::parse(pair, top_level)?),
                    }
                }

                if !unions.is_empty() {
                    let unions = unions.into_iter().chain(Some(els)).map(And).collect();
                    Or(unions)
                } else {
                    And(els)
                }
            }

            // It's not possible to declare this rule as both silent and atomic in pest, so we
            // descend when we encounter it, simulating a silent rule.
            //
            // https://github.com/pest-parser/pest/issues/520
            Rule::element => Self::parse(pair.into_inner().next().unwrap(), top_level)?,

            _ => Err(pair)?,
        })
    }
}

/// Parse an input query string into a list of top-level `Query`s.
pub fn parse(query: &str) -> Result<Vec<Query<'_>>, ParseError> {
    let pair = PestParser::parse(Rule::query, query)
        .map_err(Box::new)?
        .next()
        .unwrap();
    let root =
        Expr::parse(pair, true).map_err(|pair| ParseError::UnparsedToken(pair.to_string()))?;

    let mut qs = flatten(root);

    // Find and redistribute global options.
    let global_regex = qs.iter().fold(None, |a, e| e.global_regex.or(a));
    let case_sensitive = qs.iter().fold(None, |a, e| e.case_sensitive.or(a));

    for q in qs.iter_mut() {
        q.set_global_regex(global_regex);
        q.case_sensitive = case_sensitive;
    }

    Ok(qs.into_vec())
}

pub fn parse_nl(query: &str) -> Result<ParsedQuery<'_>, ParseError> {
    let pairs = PestParser::parse(Rule::nl_query, query).map_err(Box::new)?;

    let mut repos = HashSet::new();
    let mut paths = HashSet::new();
    let mut langs = HashSet::new();
    let mut branch = HashSet::new();
    let mut target: Option<Literal> = None;
    let mut force_parsing_as = None;
    for pair in pairs {
        match pair.as_rule() {
            Rule::repo => {
                let item = Literal::from(pair.into_inner().next().unwrap());
                let _ = repos.insert(item);
            }
            Rule::path => {
                let item = Literal::from(pair.into_inner().next().unwrap());
                let _ = paths.insert(item);
            }
            Rule::branch => {
                let item = Literal::from(pair.into_inner().next().unwrap());
                let _ = branch.insert(item);
            }
            Rule::lang => {
                let item = super::languages::parse_alias(pair.into_inner().as_str().into());
                let _ = langs.insert(item);
            }
            Rule::raw_text => {
                let rhs = Literal::from(pair);
                if let Some(t) = target {
                    target = t.join_as_plain(rhs);
                } else {
                    target = Some(rhs);
                }
            }
            Rule::mode_selector => {
                let inner = pair.into_inner().next().unwrap();
                match inner.as_str() {
                    "grep" if force_parsing_as.is_none() => {
                        force_parsing_as = Some(ForceParsingAs::Grep);
                    }
                    "semantic" if force_parsing_as.is_none() => {
                        force_parsing_as = Some(ForceParsingAs::Semantic);
                    }
                    _ => return Err(ParseError::MultiMode),
                };
            }
            _ => {}
        }
    }

    match force_parsing_as {
        Some(ForceParsingAs::Grep) => parse(query).map(ParsedQuery::Grep),
        _ => Ok(ParsedQuery::Semantic(SemanticQuery {
            repos,
            paths,
            langs,
            branch,
            target,
        })),
    }
}

fn flatten(root: Expr<'_>) -> SmallVec<[Query<'_>; 1]> {
    match root {
        Expr::Repo(repo) => smallvec![Query {
            repo: Some(repo),
            ..Default::default()
        }],
        Expr::Branch(branch) => smallvec![Query {
            branch: Some(branch),
            ..Default::default()
        }],
        Expr::Org(org) => smallvec![Query {
            org: Some(org),
            ..Default::default()
        }],
        Expr::Path(path) => smallvec![Query {
            path: Some(path),
            ..Default::default()
        }],

        Expr::Symbol(sym) => smallvec![Query {
            target: Some(Target::Symbol(sym)),
            ..Default::default()
        }],
        Expr::Lang(lang) => smallvec![Query {
            lang: Some(super::languages::parse_alias(lang)),
            ..Default::default()
        }],
        Expr::Content(lit) => smallvec![Query {
            target: Some(Target::Content(lit)),
            ..Default::default()
        }],

        Expr::CaseSensitive(case_sensitive) => smallvec![Query {
            case_sensitive: Some(case_sensitive),
            ..Default::default()
        }],
        Expr::Open(open) => smallvec![Query {
            open: Some(open),
            ..Default::default()
        }],
        Expr::GlobalRegex(flag) => smallvec![Query {
            global_regex: Some(flag),
            ..Default::default()
        }],
        Expr::GlobalMode(_) => smallvec![Query {
            // we don't propagate this flag down to the query level!
            ..Default::default()
        }],

        // Simple merge
        Expr::Or(exprs) => {
            let mut queries = smallvec![];
            for e in exprs {
                queries.extend(flatten(e));
            }
            queries
        }

        // A more complex cross merge.
        Expr::And(els) => {
            Query::default().cross(els.iter().cloned().map(flatten).map(SmallVec::into_iter))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn basic_parse() {
        assert_eq!(
            parse("ParseError").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain("ParseError".into()))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("org:bloopai repo:enterprise-search branch:main ParseError").unwrap(),
            vec![Query {
                repo: Some(Literal::Plain("enterprise-search".into())),
                org: Some(Literal::Plain("bloopai".into())),
                branch: Some(Literal::Plain("main".into())),
                target: Some(Target::Content(Literal::Plain("ParseError".into()))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("org:bloopai repo:enterprise-search ParseError").unwrap(),
            vec![Query {
                repo: Some(Literal::Plain("enterprise-search".into())),
                org: Some(Literal::Plain("bloopai".into())),
                target: Some(Target::Content(Literal::Plain("ParseError".into()))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("content:ParseError").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain("ParseError".into()))),
                ..Query::default()
            }],
        );

        // Here the last target operator takes precedence. Should we return an error instead?
        assert_eq!(
            parse("path:foo.c create_foo symbol:bar").unwrap(),
            vec![Query {
                path: Some(Literal::Plain("foo.c".into())),
                target: Some(Target::Symbol(Literal::Plain("bar".into()))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("case:ignore Parse").unwrap(),
            vec![Query {
                case_sensitive: Some(false),
                target: Some(Target::Content(Literal::Plain("Parse".into()))),
                ..Query::default()
            }],
        );
    }

    #[test]
    fn test_force_parsing_mode_from_language() {
        assert_eq!(
            parse("repo:foo ParseError or repo:bar mode:grep").unwrap(),
            vec![
                Query {
                    repo: Some(Literal::Plain("foo".into())),
                    target: Some(Target::Content(Literal::Plain("ParseError".into()))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("bar".into())),
                    ..Query::default()
                },
            ],
        );

        assert_eq!(
            parse_nl("repo:foo ParseError or repo:bar mode:grep"),
            Ok(ParsedQuery::Grep(vec![
                Query {
                    repo: Some(Literal::Plain("foo".into())),
                    target: Some(Target::Content(Literal::Plain("ParseError".into()))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("bar".into())),
                    ..Query::default()
                },
            ])),
        );

        assert_eq!(
            parse("repo:foo ParseError or repo:bar").unwrap(),
            vec![
                Query {
                    repo: Some(Literal::Plain("foo".into())),
                    target: Some(Target::Content(Literal::Plain("ParseError".into()))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("bar".into())),
                    ..Query::default()
                },
            ],
        );

        assert_eq!(
            parse_nl("repo:bar or repo:foo ParseError mode:grep mode:semantic"),
            Err(ParseError::MultiMode)
        );

        assert_eq!(
            parse_nl("repo:bar or repo:foo ParseError mode:semantic mode:grep"),
            Err(ParseError::MultiMode)
        );
    }

    #[test]
    fn intersection_parse() {
        assert_eq!(
            parse("repo:foo ParseError or repo:bar").unwrap(),
            vec![
                Query {
                    repo: Some(Literal::Plain("foo".into())),
                    target: Some(Target::Content(Literal::Plain("ParseError".into()))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("bar".into())),
                    ..Query::default()
                },
            ],
        );

        // Flip the intersection order.
        assert_eq!(
            parse("repo:bar or repo:foo ParseError").unwrap(),
            vec![
                Query {
                    repo: Some(Literal::Plain("bar".into())),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("foo".into())),
                    target: Some(Target::Content(Literal::Plain("ParseError".into()))),
                    ..Query::default()
                },
            ],
        );
    }

    #[test]
    fn complex_nested_combinators_expr() {
        // (((repo:foo xyz) or repo:abc) (repo:fred or repo:grub) org:bloop)
        //
        // -> 4 independent terms [
        //    (org:bloop repo:fred xyz),
        //    (org:bloop repo:grub xyz),
        //    (org:bloop repo:fred),
        //    (org:bloop repo:grub),
        // ]

        let terms = flatten(Expr::And(vec![
            Expr::Or(vec![
                Expr::And(vec![
                    Expr::Repo(Literal::Plain("foo".into())),
                    Expr::Content(Literal::Plain("xyz".into())),
                ]),
                Expr::Repo(Literal::Plain("abc".into())),
            ]),
            Expr::Or(vec![
                Expr::Repo(Literal::Plain("fred".into())),
                Expr::Repo(Literal::Plain("grub".into())),
            ]),
            Expr::Org(Literal::Plain("bloop".into())),
        ]));

        assert_eq!(
            terms.into_vec(),
            vec![
                Query {
                    repo: Some(Literal::Plain("fred".into())),
                    org: Some(Literal::Plain("bloop".into())),
                    target: Some(Target::Content(Literal::Plain("xyz".into()))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("grub".into())),
                    org: Some(Literal::Plain("bloop".into())),
                    target: Some(Target::Content(Literal::Plain("xyz".into()))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("fred".into())),
                    org: Some(Literal::Plain("bloop".into())),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("grub".into())),
                    org: Some(Literal::Plain("bloop".into())),
                    ..Query::default()
                },
            ]
        );
    }

    #[test]
    fn complex_nested_combinators_parse() {
        assert_eq!(
            parse("(((repo:foo xyz) or repo:abc) (repo:fred or repo:grub) org:bloop)").unwrap(),
            vec![
                Query {
                    repo: Some(Literal::Plain("fred".into())),
                    org: Some(Literal::Plain("bloop".into())),
                    target: Some(Target::Content(Literal::Plain("xyz".into()))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("grub".into())),
                    org: Some(Literal::Plain("bloop".into())),
                    target: Some(Target::Content(Literal::Plain("xyz".into()))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("fred".into())),
                    org: Some(Literal::Plain("bloop".into())),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("grub".into())),
                    org: Some(Literal::Plain("bloop".into())),
                    ..Query::default()
                },
            ],
        );
    }

    #[test]
    fn complex_multiple_parse_types() {
        assert_eq!(
            parse("(repo:bloop or repo:google) Parser or repo:zoekt Parsing or (symbol:Compiler or (org:bloop repo:enterprise-search))").unwrap(),
            vec![
                Query {
                    repo: Some(Literal::Plain("bloop".into())),
                    target: Some(Target::Content(Literal::Plain("Parser".into()))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("google".into())),
                    target: Some(Target::Content(Literal::Plain("Parser".into()))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("zoekt".into())),
                    target: Some(Target::Content(Literal::Plain("Parsing".into()))),
                    ..Query::default()
                },
                Query {
                    target: Some(Target::Symbol(Literal::Plain("Compiler".into()))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain("enterprise-search".into())),
                    org: Some(Literal::Plain("bloop".into())),
                    ..Query::default()
                },
            ],
        );
    }

    #[test]
    fn slash_in_path() {
        assert_eq!(
            parse("path:foo/bar.js").unwrap(),
            vec![Query {
                path: Some(Literal::Plain("foo/bar.js".into())),
                ..Query::default()
            }],
        );
    }

    #[test]
    fn literal_join_as_regex() {
        let out = Literal::Plain("foo".into()).join_as_regex(Literal::Plain("bar".into()));
        assert_eq!(out, Literal::Regex("foo\\s+bar".into()));

        let out = Literal::Regex("f(oo)".into()).join_as_regex(Literal::Regex("(bar|quux)".into()));
        assert_eq!(out, Literal::Regex("f(oo)\\s+(bar|quux)".into()));

        // Test escaping.
        let out = Literal::Plain("f(oo)".into()).join_as_regex(Literal::Plain("(bar|quux)".into()));
        assert_eq!(out, Literal::Regex("f\\(oo\\)\\s+\\(bar\\|quux\\)".into()));
    }

    #[test]
    fn lang_path_filter() {
        assert_eq!(
            parse("lang:Rust path:server").unwrap(),
            vec![Query {
                path: Some(Literal::Plain("server".into())),
                lang: Some("rust".into()),
                ..Query::default()
            }],
        );
    }

    #[test]
    fn enable_open() {
        assert_eq!(
            parse("open:true path:server/bleep/Cargo.toml").unwrap(),
            vec![Query {
                open: Some(true),
                path: Some(Literal::Plain("server/bleep/Cargo.toml".into())),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("open:false path:server/bleep/Cargo.toml").unwrap(),
            vec![Query {
                open: Some(false),
                path: Some(Literal::Plain("server/bleep/Cargo.toml".into())),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("path:server/bleep/Cargo.toml").unwrap(),
            vec![Query {
                open: None,
                path: Some(Literal::Plain("server/bleep/Cargo.toml".into())),
                ..Query::default()
            }],
        );
    }

    #[test]
    fn special_chars() {
        assert_eq!(
            parse("foo\\nbar\\tquux").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain("foo\\nbar\\tquux".into()))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("/^\\b\\B\\w\\Wfoo\\d\\D$/").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Regex(
                    "^\\b\\B\\w\\Wfoo\\d\\D$".into()
                ))),
                ..Query::default()
            }],
        );
    }

    #[test]
    fn test_global_regex() {
        assert_eq!(
            parse("global_regex:true foo").unwrap(),
            vec![Query {
                global_regex: Some(true),
                target: Some(Target::Content(Literal::Regex("foo".into()))),
                ..Query::default()
            }],
        );

        // Don't conflict with per-term regexes.
        assert_eq!(
            parse("global_regex:true /foo/").unwrap(),
            vec![Query {
                global_regex: Some(true),
                target: Some(Target::Content(Literal::Regex("foo".into()))),
                ..Query::default()
            }],
        );

        // Lack of the flag should result in a `None` value.
        assert_eq!(
            parse("foo").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain("foo".into()))),
                ..Query::default()
            }],
        );

        // Can only apply this flag at the top-level, not inside groups.
        assert!(parse("(global_regex:true foo)").is_err());

        // Later uses at the top-level override previous uses.
        assert_eq!(
            parse("global_regex:false org:bloopai repo:bloop path:server foo or repo:google bar global_regex:true").unwrap(),
            vec![
                Query {
                    global_regex: Some(true),
                    org: Some(Literal::Regex("bloopai".into())),
                    repo: Some(Literal::Regex("bloop".into())),
                    path: Some(Literal::Regex("server".into())),
                    target: Some(Target::Content(Literal::Regex("foo".into()))),
                    ..Query::default()
                },
                Query {
                    global_regex: Some(true),
                    repo: Some(Literal::Regex("google".into())),
                    target: Some(Target::Content(Literal::Regex("bar".into()))),
                    ..Query::default()
                },
            ],
        );

        // Make sure that later values of `false` override previous values of `true`.
        assert_eq!(
            parse("global_regex:true foo or bar global_regex:false").unwrap(),
            vec![
                Query {
                    global_regex: Some(false),
                    target: Some(Target::Content(Literal::Plain("foo".into()))),
                    ..Query::default()
                },
                Query {
                    global_regex: Some(false),
                    target: Some(Target::Content(Literal::Plain("bar".into()))),
                    ..Query::default()
                },
            ],
        );
    }

    #[test]
    fn case_ignore_affinity() {
        // `case:` is special, it binds globally to the entire query string.

        assert_eq!(
            parse("foo or bar case:ignore").unwrap(),
            vec![
                Query {
                    case_sensitive: Some(false),
                    target: Some(Target::Content(Literal::Plain("foo".into()))),
                    ..Query::default()
                },
                Query {
                    case_sensitive: Some(false),
                    target: Some(Target::Content(Literal::Plain("bar".into()))),
                    ..Query::default()
                },
            ],
        );

        assert_eq!(
            parse("foo or bar case:ignore").unwrap(),
            parse("case:ignore foo or bar").unwrap(),
        );

        assert_eq!(
            parse("foo or bar case:ignore").unwrap(),
            parse("case:sensitive foo or bar case:ignore").unwrap(),
        );
    }

    #[test]
    fn or_prefix() {
        assert_eq!(
            parse("org").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain("org".into()))),
                ..Query::default()
            },],
        );

        assert_eq!(
            parse("org or orange").unwrap(),
            vec![
                Query {
                    target: Some(Target::Content(Literal::Plain("org".into()))),
                    ..Query::default()
                },
                Query {
                    target: Some(Target::Content(Literal::Plain("orange".into()))),
                    ..Query::default()
                },
            ],
        );
    }

    #[test]
    fn or_suffix() {
        assert_eq!(
            parse("for").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain("for".into()))),
                ..Query::default()
            },],
        );

        assert_eq!(
            parse("for or error").unwrap(),
            vec![
                Query {
                    target: Some(Target::Content(Literal::Plain("for".into()))),
                    ..Query::default()
                },
                Query {
                    target: Some(Target::Content(Literal::Plain("error".into()))),
                    ..Query::default()
                },
            ],
        );
    }

    #[test]
    fn test_complex_parse() {
        let mut q = parse(r#"(?:[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])"#).unwrap();

        // Make sure that this regex successfully compiles.
        q[0].target
            .take()
            .unwrap()
            .content()
            .unwrap()
            .regex()
            .unwrap();
    }

    #[test]
    fn nl_parse() {
        assert_eq!(
            parse_nl("what is background color? lang:tsx repo:bloop").unwrap(),
            ParsedQuery::Semantic(SemanticQuery {
                target: Some(Literal::Plain("what is background color?".into())),
                langs: ["tsx".into()].into(),
                repos: [Literal::Plain("bloop".into())].into(),
                paths: [].into(),
                branch: [].into()
            }),
        );
    }

    #[test]
    fn nl_parse_dedup_similar_filters() {
        let ParsedQuery::Semantic(q) =
            parse_nl("what is background color? lang:tsx repo:bloop repo:bloop").unwrap() else {
		panic!("down with this sorta thing")
	    };
        assert_eq!(q.repos().count(), 1);
    }

    #[test]
    fn nl_parse_multiple_filters() {
        assert_eq!(
            parse_nl("what is background color? lang:tsx lang:ts repo:bloop repo:bar path:server/bleep repo:baz")
                .unwrap(),
            ParsedQuery::Semantic(SemanticQuery {
                target: Some(Literal::Plain("what is background color?".into())),
                langs: ["tsx".into(), "typescript".into()].into(),
                branch: [].into(),
                repos: [
                    Literal::Plain("bloop".into()),
                    Literal::Plain("bar".into()),
                    Literal::Plain("baz".into())
                ]
                .into(),
                paths: [Literal::Plain("server/bleep".into())].into(),
            })
        );
    }

    #[test]
    fn nl_consume_flags() {
        assert_eq!(
            parse_nl(
                "what is background color? lang:tsx repo:bloop org:bloop symbol:foo open:true"
            )
            .unwrap(),
            ParsedQuery::Semantic(SemanticQuery {
                target: Some(Literal::Plain("what is background color?".into())),
                langs: ["tsx".into()].into(),
                repos: [Literal::Plain("bloop".into())].into(),
                paths: [].into(),
                branch: [].into(),
            })
        );

        assert_eq!(
            parse_nl("case:ignore why are languages excluded from ctags? branch:main").unwrap(),
            ParsedQuery::Semantic(SemanticQuery {
                target: Some(Literal::Plain(
                    "why are languages excluded from ctags?".into()
                )),
                branch: [Literal::Plain("main".into())].into(),
                ..Default::default()
            })
        );
    }

    // NL queries should permit arbitrary text in the `target` field, such as `(` and `|`
    #[test]
    fn nl_parse_arbitrary_text() {
        let queries = [
            "explain analytics (in the frontend)",
            "repo:bloop path:server start the server",
            ":613330{})/.[|^%@!Z",
        ];
        for q in queries {
            assert!(parse_nl(q).is_ok());
        }
    }

    #[test]
    fn escape_characters() {
        assert_eq!(
            parse("'foo\\'bar'").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain("foo'bar".into()))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse(r#""foo\"bar""#).unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain("foo\"bar".into()))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("/foo\\/bar/").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Regex("foo/bar".into()))),
                ..Query::default()
            }],
        );
    }
}
