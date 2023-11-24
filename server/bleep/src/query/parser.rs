use pest::{iterators::Pair, Parser};
use regex::Regex;
use smallvec::{smallvec, SmallVec};
use std::{borrow::Cow, mem, ops::Deref};

#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct Query<'a> {
    pub open: Option<bool>,
    pub case_sensitive: Option<bool>,
    pub global_regex: Option<bool>,

    pub org: Option<Literal<'a>>,
    pub repo: Option<Literal<'a>>,
    pub path: Option<Literal<'a>>,
    pub lang: Option<Literal<'a>>,
    pub branch: Option<Literal<'a>>,
    pub target: Option<Target<'a>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum Target<'a> {
    Symbol(Literal<'a>),
    Content(Literal<'a>),
}

#[derive(Default, Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct SemanticQuery<'a> {
    pub raw_query: String,
    pub repos: Vec<Literal<'a>>,
    pub paths: Vec<Literal<'a>>,
    pub langs: Vec<Literal<'a>>,
    pub branch: Vec<Literal<'a>>,
    pub target: Option<Literal<'a>>,
}

impl<'a> SemanticQuery<'a> {
    pub fn repos(&'a self) -> impl Iterator<Item = Cow<'a, str>> {
        self.repos.iter().filter_map(|t| t.as_plain())
    }

    pub fn paths(&'a self) -> impl Iterator<Item = Cow<'a, str>> {
        self.paths.iter().filter_map(|t| t.as_plain())
    }

    pub fn langs(&'a self) -> impl Iterator<Item = Cow<'a, str>> {
        self.langs.iter().filter_map(|t| t.as_plain())
    }

    pub fn target(&self) -> Option<Cow<'a, str>> {
        self.target.as_ref().and_then(|t| t.as_plain())
    }

    pub fn branch(&'a self) -> impl Iterator<Item = Cow<'a, str>> {
        self.branch.iter().filter_map(|t| t.as_plain())
    }

    // TODO (@calyptobai): This is a quirk of the current conversation logic. We take only the
    // first branch because the UX operates on a single "current" branch. We can likely update
    // `SemanticQuery` to remove multiple branches altogether.
    pub fn first_branch(&self) -> Option<Cow<'_, str>> {
        self.branch.first().map(|t| t.clone().unwrap())
    }

    // Ditto for repo
    pub fn first_repo(&self) -> Option<Cow<'_, str>> {
        self.repos.first().map(|t| t.clone().unwrap())
    }

    pub fn from_str(query: String, repo_ref: String) -> Self {
        Self {
            target: Some(Literal::Plain(query.into())),
            repos: [Literal::Plain(repo_ref.into())].into(),
            ..Default::default()
        }
    }

    pub fn into_owned(self) -> SemanticQuery<'static> {
        SemanticQuery {
            raw_query: self.raw_query.clone(),
            repos: self.repos.into_iter().map(Literal::into_owned).collect(),
            paths: self.paths.into_iter().map(Literal::into_owned).collect(),
            langs: self.langs.into_iter().map(Literal::into_owned).collect(),
            branch: self.branch.into_iter().map(Literal::into_owned).collect(),
            target: self.target.map(Literal::into_owned),
        }
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
        // defaults to false if unset
        self.case_sensitive.unwrap_or_default()
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
    pub fn literal_mut(&'a mut self) -> &mut Literal<'a> {
        match self {
            Self::Symbol(lit) => lit,
            Self::Content(lit) => lit,
        }
    }

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

#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub enum Literal<'a> {
    Plain(LiteralInner<'a>),
    Regex(LiteralInner<'a>),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct LiteralInner<'a> {
    start: usize,
    end: usize,
    content: Cow<'a, str>,
}

impl<'a> LiteralInner<'a> {
    fn new(start: usize, end: usize, content: impl Into<Cow<'a, str>>) -> Self {
        Self {
            start,
            end,
            content: content.into(),
        }
    }

    fn to_owned(&self) -> LiteralInner<'static> {
        LiteralInner {
            start: self.start,
            end: self.end,
            content: Cow::Owned(self.content.to_string()),
        }
    }
}

impl<'a, T: AsRef<str>> From<T> for LiteralInner<'a> {
    fn from(value: T) -> Self {
        Self {
            start: 0,
            end: 0,
            content: value.as_ref().to_owned().into(),
        }
    }
}

impl<'a> Deref for LiteralInner<'a> {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        self.content.as_ref()
    }
}

impl<'a> Default for LiteralInner<'a> {
    fn default() -> Self {
        Self {
            start: 0,
            end: 0,
            content: Cow::Borrowed(""),
        }
    }
}

impl<'a> From<Cow<'a, str>> for Literal<'a> {
    fn from(value: Cow<'a, str>) -> Self {
        Literal::Plain(value.clone().into())
    }
}

impl From<&String> for Literal<'static> {
    fn from(value: &String) -> Self {
        Literal::Plain(value.to_owned().into())
    }
}

impl From<&str> for Literal<'static> {
    fn from(value: &str) -> Self {
        Literal::Plain(value.to_owned().into())
    }
}

impl<'a> Default for Literal<'a> {
    fn default() -> Self {
        Literal::Plain(Default::default())
    }
}

impl<'a> Literal<'a> {
    /// This drops position information, as it's not intelligible after the merge
    fn join_as_regex(self, rhs: Self) -> Literal<'static> {
        let lhs = self.regex_str();
        let rhs = rhs.regex_str();
        Literal::Regex(format!("{lhs}\\s+{rhs}").into())
    }

    /// This drops position information, as it's not intelligible after the merge
    #[allow(dead_code)]
    fn join_as_plain(self, rhs: Self) -> Option<Literal<'static>> {
        let lhs = self.as_plain()?;
        let rhs = rhs.as_plain()?;
        Some(Literal::Plain(format!("{lhs} {rhs}").into()))
    }

    /// Convert this literal into a regex string.
    ///
    /// If this literal is a regex, it is returned as-is. If it is a plain text literal, it is
    /// escaped first before returning.
    pub fn regex_str(&self) -> Cow<'a, str> {
        match self {
            Self::Plain(text) => regex::escape(text).into(),
            Self::Regex(r) => r.content.clone(),
        }
    }

    pub fn regex(&self) -> Result<Regex, regex::Error> {
        Regex::new(&self.regex_str())
    }

    pub fn as_plain(&self) -> Option<Cow<'a, str>> {
        match self {
            Self::Plain(p) => Some(p.content.clone()),
            Self::Regex(..) => None,
        }
    }

    /// Force this literal into the `Regex` variant.
    fn make_regex(&mut self) {
        *self = match std::mem::take(self) {
            Self::Plain(s) | Self::Regex(s) => Self::Regex(s),
        }
    }

    pub fn unwrap(self) -> Cow<'a, str> {
        match self {
            Literal::Plain(v) => v.content,
            Literal::Regex(v) => v.content,
        }
    }

    pub fn into_owned(self) -> Literal<'static> {
        match self {
            Literal::Plain(cow) => Literal::Plain(cow.to_owned()),
            Literal::Regex(cow) => Literal::Regex(cow.to_owned()),
        }
    }

    pub fn start(&self) -> usize {
        match self {
            Literal::Plain(inner) => inner.start,
            Literal::Regex(inner) => inner.start,
        }
    }
}

impl<'a> From<Pair<'a, Rule>> for Literal<'a> {
    fn from(pair: Pair<'a, Rule>) -> Self {
        let start = pair.as_span().start();
        let end = pair.as_span().end();

        match pair.as_rule() {
            Rule::unquoted_literal => {
                Self::Plain(LiteralInner::new(start, end, pair.as_str().trim()))
            }
            Rule::quoted_literal => {
                Self::Plain(LiteralInner::new(start, end, unescape(pair.as_str(), '"')))
            }
            Rule::single_quoted_literal => {
                Self::Plain(LiteralInner::new(start, end, unescape(pair.as_str(), '\'')))
            }
            Rule::regex_quoted_literal => {
                Self::Regex(LiteralInner::new(start, end, unescape(pair.as_str(), '/')))
            }
            Rule::raw_text => Self::Plain(LiteralInner::new(start, end, pair.as_str().trim())),
            _ => unreachable!(),
        }
    }
}

impl<'a, 'b: 'a> AsRef<Cow<'a, str>> for Literal<'b> {
    fn as_ref(&self) -> &Cow<'a, str> {
        match self {
            Literal::Plain(inner) => &inner.content,
            Literal::Regex(inner) => &inner.content,
        }
    }
}

impl Deref for Literal<'_> {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        match self {
            Literal::Plain(inner) => inner.as_ref(),
            Literal::Regex(inner) => inner.as_ref(),
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

#[derive(Debug, PartialEq, Clone)]
enum Expr<'a> {
    Or(Vec<Expr<'a>>),
    And(Vec<Expr<'a>>),

    Org(Literal<'a>),
    Repo(Literal<'a>),
    Symbol(Literal<'a>),
    Path(Literal<'a>),
    Lang(Literal<'a>),
    Content(Literal<'a>),
    Branch(Literal<'a>),

    CaseSensitive(bool),
    Open(bool),
    GlobalRegex(bool),
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
            Rule::lang => Lang(Literal::from(pair.into_inner().next().unwrap())),

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

pub fn parse_nl(query: &str) -> Result<SemanticQuery<'_>, ParseError> {
    let raw_query = query.to_string();
    let mut target = "".to_string();

    let pairs = PestParser::parse(Rule::nl_query, query).map_err(Box::new)?;

    let mut repos = Vec::new();
    let mut paths = Vec::new();
    let mut langs = Vec::new();
    let mut branch = Vec::new();

    let mut extend_query = |q: &str| {
        if !target.is_empty() {
            target += " ";
        }
        target += q;
    };

    for pair in pairs {
        match pair.as_rule() {
            Rule::repo => {
                let item = Literal::from(pair.into_inner().next().unwrap());
                repos.push(item);
            }
            Rule::path => {
                let item = Literal::from(pair.into_inner().next().unwrap());
                extend_query(&item);
                paths.push(item);
            }
            Rule::branch => {
                let item = Literal::from(pair.into_inner().next().unwrap());
                branch.push(item);
            }
            Rule::lang => {
                let inner = pair.into_inner().next().unwrap();
                let item = Literal::Plain(LiteralInner {
                    content: super::languages::parse_alias(inner.as_str()),
                    start: inner.as_span().start(),
                    end: inner.as_span().end(),
                });

                extend_query(&item);
                langs.push(item);
            }
            Rule::raw_text => {
                let rhs = Literal::from(pair);
                extend_query(&rhs);
            }
            _ => {}
        }
    }

    Ok(SemanticQuery {
        raw_query,
        repos,
        paths,
        langs,
        branch,
        target: if target.is_empty() {
            None
        } else {
            Some(Literal::from(&target))
        },
    })
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
            lang: Some(super::languages::parse_alias(&lang).into()),
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
                target: Some(Target::Content(Literal::Plain(LiteralInner {
                    start: 0,
                    end: 10,
                    content: "ParseError".into()
                }))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("org:bloopai repo:enterprise-search branch:origin/main ParseError").unwrap(),
            vec![Query {
                repo: Some(Literal::Plain(LiteralInner {
                    start: 17,
                    end: 34,
                    content: "enterprise-search".into()
                })),
                org: Some(Literal::Plain(LiteralInner {
                    start: 4,
                    end: 11,
                    content: "bloopai".into()
                })),
                branch: Some(Literal::Plain(LiteralInner {
                    start: 42,
                    end: 53,
                    content: "origin/main".into()
                })),
                target: Some(Target::Content(Literal::Plain(LiteralInner {
                    start: 54,
                    end: 64,
                    content: "ParseError".into()
                }))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("org:bloopai repo:enterprise-search ParseError").unwrap(),
            vec![Query {
                repo: Some(Literal::Plain(LiteralInner {
                    start: 17,
                    end: 34,
                    content: "enterprise-search".into()
                })),
                org: Some(Literal::Plain(LiteralInner {
                    start: 4,
                    end: 11,
                    content: "bloopai".into()
                })),
                target: Some(Target::Content(Literal::Plain(LiteralInner {
                    start: 35,
                    end: 45,
                    content: "ParseError".into()
                }))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("content:ParseError").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain(LiteralInner {
                    start: 8,
                    end: 18,
                    content: "ParseError".into()
                }))),
                ..Query::default()
            }],
        );

        // Here the last target operator takes precedence. Should we return an error instead?
        assert_eq!(
            parse("path:foo.c create_foo symbol:bar").unwrap(),
            vec![Query {
                path: Some(Literal::Plain(LiteralInner {
                    start: 5,
                    end: 10,
                    content: "foo.c".into()
                })),
                target: Some(Target::Symbol(Literal::Plain(LiteralInner {
                    start: 29,
                    end: 32,
                    content: "bar".into()
                }))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("case:ignore Parse").unwrap(),
            vec![Query {
                case_sensitive: Some(false),
                target: Some(Target::Content(Literal::Plain(LiteralInner {
                    start: 12,
                    end: 17,
                    content: "Parse".into()
                }))),
                ..Query::default()
            }],
        );
    }

    #[test]
    fn intersection_parse() {
        assert_eq!(
            parse("repo:foo ParseError or repo:bar").unwrap(),
            vec![
                Query {
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 5,
                        end: 8,
                        content: "foo".into()
                    })),
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 9,
                        end: 19,
                        content: "ParseError".into()
                    }))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 28,
                        end: 31,
                        content: "bar".into()
                    })),
                    ..Query::default()
                },
            ],
        );

        // Flip the intersection order.
        assert_eq!(
            parse("repo:bar or repo:foo ParseError").unwrap(),
            vec![
                Query {
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 5,
                        end: 8,
                        content: "bar".into()
                    })),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 17,
                        end: 20,
                        content: "foo".into()
                    })),
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 21,
                        end: 31,
                        content: "ParseError".into()
                    }))),
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
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 36,
                        end: 40,
                        content: "fred".into()
                    })),
                    org: Some(Literal::Plain(LiteralInner {
                        start: 59,
                        end: 64,
                        content: "bloop".into()
                    })),
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 12,
                        end: 15,
                        content: "xyz".into()
                    }))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 49,
                        end: 53,
                        content: "grub".into()
                    })),
                    org: Some(Literal::Plain(LiteralInner {
                        start: 59,
                        end: 64,
                        content: "bloop".into()
                    })),
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 12,
                        end: 15,
                        content: "xyz".into()
                    }))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 36,
                        end: 40,
                        content: "fred".into()
                    })),
                    org: Some(Literal::Plain(LiteralInner {
                        start: 59,
                        end: 64,
                        content: "bloop".into()
                    })),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 49,
                        end: 53,
                        content: "grub".into()
                    })),
                    org: Some(Literal::Plain(LiteralInner {
                        start: 59,
                        end: 64,
                        content: "bloop".into()
                    })),
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
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 6,
                        end: 11,
                        content: "bloop".into()
                    })),
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 28,
                        end: 34,
                        content: "Parser".into()
                    }))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 20,
                        end: 26,
                        content: "google".into()
                    })),
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 28,
                        end: 34,
                        content: "Parser".into()
                    }))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 43,
                        end: 48,
                        content: "zoekt".into()
                    })),
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 49,
                        end: 56,
                        content: "Parsing".into()
                    }))),
                    ..Query::default()
                },
                Query {
                    target: Some(Target::Symbol(Literal::Plain(LiteralInner {
                        start: 68,
                        end: 76,
                        content: "Compiler".into()
                    }))),
                    ..Query::default()
                },
                Query {
                    repo: Some(Literal::Plain(LiteralInner {
                        start: 96,
                        end: 113,
                        content: "enterprise-search".into()
                    })),
                    org: Some(Literal::Plain(LiteralInner {
                        start: 85,
                        end: 90,
                        content: "bloop".into()
                    })),
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
                path: Some(Literal::Plain(LiteralInner {
                    start: 5,
                    end: 15,
                    content: "foo/bar.js".into(),
                })),
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
                path: Some(Literal::Plain(LiteralInner {
                    start: 15,
                    end: 21,
                    content: "server".into()
                })),
                lang: Some(Literal::Plain("rust".into())),
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
                path: Some(Literal::Plain(LiteralInner {
                    start: 15,
                    end: 38,
                    content: "server/bleep/Cargo.toml".into()
                })),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("open:false path:server/bleep/Cargo.toml").unwrap(),
            vec![Query {
                open: Some(false),
                path: Some(Literal::Plain(LiteralInner {
                    start: 16,
                    end: 39,
                    content: "server/bleep/Cargo.toml".into()
                })),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("path:server/bleep/Cargo.toml").unwrap(),
            vec![Query {
                open: None,
                path: Some(Literal::Plain(LiteralInner {
                    start: 5,
                    end: 28,
                    content: "server/bleep/Cargo.toml".into()
                })),
                ..Query::default()
            }],
        );
    }

    #[test]
    fn special_chars() {
        assert_eq!(
            parse("foo\\nbar\\tquux").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain(LiteralInner {
                    start: 0,
                    end: 14,
                    content: "foo\\nbar\\tquux".into()
                }))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("/^\\b\\B\\w\\Wfoo\\d\\D$/").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Regex(LiteralInner {
                    start: 1,
                    end: 18,
                    content: "^\\b\\B\\w\\Wfoo\\d\\D$".into()
                }))),
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
                target: Some(Target::Content(Literal::Regex(LiteralInner {
                    start: 18,
                    end: 21,
                    content: "foo".into()
                }))),
                ..Query::default()
            }],
        );

        // Don't conflict with per-term regexes.
        assert_eq!(
            parse("global_regex:true /foo/").unwrap(),
            vec![Query {
                global_regex: Some(true),
                target: Some(Target::Content(Literal::Regex(LiteralInner {
                    start: 19,
                    end: 22,
                    content: "foo".into()
                }))),
                ..Query::default()
            }],
        );

        // Lack of the flag should result in a `None` value.
        assert_eq!(
            parse("foo").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain(LiteralInner {
                    start: 0,
                    end: 3,
                    content: "foo".into()
                }))),
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
                    org: Some(Literal::Regex(LiteralInner {
                        start: 23,
                        end: 30,
                        content: "bloopai".into(),
                    })),
                    repo: Some(Literal::Regex(LiteralInner {
                        start: 36,
                        end: 41,
                        content: "bloop".into(),
                    })),
                    path: Some(Literal::Regex(LiteralInner {
                        start: 47,
                        end: 53,
                        content: "server".into(),
                    })),
                    target: Some(Target::Content(Literal::Regex(LiteralInner {
                        start: 54,
                        end: 57,
                        content: "foo".into(),
                    }))),
                    ..Query::default()
                },
                Query {
                    global_regex: Some(true),
                    repo: Some(Literal::Regex(LiteralInner {
                        start: 66,
                        end: 72,
                        content: "google".into(),
                    })),
                    target: Some(Target::Content(Literal::Regex(LiteralInner {
                        start: 73,
                        end: 76,
                        content: "bar".into(),
                    }))),
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
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 18,
                        end: 21,
                        content: "foo".into(),
                    }))),
                    ..Query::default()
                },
                Query {
                    global_regex: Some(false),
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 25,
                        end: 28,
                        content: "bar".into(),
                    }))),
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
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 0,
                        end: 3,
                        content: "foo".into()
                    }))),
                    ..Query::default()
                },
                Query {
                    case_sensitive: Some(false),
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 7,
                        end: 10,
                        content: "bar".into()
                    }))),
                    ..Query::default()
                },
            ],
        );
    }

    #[test]
    fn or_prefix() {
        assert_eq!(
            parse("org").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain(LiteralInner {
                    start: 0,
                    end: 3,
                    content: "org".into()
                }))),
                ..Query::default()
            },],
        );

        assert_eq!(
            parse("org or orange").unwrap(),
            vec![
                Query {
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 0,
                        end: 3,
                        content: "org".into()
                    }))),
                    ..Query::default()
                },
                Query {
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 7,
                        end: 13,
                        content: "orange".into()
                    }))),
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
                target: Some(Target::Content(Literal::Plain(LiteralInner {
                    start: 0,
                    end: 3,
                    content: "for".into()
                }))),
                ..Query::default()
            },],
        );

        assert_eq!(
            parse("for or error").unwrap(),
            vec![
                Query {
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 0,
                        end: 3,
                        content: "for".into()
                    }))),
                    ..Query::default()
                },
                Query {
                    target: Some(Target::Content(Literal::Plain(LiteralInner {
                        start: 7,
                        end: 12,
                        content: "error".into()
                    }))),
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
            SemanticQuery {
                raw_query: "what is background color? lang:tsx repo:bloop".to_string(),
                target: Some(Literal::Plain("what is background color? tsx".into())),
                langs: [Literal::Plain(LiteralInner {
                    start: 31,
                    end: 34,
                    content: "tsx".into()
                })]
                .into(),
                repos: [Literal::Plain(LiteralInner {
                    start: 40,
                    end: 45,
                    content: "bloop".into()
                })]
                .into(),
                paths: [].into(),
                branch: [].into()
            },
        );
    }

    #[test]
    fn nl_parse_dedup_similar_filters() {
        let q = parse_nl("what is background color? lang:tsx repo:bloop repo:bloop").unwrap();
        assert_eq!(q.repos().count(), 2);
    }

    #[test]
    fn nl_parse_multiple_filters() {
        assert_eq!(
            parse_nl("what is background color? lang:tsx lang:ts repo:bloop repo:bar path:server/bleep repo:baz").unwrap(),
            SemanticQuery {
                raw_query: "what is background color? lang:tsx lang:ts repo:bloop repo:bar path:server/bleep repo:baz".to_string(),
                target: Some(Literal::Plain("what is background color? tsx typescript server/bleep".into())),
                langs: [
                    Literal::Plain(LiteralInner {
                        start: 31,
                        end: 34,
                        content: "tsx".into()
                    }),
                    Literal::Plain(LiteralInner {
                        start: 40,
                        end: 42,
                        content: "typescript".into()
                    })
                ]
                .into(),
                branch: [].into(),
                repos: [
                    Literal::Plain(LiteralInner {
                        start: 48,
                        end: 53,
                        content: "bloop".into(),
                    }),
                    Literal::Plain(LiteralInner {
                        start: 59,
                        end: 62,
                        content: "bar".into(),
                    }),
                    Literal::Plain(LiteralInner {
                        start: 86,
                        end: 89,
                        content: "baz".into(),
                    }),
                ]
                .into(),
                paths: [Literal::Plain(LiteralInner {
                    start: 68,
                    end: 80,
                    content: "server/bleep".into(),
                })]
                .into(),
            },
        );
    }

    #[test]
    fn nl_consume_flags() {
        assert_eq!(
            parse_nl(
                "what is background color of lang:tsx files? repo:bloop org:bloop symbol:foo open:true"
            )
            .unwrap(),
            SemanticQuery {
                raw_query:
                    "what is background color of lang:tsx files? repo:bloop org:bloop symbol:foo open:true"
                        .to_string(),
                target: Some(Literal::Plain("what is background color of tsx files?".into())),
                langs: [Literal::Plain(LiteralInner {
                    start: 33,
                    end: 36,
                    content: "tsx".into()
                })]
                .into(),
                repos: [Literal::Plain(LiteralInner {
                    start: 49,
                    end: 54,
                    content: "bloop".into()
                })]
                .into(),
                paths: [].into(),
                branch: [].into(),
            }
        );

        assert_eq!(
            parse_nl("case:ignore why are languages excluded from ctags? branch:main").unwrap(),
            SemanticQuery {
                raw_query: "case:ignore why are languages excluded from ctags? branch:main"
                    .to_string(),
                target: Some(Literal::Plain(
                    "why are languages excluded from ctags?".into()
                )),
                branch: [Literal::Plain(LiteralInner {
                    start: 58,
                    end: 62,
                    content: "main".into()
                })]
                .into(),
                ..Default::default()
            }
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
                target: Some(Target::Content(Literal::Plain(LiteralInner {
                    start: 1,
                    end: 9,
                    content: "foo'bar".into()
                }))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse(r#""foo\"bar""#).unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Plain(LiteralInner {
                    start: 1,
                    end: 9,
                    content: "foo\"bar".into()
                }))),
                ..Query::default()
            }],
        );

        assert_eq!(
            parse("/foo\\/bar/").unwrap(),
            vec![Query {
                target: Some(Target::Content(Literal::Regex(LiteralInner {
                    start: 1,
                    end: 9,
                    content: "foo/bar".into()
                }))),
                ..Query::default()
            }],
        );
    }
}
