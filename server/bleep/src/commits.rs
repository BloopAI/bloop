use std::collections::HashSet;

use anyhow::{bail, Context, Result};
use gix::{
    bstr::ByteSlice,
    diff::blob::{sink::Counter, Algorithm, UnifiedDiffBuilder},
    object::{blob::diff::Platform, tree::diff::Action},
    objs::tree::EntryMode,
    Commit, Id,
};
use serde::Serialize;
use tracing::{debug, error, trace};

use crate::{
    llm_gateway::{self, api::Message},
    repo::RepoRef,
    state::RepositoryPool,
};

const COMMIT_EXCLUDE_EXTENSIONS: [&str; 7] = ["md", "txt", "json", "toml", "yml", "yaml", "rst"];

#[derive(Default, Debug)]
pub struct DiffStat {
    modified_file_exts: HashSet<String>,
    modified_file_paths: HashSet<String>,
    num_file_insertions: usize,
    num_file_deletions: usize,
    num_line_insertions: u32,
    num_line_deletions: u32,
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
        let mut stats = DiffStat {
            commit_message: self
                .commit
                .message_raw()
                .unwrap()
                .to_str_lossy()
                .to_string(),
            ..Default::default()
        };

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

                if let Some(ext) = ext.clone() {
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
                            &ext.as_deref(),
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
                            &ext.as_deref(),
                            id.object().unwrap().data.as_bstr().to_str_lossy(),
                            "".into(),
                            &mut stats,
                        );
                    }
                    gix::object::tree::diff::change::Event::Rewrite {
                        source_id,
                        id,
                        entry_mode,
                        ..
                    } if matches!(entry_mode, EntryMode::Blob) => {
                        let platform = Platform::from_ids(source_id, id).unwrap();
                        let old = platform.old.data.as_bstr().to_str_lossy();
                        let new = platform.new.data.as_bstr().to_str_lossy();
                        add_diff(&location, &ext.as_deref(), old, new, &mut stats);
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
                        add_diff(&location, &ext.as_deref(), old, new, &mut stats);
                    }
                    _ => {}
                }

                Ok::<Action, NoneError>(Action::Continue)
            })
            .unwrap();

        self.commit = parent_commit;
        self.parent = self.commit.parent_ids().next();

        Some(stats)
    }
}

fn add_diff(
    location: &str,
    extension: &Option<&str>,
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

    let diff = gix::diff::blob::diff(
        Algorithm::Histogram,
        &input,
        Counter::new(UnifiedDiffBuilder::new(&input)),
    );

    if let Some(ext) = extension {
        if !COMMIT_EXCLUDE_EXTENSIONS.contains(ext) {
            // Confusingly these are inverted
            stats.num_line_insertions += &diff.removals;
            stats.num_line_deletions += &diff.insertions;
        }
    }

    stats.diff += diff.wrapped.as_str();
    stats.diff += "\n";
}

pub async fn expand_commits_to_questions(
    src_commits: Vec<DiffStat>,
    llm_gateway: &llm_gateway::Client,
) -> Result<Vec<Question>> {
    const NUM_TUTORIAL_QUESTIONS: usize = 5;
    const COMMIT_EXCLUDE_KEYWORDS: [&str; 7] = [
        "merge", "revert", "bump", "chore", "fix", "refactor", "docs",
    ];

    let min_mod_files = 1usize;
    let max_mod_files = 20usize;
    let min_diff_lines = 100usize;

    let mut questions = vec![];
    let mut filtered_commits = src_commits
        .into_iter()
        .filter(|commit| {
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
                && commit.num_line_insertions > commit.num_line_deletions * 2
        })
        .collect::<Vec<_>>();

    // sort commits by max difference between insertions and deletions
    filtered_commits.sort_by(|a, b| {
        (a.num_line_insertions - a.num_line_deletions)
            .cmp(&(b.num_line_insertions - b.num_line_deletions))
    });

    debug!("processing {:?} commits", filtered_commits.len());
    for commit in filtered_commits {
        trace!(?commit.commit_message, "generating questions");
        let result = generate_question(llm_gateway, commit).await;

        match result {
            Ok(Some(sug)) => questions.push(sug),
            Err(err) => error!(?err, "llm failure"),
            _ => {}
        }

        if questions.len() >= NUM_TUTORIAL_QUESTIONS {
            return Ok(questions);
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

async fn generate_question(
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

    let question = get_question(llm_gateway, &commit)
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
                    "Your job is to classify whether a commit introduces new functionality or not.
1. New functionality
2. No new functionality

Output your classification as a number between 1 and 2. Output only a number.   
Example output: 2",
                ),
                Message::user(commit_msg),
            ],
            None,
        )
        .await
        .context("llm error")?;

    let result: u8 = response.parse()?;
    Ok(result == 1)
}

async fn get_question(llm_gateway: &llm_gateway::Client, commit: &DiffStat) -> Result<String> {
    let bpe = tiktoken_rs::get_bpe_from_model("gpt-4-0613").unwrap();
    let raw_commit = format!("{}\n\n{}", commit.commit_message, commit.diff);
    let commit = crate::agent::transcoder::limit_tokens(&raw_commit, bpe, 7000);

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
  
If you cannot write a good question, simply reply: 0"#,
                ),
                Message::user(commit),
            ],
            None,
        )
        .await
        .context("llm error")
}

async fn get_tag(llm_gateway: &llm_gateway::Client, question: &str) -> Result<String> {
    let bpe = tiktoken_rs::get_bpe_from_model("gpt-3.5-turbo-0613").unwrap();
    let question = crate::agent::transcoder::limit_tokens(question, bpe, 7168);
    llm_gateway
        .clone()
        .model("gpt-3.5-turbo-0613")
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
        .context("llm error")
}

pub async fn generate_tutorial_questions(
    db: crate::db::SqlDb,
    llm_gateway: Result<crate::llm_gateway::Client>,
    repo_pool: RepositoryPool,
    reporef: RepoRef,
) -> Result<()> {
    let repo_str = reporef.to_string();
    let rows = sqlx::query! {
        "SELECT * FROM tutorial_questions \
         WHERE repo_ref = ?",
        repo_str,
    }
    .fetch_all(db.as_ref())
    .await?;

    if !rows.is_empty() {
        debug!(%reporef, "skipping tutorial questions, already have some");
        return Ok(());
    }

    debug!(%reporef, "generating tutorial questions");
    let Ok(llm_gateway) = llm_gateway
    else {
	bail!("badly configured llm gw");
    };

    // Due to `Send` issues on the gix side, we need to split this off quite brutally.
    let latest_commits = {
        let reporef = reporef.clone();
        tokio::task::spawn_blocking(|| latest_commits(repo_pool, reporef, None))
            .await
            .context("threads error")??
    };

    let questions = expand_commits_to_questions(latest_commits, &llm_gateway).await?;

    debug!(%reporef, count=questions.len(), "found questions");
    tracing::info!("{:?}", &questions);

    let mut tx = db.begin().await?;
    for q in questions {
        _ = sqlx::query!(
            "INSERT INTO tutorial_questions (question, tag, repo_ref) \
             VALUES (?, ?, ?)",
            q.question,
            q.tag,
            repo_str,
        )
        .execute(&mut tx)
        .await?;
    }

    tx.commit().await?;

    debug!(%reporef, "questions committed");
    Ok(())
}
