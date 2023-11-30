use std::{
    collections::{BTreeSet, HashSet},
    path::Path,
};

use regex::RegexSet;
use serde::{Deserialize, Serialize};

/// Update filter configs for a repository
#[derive(serde::Deserialize, Clone, Debug, Default)]
pub struct FilterUpdate {
    pub branch_filter: Option<BranchFilterConfig>,
    pub file_filter: Option<FileFilterConfig>,
}

/// Configure branch filters
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
#[serde(rename_all = "snake_case")]
pub enum BranchFilterConfig {
    All,
    Head,
    Select(Vec<String>),
}

impl BranchFilterConfig {
    /// Extend the existing list if `Select`, or override the branch config with the new one.
    pub(crate) fn patch_into(
        &self,
        old: Option<&BranchFilterConfig>,
    ) -> Option<BranchFilterConfig> {
        let Some(BranchFilterConfig::Select(ref old_list)) = old else {
            return Some(self.clone());
        };

        let BranchFilterConfig::Select(new_list) = self else {
            return Some(self.clone());
        };

        let mut updated = old_list.iter().collect::<BTreeSet<_>>();
        updated.extend(new_list);

        Some(BranchFilterConfig::Select(
            updated.into_iter().cloned().collect(),
        ))
    }
}

impl From<&BranchFilterConfig> for BranchFilter {
    fn from(value: &BranchFilterConfig) -> Self {
        match value {
            BranchFilterConfig::All => BranchFilter::All,
            BranchFilterConfig::Head => BranchFilter::Head,
            BranchFilterConfig::Select(regexes) => {
                let mut regexes = regexes.clone();
                regexes.push("HEAD".into());
                BranchFilter::Select(RegexSet::new(regexes).unwrap())
            }
        }
    }
}

/// Filter branches with simple rules or regexes.
pub enum BranchFilter {
    All,
    Head,
    Select(RegexSet),
}

impl BranchFilter {
    pub fn filter(&self, is_head: bool, branch: &str) -> bool {
        match self {
            BranchFilter::All => true,
            BranchFilter::Select(patterns) => is_head || patterns.is_match(branch),
            BranchFilter::Head => is_head,
        }
    }
}

impl Default for BranchFilter {
    fn default() -> Self {
        Self::Head
    }
}

/// Configure file filters
#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq, Eq)]
pub struct FileFilterConfig {
    pub(crate) rules: Vec<FileFilterRule>,
}

/// Rules for what gets included in a repository
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Hash, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FileFilterRule {
    /// Include file with the exact relative path
    IncludeFile(String),

    /// Include files matching the regex pattern
    IncludeRegex(String),

    /// Exclude file with the exact relative path
    ExcludeFile(String),

    /// Exclude files matchin the regex pattern
    ExcludeRegex(String),
}

impl FileFilterConfig {
    pub(crate) fn patch_into(&self, old: &FileFilterConfig) -> FileFilterConfig {
        let mut rules = old.rules.iter().cloned().collect::<HashSet<_>>();

        for rule in &self.rules {
            if rules.contains(rule) {
                continue;
            }

            match rule {
                r @ FileFilterRule::IncludeFile(f) => {
                    rules.remove(&FileFilterRule::ExcludeFile(f.to_string()));
                    rules.insert(r.clone());
                }
                r @ FileFilterRule::IncludeRegex(x) => {
                    rules.remove(&FileFilterRule::ExcludeRegex(x.to_string()));
                    rules.insert(r.clone());
                }
                r @ FileFilterRule::ExcludeFile(f) => {
                    rules.remove(&FileFilterRule::IncludeFile(f.to_string()));
                    rules.insert(r.clone());
                }
                r @ FileFilterRule::ExcludeRegex(x) => {
                    rules.remove(&FileFilterRule::IncludeRegex(x.to_string()));
                    rules.insert(r.clone());
                }
            }
        }

        Self {
            rules: rules.into_iter().collect(),
        }
    }
}

/// Compiled file filter.
pub struct FileFilter {
    exclude_list: HashSet<String>,
    include_list: HashSet<String>,
    exclude_patterns: RegexSet,
    include_patterns: RegexSet,
}

impl FileFilter {
    pub fn compile(config: &FileFilterConfig) -> anyhow::Result<Self> {
        let mut exclude_list = HashSet::new();
        let mut include_list = HashSet::new();
        let mut exclude_patterns = HashSet::new();
        let mut include_patterns = HashSet::new();

        for rule in &config.rules {
            match rule {
                FileFilterRule::IncludeFile(name) => include_list.insert(name.to_string()),
                FileFilterRule::IncludeRegex(pattern) => include_patterns.insert(pattern),
                FileFilterRule::ExcludeFile(name) => exclude_list.insert(name.to_string()),
                FileFilterRule::ExcludeRegex(pattern) => exclude_patterns.insert(pattern),
            };
        }

        Ok(Self {
            include_list,
            exclude_list,
            include_patterns: RegexSet::new(include_patterns)?,
            exclude_patterns: RegexSet::new(exclude_patterns)?,
        })
    }

    /// Returns:
    ///  * `Some(true)` if the file is allowed
    ///  * `Some(false)` if rejected
    ///  * `None` if not mentioned at all
    ///
    /// Includes must take priority.
    pub fn is_allowed<P: AsRef<Path> + ?Sized>(&self, path: &P) -> Option<bool> {
        let lossy = path.as_ref().to_string_lossy();
        let name = lossy.as_ref();

        if self.include_list.contains(name) || self.include_patterns.is_match(name) {
            Some(true)
        } else if self.exclude_list.contains(name) || self.exclude_patterns.is_match(name) {
            Some(false)
        } else {
            None
        }
    }
}

impl From<&FileFilterConfig> for FileFilter {
    fn from(value: &FileFilterConfig) -> Self {
        Self::compile(value).unwrap()
    }
}
