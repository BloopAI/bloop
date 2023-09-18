use std::collections::HashSet;

use anyhow::{Context, Result};
use futures::TryStreamExt;
use gix::{
    bstr::ByteSlice,
    diff::blob::{Algorithm, UnifiedDiffBuilder},
    object::{blob::diff::Platform, tree::diff::Action},
    objs::tree::EntryMode,
    Commit, Id,
};
use serde::Serialize;
use tracing::{error, trace};

use crate::{
    llm_gateway::{self, api::Message},
    repo::RepoRef,
    state::RepositoryPool,
};

#[derive(Default)]
pub struct DiffStat {
    modified_file_exts: HashSet<String>,
    modified_file_paths: HashSet<String>,
    num_file_insertions: usize,
    num_file_deletions: usize,
    num_line_insertions: usize,
    num_line_deletions: usize,
    commit_message: String,
    diff: String,
}

#[derive(Serialize, Debug)]
pub struct Question {
    pub question: String,
    pub tag: String,
}

#[derive(Debug)]
struct NoneError;

impl std::fmt::Display for NoneError {
    fn fmt(&self, _: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        unreachable!()
    }
}

impl std::error::Error for NoneError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        None
    }
}

struct CommitIterator<'a> {
    commit: Commit<'a>,
    parent: Option<Id<'a>>,
}

impl<'a> Iterator for CommitIterator<'a> {
    type Item = DiffStat;

    fn next(&mut self) -> Option<Self::Item> {
        let Some(parent_id) = self.parent
	else {
	    return None;
	};

        let parent_commit = parent_id.object().unwrap().into_commit();
        let mut stats = DiffStat::default();

        _ = self
            .commit
            .tree()
            .unwrap()
            .changes()
            .unwrap()
            .track_path()
            .for_each_to_obtain_tree(&parent_commit.tree().unwrap(), |change| {
                let ext = change
                    .location
                    .to_path_lossy()
                    .extension()
                    .map(|ext| ext.to_string_lossy().to_string());

                if let Some(ext) = ext {
                    stats.modified_file_exts.insert(ext);
                }

                let location = change.location.to_str_lossy();
                stats.modified_file_paths.insert(location.to_string());

                match &change.event {
                    gix::object::tree::diff::change::Event::Addition { entry_mode, id }
                        if matches!(entry_mode, EntryMode::Blob) =>
                    {
                        stats.num_file_insertions += 1;
                        add_diff(
                            &location,
                            "".into(),
                            id.object().unwrap().data.as_bstr().to_str_lossy(),
                            &mut stats,
                        );
                    }
                    gix::object::tree::diff::change::Event::Deletion { entry_mode, id }
                        if matches!(entry_mode, EntryMode::Blob) =>
                    {
                        stats.num_file_deletions += 1;
                        add_diff(
                            &location,
                            id.object().unwrap().data.as_bstr().to_str_lossy(),
                            "".into(),
                            &mut stats,
                        );
                    }
                    gix::object::tree::diff::change::Event::Rewrite {
                        source_id,
                        id,
                        diff: Some(diff),
                        entry_mode,
                        ..
                    } if matches!(entry_mode, EntryMode::Blob) => {
                        stats.num_line_deletions += diff.removals as usize;
                        stats.num_line_insertions += diff.insertions as usize;

                        let platform = Platform::from_ids(source_id, id).unwrap();
                        let old = platform.old.data.as_bstr().to_str_lossy();
                        let new = platform.new.data.as_bstr().to_str_lossy();
                        add_diff(&location, old, new, &mut stats);
                    }
                    gix::object::tree::diff::change::Event::Modification {
                        previous_entry_mode,
                        previous_id,
                        entry_mode,
                        id,
                    } if matches!(previous_entry_mode, EntryMode::Blob)
                        && matches!(entry_mode, EntryMode::Blob) =>
                    {
                        let platform = Platform::from_ids(previous_id, id).unwrap();
                        let old = platform.old.data.as_bstr().to_str_lossy();
                        let new = platform.new.data.as_bstr().to_str_lossy();
                        add_diff(&location, old, new, &mut stats);
                    }
                    _ => {}
                }

                Ok::<Action, NoneError>(Action::Continue)
            })
            .unwrap();

        stats.commit_message = self
            .commit
            .message_raw()
            .unwrap()
            .to_str_lossy()
            .to_string();

        self.commit = parent_commit;
        self.parent = self.commit.parent_ids().next();

        Some(stats)
    }
}

fn add_diff(
    location: &str,
    old: std::borrow::Cow<'_, str>,
    new: std::borrow::Cow<'_, str>,
    stats: &mut DiffStat,
) {
    let input = gix::diff::blob::intern::InternedInput::new(old.as_ref(), new.as_ref());
    stats.diff += &format!(
        r#"diff --git a/{location} b/{location}
--- a/{location}
+++ b/{location}
"#
    );

    stats.diff += gix::diff::blob::diff(
        Algorithm::Histogram,
        &input,
        UnifiedDiffBuilder::new(&input),
    )
    .as_str();
    stats.diff += "\n";
}

pub async fn expand_commits_to_suggestions(
    mut src_commits: Vec<DiffStat>,
    llm_gateway: &llm_gateway::Client,
) -> Result<Vec<Question>> {
    const NUM_QUESTION_SUGGESTIONS: usize = 5;
    const COMMIT_EXCLUDE_KEYWORDS: [&str; 7] = [
        "merge", "revert", "bump", "chore", "fix", "refactor", "docs",
    ];
    const COMMIT_EXCLUDE_EXTENSIONS: [&str; 7] =
        ["md", "txt", "json", "toml", "yml", "yaml", "rst"];

    let mut min_mod_files = 2usize;
    let mut max_mod_files = 15usize;
    let mut min_diff_lines = 100usize;

    let mut questions = vec![];
    while questions.len() < NUM_QUESTION_SUGGESTIONS {
        let drained;
        (drained, src_commits) = std::mem::take(&mut src_commits)
            .into_iter()
            .partition::<Vec<_>, _>(|commit| {
                // Skip commits where:
                //  - the message contains one of the COMMIT_EXCLUDE_KEYWORDS
                //  - all of the modified files are not in COMMIT_EXCLUDE_EXTENSIONS
                //  - the number of modified files is less than min_mod_files
                //  - the number of modified files is greater than max_mod_files
                //  - the number of diff lines is less than min_diff_lines

                let contains_exclude_keyword = COMMIT_EXCLUDE_KEYWORDS
                    .iter()
                    .any(|keyword| commit.commit_message.to_lowercase().contains(keyword));

                let all_files_excluded = commit
                    .modified_file_exts
                    .iter()
                    .all(|ext| COMMIT_EXCLUDE_EXTENSIONS.contains(&ext.as_str()));

                !all_files_excluded
                    && !contains_exclude_keyword
                    && commit.modified_file_paths.len() > min_mod_files
                    && commit.modified_file_paths.len() < max_mod_files
                    && commit.diff.lines().collect::<Vec<_>>().len() > min_diff_lines
            });
        error!("processing {:?} commits", drained.len());
        for commit in drained {
            trace!(?commit.commit_message, "generating suggestions");
            let result = generate_suggestion(llm_gateway, commit).await;

            match result {
                Ok(Some(sug)) => questions.push(sug),
                Err(err) => error!(?err, "llm failure"),
                _ => {}
            }

            if questions.len() >= NUM_QUESTION_SUGGESTIONS {
                return Ok(questions);
            }
        }

        min_mod_files = 1;
        max_mod_files = max_mod_files.saturating_add(5);
        min_diff_lines = min_diff_lines.saturating_sub(20);

        if min_diff_lines <= 60 {
            break;
        }
    }

    Ok(questions)
}

pub fn latest_commits(
    repo_pool: RepositoryPool,
    repo_ref: RepoRef,
    branch: Option<String>,
) -> Result<Vec<DiffStat>> {
    let repo = gix::open(
        repo_pool
            .read(&repo_ref, |_k, v| v.disk_path.clone())
            .context("invalid git repo")?,
    )
    .context("can't open git repo")?;
    let head = if let Some(branchref) = branch {
        repo.find_reference(&branchref)
            .context("invalid branch name")?
            .into_fully_peeled_id()
            .context("git error")?
            .object()
            .context("git error")?
            .into_commit()
    } else {
        repo.head()
            .context("invalid branch name")?
            .into_fully_peeled_id()
            .context("git error")?
            .context("git error")?
            .object()
            .context("git error")?
            .into_commit()
    };
    let parent = head.parent_ids().next();
    Ok(CommitIterator {
        parent,
        commit: head,
    }
    .take(100)
    .collect::<Vec<_>>())
}

async fn generate_suggestion(
    llm_gateway: &llm_gateway::Client,
    commit: DiffStat,
) -> Result<Option<Question>> {
    let classification = classify_commit(llm_gateway, &commit)
        .await
        .context("classification failed")
        .unwrap_or_default();

    if !classification {
        return Ok(None);
    }

    let summary = summarize_commit(llm_gateway, &commit)
        .await
        .context("summary failed")?;

    let question = get_question(llm_gateway, &summary)
        .await
        .context("question failed")?;

    if question == "0" {
        return Ok(None);
    }

    let tag = get_tag(llm_gateway, &question)
        .await
        .context("tag failed")?;

    Ok(Some(Question { question, tag }))
}

async fn classify_commit(llm_gateway: &llm_gateway::Client, commit: &DiffStat) -> Result<bool> {
    let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo-0613").unwrap();
    let raw_commit = format!("{}\n\n{}", commit.commit_message, commit.diff);
    let commit_msg = crate::agent::transcoder::limit_tokens(&raw_commit, bpe, 3000);

    let response = llm_gateway
        .clone()
        .model("gpt-3.5-turbo-0613")
        .max_tokens(1)
        .chat(
            &[
                Message::system(
                    "Your job is to classify the commit into one of the following categories:
1. New functionality
2. Bug fix
3. Refactoring
4. Documentation
5. Other

Output your classification as a number between 1 and 5. Output only a number.
Example output: 2.",
                ),
                Message::user(commit_msg),
            ],
            None,
        )
        .await
        .context("llm error")?
        .try_collect::<String>()
        .await
        .context("llm error")?;

    let result: u8 = response.parse()?;
    Ok(result == 1)
}

async fn summarize_commit(llm_gateway: &llm_gateway::Client, commit: &DiffStat) -> Result<String> {
    let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo-0613").unwrap();
    let raw_commit = format!("{}\n\n{}", commit.commit_message, commit.diff);
    let commit_msg = crate::agent::transcoder::limit_tokens(&raw_commit, bpe, 15000);

    llm_gateway
        .clone()
        .model("gpt-3.5-turbo-16k-0613")
        .max_tokens(256)
        .chat(
            &[
                Message::system(
                    r#"What is shown in this commit?

Start with "This commit shows how".

For example: "This commit shows how the analytics event for a mouseclick is tracked"."#,
                ),
                Message::user(commit_msg),
            ],
            None,
        )
        .await
        .context("llm error")?
        .try_collect::<String>()
        .await
        .context("llm error")
}

async fn get_question(llm_gateway: &llm_gateway::Client, summary: &str) -> Result<String> {
    let bpe = tiktoken_rs::get_bpe_from_model("gpt-4-0613").unwrap();
    let summary = crate::agent::transcoder::limit_tokens(summary, bpe, 7168);

    llm_gateway
        .clone()
        .model("gpt-4-0613")
        .max_tokens(64)
        .chat(
            &[
                Message::system(
                    r#"While writing technical documentation for a project, you need to identify useful parts of the codebase that new developers should learn about.
Output a question that a new developer could answer from the information.

Follow these rules at all times:
- Start with How. For example: How are analytics events for mouseclicks tracked?
- Phrase your question in the present tense
- Do not refer to changes, improvements or fixes
- Do not refer to classes, functions, files or variables
- Refer only to core concepts
- Examples of good questions:
  - How does analytics work?
  - How does the deployment script work?
  - How does the authentication work?
  
If you cannot write a good question, simply reply with only: 0."#,
                ),
                Message::user(summary),
            ],
            None,
        )
        .await
        .context("llm error")?
        .try_collect::<String>()
        .await
        .context("llm error")
}

async fn get_tag(llm_gateway: &llm_gateway::Client, question: &str) -> Result<String> {
    let bpe = tiktoken_rs::get_bpe_from_model("gpt-4-0613").unwrap();
    let question = crate::agent::transcoder::limit_tokens(question, bpe, 7168);
    llm_gateway
        .clone()
        .model("gpt-4-0613")
        .max_tokens(6)
        .chat(
            &[
                Message::system(
                    r#"Your job is to create a one or two unhyphenated word tag for this question. The tag should easily identify the question and consist only of the noun.

DO NOT include the words: feature, question, user, how to, implementation, functionality, support, mechanism.
DO NOT hyphenate words.

Some examples:

User: How does analytics work?
Assistant: analytics

User: What time does the job run each day?
Assistant: job time

User: How do we initialise the backend, before the frontend?
Assistant: initialisation"#,
                ),
                Message::user(question),
            ],
            None,
        )
        .await
        .context("llm error")?
        .try_collect::<String>()
        .await
        .context("llm error")
}
