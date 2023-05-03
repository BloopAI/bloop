/// A continually updated conversation exchange.
///
/// This contains the query from the user, the intermediate steps the model takes, and the final
/// conclusion from the model alongside results, if any.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Default)]
pub struct Exchange {
    finished: bool,
    conclusion: Option<String>,
    search_steps: Vec<SearchStep>,
    results: Vec<SearchResult>,
}

impl Exchange {
    /// Advance this exchange.
    ///
    /// This should always be additive. An update should not result in fewer search results or fewer
    /// search steps.
    pub fn apply_update(&mut self, update: Update) {
        match update {
            Update::Step(search_step) => self.search_steps.push(search_step),
            Update::Result(search_results) => self.set_results(search_results),
        }
    }

    /// Get the query associated with this exchange, if it has been made.
    pub fn query(&self) -> Option<&str> {
        self.search_steps.iter().find_map(|step| match step {
            SearchStep::Query(q) => Some(q.as_str()),
            _ => None,
        })
    }

    /// Set the current search result list.
    fn set_results(&mut self, mut results: Vec<SearchResult>) {
        // fish out the conclusion from the result list, if any
        let conclusion = results
            .iter()
            .position(SearchResult::is_conclusion)
            .and_then(|idx| results.remove(idx).conclusion());

        if conclusion.is_some() {
            self.finished = true;
        }

        // we always want the results to be additive, however
        // some updates may result in fewer number of search results
        //
        // this can occur when the partially parsed json is not
        // sufficient to produce a search result (as in the case of a ModifyResult)
        //
        // we only update the search results when the latest update
        // gives us more than what we already have
        if self.results.len() <= results.len() {
            self.results = results;
        }

        self.conclusion = conclusion;
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "UPPERCASE", tag = "type", content = "content")]
#[non_exhaustive]
pub enum SearchStep {
    Query(String),
    Path(String),
    Code(String),
    Check(String),
    File(String),
    Prompt(String),
}

#[derive(Debug)]
pub enum Update {
    Step(SearchStep),
    Result(Vec<SearchResult>),
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub enum SearchResult {
    Cite(CiteResult),
    New(NewResult),
    Modify(ModifyResult),
    Conclude(ConcludeResult),
}

impl SearchResult {
    pub fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let tag = v.first()?;

        match tag.as_str()? {
            "cite" => CiteResult::from_json_array(&v[1..]).map(Self::Cite),
            "new" => NewResult::from_json_array(&v[1..]).map(Self::New),
            "mod" => ModifyResult::from_json_array(&v[1..]).map(Self::Modify),
            "con" => ConcludeResult::from_json_array(&v[1..]).map(Self::Conclude),
            _ => None,
        }
    }

    fn is_conclusion(&self) -> bool {
        matches!(self, Self::Conclude(..))
    }

    fn conclusion(self) -> Option<String> {
        match self {
            Self::Conclude(ConcludeResult { comment }) => comment,
            _ => None,
        }
    }

    pub fn substitute_path_alias(self, path_aliases: &[String]) -> Self {
        match self {
            Self::Cite(cite) => Self::Cite(cite.substitute_path_alias(path_aliases)),
            Self::Modify(mod_) => Self::Modify(mod_.substitute_path_alias(path_aliases)),
            s => s,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
pub struct CiteResult {
    #[serde(skip)]
    path_alias: Option<u64>,
    path: Option<String>,
    comment: Option<String>,
    start_line: Option<u64>,
    end_line: Option<u64>,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
pub struct NewResult {
    language: Option<String>,
    code: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
pub struct ModifyResult {
    #[serde(skip)]
    path_alias: Option<u64>,
    path: Option<String>,
    language: Option<String>,
    diff: Option<ModifyResultHunk>,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
struct ModifyResultHunk {
    header: Option<ModifyResultHunkHeader>,
    lines: Vec<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
struct ModifyResultHunkHeader {
    old_start: Option<usize>,
    old_lines: Option<usize>,
    new_start: Option<usize>,
    new_lines: Option<usize>,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug, Clone)]
pub struct ConcludeResult {
    comment: Option<String>,
}

impl CiteResult {
    fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let path_alias = v.get(0).and_then(serde_json::Value::as_u64);
        let comment = v
            .get(1)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        let start_line = v.get(2).and_then(serde_json::Value::as_u64);
        let end_line = v.get(3).and_then(serde_json::Value::as_u64);

        Some(Self {
            path_alias,
            comment,
            start_line,
            end_line,
            ..Default::default()
        })
    }

    fn substitute_path_alias(mut self, path_aliases: &[String]) -> Self {
        self.path = self
            .path_alias
            .as_ref()
            .and_then(|alias| path_aliases.get(*alias as usize))
            .map(ToOwned::to_owned);
        self
    }
}

impl NewResult {
    fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let language = v
            .get(0)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        let code = v
            .get(1)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        Some(Self { language, code })
    }
}

impl ModifyResult {
    fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let path_alias = v.get(0).and_then(serde_json::Value::as_u64);
        let language = v
            .get(1)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        let diff = v
            .get(2)
            .and_then(serde_json::Value::as_str)
            .map(|raw_hunk| {
                let header = raw_hunk.lines().next().and_then(|s| s.parse().ok());
                let lines = raw_hunk
                    .lines()
                    .skip(1)
                    .map(ToOwned::to_owned)
                    .collect::<Vec<_>>();
                ModifyResultHunk { header, lines }
            });

        Some(Self {
            path_alias,
            language,
            diff,
            ..Default::default()
        })
    }

    fn substitute_path_alias(mut self, path_aliases: &[String]) -> Self {
        self.path = self
            .path_alias
            .as_ref()
            .and_then(|alias| {
                if let Some(p) = path_aliases.get(*alias as usize) {
                    Some(p)
                } else {
                    tracing::warn!("no path found for alias `{alias}`");
                    for (idx, p) in path_aliases.iter().enumerate() {
                        tracing::warn!("we have {idx}. {p}");
                    }
                    None
                }
            })
            .map(ToOwned::to_owned);
        self
    }
}

impl std::str::FromStr for ModifyResultHunkHeader {
    type Err = ();

    // a header looks like
    //
    //     @@ -98,20 +98,12 @@
    //
    // we want:
    //
    //     old_start: 98
    //     old_lines: 20
    //     new_start: 98
    //     old_lines: 12
    //
    // this conversion method permits partially complete headers
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.trim();

        if !s.starts_with("@@") {
            return Err(());
        }

        let s = &s[2..s.len()].trim();
        let parts: Vec<&str> = s.split_whitespace().collect();

        // we need atleast one part
        if parts.is_empty() {
            return Err(());
        }

        let parse_part = |part: &str| -> (Option<usize>, Option<usize>) {
            let mut numbers = part.split(',');
            let start = numbers.next().and_then(|s| s.parse::<usize>().ok());
            let lines = numbers.next().and_then(|s| s.parse::<usize>().ok());
            (start, lines)
        };

        let (old_start, old_lines) = parts
            .first()
            .map(|s| s.trim_start_matches('-'))
            .map(parse_part)
            .unwrap_or_default();
        let (new_start, new_lines) = parts
            .get(1)
            .map(|s| s.trim_start_matches('+'))
            .map(parse_part)
            .unwrap_or_default();

        Ok(Self {
            old_start,
            old_lines,
            new_start,
            new_lines,
        })
    }
}

impl ConcludeResult {
    fn from_json_array(v: &[serde_json::Value]) -> Option<Self> {
        let comment = v
            .get(0)
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned);
        Some(Self { comment })
    }
}
