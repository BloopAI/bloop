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
    pub(crate) fn patch(&self, old: Option<&BranchFilterConfig>) -> Option<BranchFilterConfig> {
        let Some(BranchFilterConfig::Select(ref old_list)) = old
        else {
	    return Some(self.clone());
	};

        let BranchFilterConfig::Select(new_list) = self
        else {
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
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct FileFilterConfig {
    rules: Vec<FileFilterRule>,
}

/// Rules for what gets included in a repository
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum FileFilterRule {
    /// Include file with the exact relative path
    IncludeFile { name: String },

    /// Include files matching the regex pattern
    IncludeRegex { pattern: String },

    /// Exclude file with the exact relative path
    ExcludeFile { name: String },

    /// Exclude files matchin the regex pattern
    ExcludeRegex { pattern: String },
}

/// Compiled file filter.
pub struct FileFilter {
    exclude_list: HashSet<String>,
    include_list: HashSet<String>,
    exclude_patterns: RegexSet,
    include_patterns: RegexSet,
}

impl FileFilter {
    pub fn compile(config: FileFilterConfig) -> anyhow::Result<Self> {
        let mut exclude_list = HashSet::new();
        let mut include_list = HashSet::new();
        let mut exclude_patterns = HashSet::new();
        let mut include_patterns = HashSet::new();

        for rule in config.rules {
            match rule {
                FileFilterRule::IncludeFile { name } => include_list.insert(name),
                FileFilterRule::IncludeRegex { pattern } => include_patterns.insert(pattern),
                FileFilterRule::ExcludeFile { name } => exclude_list.insert(name),
                FileFilterRule::ExcludeRegex { pattern } => exclude_patterns.insert(pattern),
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
    pub fn is_allowed<P: AsRef<Path> + ?Sized>(&self, path: &P) -> Option<bool> {
        let lossy = path.as_ref().to_string_lossy();
        let name = lossy.as_ref();

        if self.exclude_list.contains(name) || self.exclude_patterns.is_match(name) {
            Some(false)
        } else if self.include_list.contains(name) || self.include_patterns.is_match(name) {
            Some(true)
        } else {
            None
        }
    }
}

impl From<&FileFilterConfig> for FileFilter {
    fn from(config: &FileFilterConfig) -> Self {
        Self::compile(config.clone()).unwrap()
    }
}
