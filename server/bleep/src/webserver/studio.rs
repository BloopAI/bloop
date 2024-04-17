use std::{
    borrow::Cow,
    collections::{HashMap, HashSet},
    iter, mem,
    ops::Range,
    pin::Pin,
};

use anyhow::{Context, Result};
use axum::{
    extract::{Path, Query, State},
    response::{sse, Sse},
    Extension, Json,
};
use chrono::NaiveDateTime;
use futures::{pin_mut, stream, StreamExt, TryStreamExt};
use rayon::prelude::*;
use reqwest::StatusCode;
use tracing::{debug, error, warn};
use uuid::Uuid;

use self::diff::{DiffChunk, DiffHunk};

use super::{middleware::User, Error};
use crate::{
    agent::{exchange::Exchange, prompts},
    analytics::StudioEvent,
    llm_gateway,
    repo::RepoRef,
    webserver, Application,
};

mod diff;

const LLM_GATEWAY_MODEL: &str = "gpt-4-1106-preview";

fn studio_not_found() -> Error {
    Error::not_found("unknown code studio ID")
}

fn default_studio_name() -> String {
    "New Studio".to_owned()
}

async fn latest_snapshot_id<'a, E>(studio_id: i64, exec: E, user_id: &str) -> webserver::Result<i64>
where
    E: sqlx::Executor<'a, Database = sqlx::Sqlite>,
{
    sqlx::query! {
        "SELECT ss.id
        FROM studio_snapshots ss
        JOIN studios s ON s.id = ss.studio_id
        JOIN projects p ON s.project_id = p.id
        WHERE ss.studio_id = ? AND p.user_id = ?
        ORDER BY ss.modified_at DESC
        LIMIT 1",
        studio_id,
        user_id,
    }
    .fetch_optional(exec)
    .await?
    .and_then(|r| r.id)
    .ok_or_else(|| Error::not_found("no snapshots with given studio ID"))
}

#[derive(serde::Deserialize)]
pub struct Create {
    name: Option<String>,
}

pub async fn create(
    app: Extension<Application>,
    Path(project_id): Path<i64>,
    Json(params): Json<Create>,
) -> webserver::Result<String> {
    let mut transaction = app.sql.begin().await?;

    let studio_id: i64 = sqlx::query! {
        "INSERT INTO studios (project_id, name) VALUES (?, ?) RETURNING id",
        project_id,
        params.name,
    }
    .fetch_one(&mut transaction)
    .await?
    .id;

    sqlx::query! {
        "INSERT INTO studio_snapshots (studio_id, context, doc_context, messages)
         VALUES (?, ?, ?, ?)",
        studio_id,
        "[]",
        "[]",
        "[]",
    }
    .execute(&mut transaction)
    .await
    .unwrap();

    transaction.commit().await?;

    Ok(studio_id.to_string())
}

#[derive(serde::Serialize)]
pub struct Studio {
    name: String,
    modified_at: NaiveDateTime,
    context: Vec<ContextFile>,
    doc_context: Vec<DocContextFile>,
    messages: Vec<Message>,
    token_counts: TokenCounts,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
struct ContextFile {
    path: String,
    hidden: bool,
    repo: RepoRef,
    branch: Option<String>,
    ranges: Vec<Range<usize>>,
}

impl ContextFile {
    /// Merge two files.
    ///
    /// This just joins the two ranges. All other fields come from `self`.
    fn merge(mut self, rhs: Self) -> Self {
        self.ranges.extend(rhs.ranges);
        self
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
struct DocContextFile {
    doc_id: i64,
    doc_source: url::Url,
    doc_icon: Option<String>,
    doc_title: Option<String>,
    relative_url: String,
    absolute_url: String,
    hidden: bool,
    ranges: Vec<Uuid>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
enum Message {
    User(String),
    Assistant(String),
}

impl From<&Message> for llm_gateway::api::Message {
    fn from(value: &Message) -> Self {
        match value {
            Message::User(s) => llm_gateway::api::Message::user(s),
            Message::Assistant(s) => llm_gateway::api::Message::assistant(s),
        }
    }
}

#[derive(serde::Deserialize)]
pub struct Get {
    pub snapshot_id: Option<i64>,
}

pub async fn get(
    app: Extension<Application>,
    user: Extension<User>,
    Path((project_id, studio_id)): Path<(i64, i64)>,
    Query(params): Query<Get>,
) -> webserver::Result<Json<Studio>> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    let snapshot_id = match params.snapshot_id {
        Some(id) => id,
        None => latest_snapshot_id(studio_id, &*app.sql, &user_id).await?,
    };

    let row = sqlx::query! {
        "SELECT s.id, s.name, ss.context, ss.doc_context, ss.messages, ss.modified_at
        FROM studios s
        INNER JOIN studio_snapshots ss ON ss.id = ?
        WHERE s.id = ? AND s.project_id = ?",
        snapshot_id,
        studio_id,
        project_id,
    }
    .fetch_optional(&*app.sql)
    .await?
    .ok_or_else(studio_not_found)?;

    let context: Vec<ContextFile> =
        serde_json::from_str(&row.context).context("failed to deserialize context")?;
    let doc_context: Vec<DocContextFile> =
        serde_json::from_str(&row.doc_context).context("failed to deserialize doc context")?;
    let messages: Vec<Message> =
        serde_json::from_str(&row.messages).context("failed to deserialize message list")?;

    Ok(Json(Studio {
        modified_at: row.modified_at,
        name: row.name.unwrap_or_else(default_studio_name),
        token_counts: token_counts((*app).clone(), &messages, &context, &doc_context).await?,
        context,
        doc_context,
        messages,
    }))
}

#[derive(serde::Deserialize)]
pub struct Patch {
    name: Option<String>,
    modified_at: Option<NaiveDateTime>,
    context: Option<Vec<ContextFile>>,
    doc_context: Option<Vec<DocContextFile>>,
    messages: Option<Vec<Message>>,
    snapshot_id: Option<i64>,
}

pub async fn patch(
    app: Extension<Application>,
    user: Extension<User>,
    Path((project_id, studio_id)): Path<(i64, i64)>,
    Json(patch): Json<Patch>,
) -> webserver::Result<Json<TokenCounts>> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    let mut transaction = app.sql.begin().await?;

    let snapshot_id = match patch.snapshot_id {
        Some(id) => id,
        None => latest_snapshot_id(studio_id, &mut transaction, &user_id).await?,
    };

    // Ensure the ID is valid first.
    sqlx::query!(
        "SELECT s.id FROM studios s
        JOIN projects p ON p.id = s.project_id
        WHERE s.id = ? AND p.id = ? AND p.user_id = ?",
        studio_id,
        project_id,
        user_id,
    )
    .fetch_optional(&mut transaction)
    .await?
    .ok_or_else(studio_not_found)?;

    if let Some(name) = patch.name {
        sqlx::query!("UPDATE studios SET name = ? WHERE id = ?", name, studio_id)
            .execute(&mut transaction)
            .await?;
    }

    if let Some(modified_at) = patch.modified_at {
        sqlx::query!(
            "UPDATE studio_snapshots SET modified_at = ? WHERE id = ?",
            modified_at,
            snapshot_id
        )
        .execute(&mut transaction)
        .await?;
    }

    if let Some(context) = patch.context {
        let json = serde_json::to_string(&context).unwrap();
        sqlx::query!(
            "UPDATE studio_snapshots SET context = ? WHERE id = ?",
            json,
            snapshot_id
        )
        .execute(&mut transaction)
        .await?;
    }

    if let Some(doc_context) = patch.doc_context {
        let json = serde_json::to_string(&doc_context).unwrap();
        sqlx::query!(
            "UPDATE studio_snapshots SET doc_context = ? WHERE id = ?",
            json,
            snapshot_id
        )
        .execute(&mut transaction)
        .await?;
    }

    if let Some(messages) = patch.messages {
        let json = serde_json::to_string(&messages).unwrap();
        sqlx::query!(
            "UPDATE studio_snapshots SET messages = ? WHERE id = ?",
            json,
            snapshot_id
        )
        .execute(&mut transaction)
        .await?;
    }

    sqlx::query! {
        "UPDATE studio_snapshots SET modified_at = datetime('now') WHERE id = ?",
        snapshot_id,
    }
    .execute(&mut transaction)
    .await?;

    // Re-fetch the context and messages in case we didn't change them. If we did, this will now
    // contain the updated values.
    let (messages_json, context_json, doc_context_json) = sqlx::query!(
        "SELECT messages, context, doc_context FROM studio_snapshots WHERE id = ?",
        snapshot_id
    )
    .fetch_optional(&mut transaction)
    .await?
    .map(|r| (r.messages, r.context, r.doc_context))
    .unwrap_or_default();

    let context: Vec<ContextFile> =
        serde_json::from_str(&context_json).context("invalid context JSON")?;

    let doc_context: Vec<DocContextFile> =
        serde_json::from_str(&doc_context_json).context("invalid context JSON")?;

    let messages: Vec<Message> =
        serde_json::from_str(&messages_json).context("invalid messages JSON")?;

    let counts = token_counts((*app).clone(), &messages, &context, &doc_context).await?;

    transaction.commit().await?;

    Ok(Json(counts))
}

pub async fn delete(
    app: Extension<Application>,
    user: Extension<User>,
    Path((project_id, studio_id)): Path<(i64, i64)>,
) -> webserver::Result<()> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    sqlx::query!(
        "DELETE FROM studios
        WHERE id = $1 AND project_id = $2 AND EXISTS (
            SELECT p.id FROM projects p WHERE p.id = $2 AND p.user_id = $3
        )
        RETURNING id",
        studio_id,
        project_id,
        user_id,
    )
    .fetch_optional(&*app.sql)
    .await?
    .ok_or_else(studio_not_found)
    .map(|_| ())
}

#[derive(serde::Serialize)]
pub struct ListItem {
    id: i64,
    name: String,
    modified_at: NaiveDateTime,
    repos: Vec<String>,
    most_common_ext: String,
    context: Vec<ContextFile>,
    doc_context: Vec<DocContextFile>,
    token_counts: TokenCounts,
}

pub async fn list(
    app: Extension<Application>,
    user: Extension<User>,
    Path(project_id): Path<i64>,
) -> webserver::Result<Json<Vec<ListItem>>> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    let studios = sqlx::query!(
        "SELECT
            s.id,
            s.name,
            ss.modified_at as \"modified_at!\",
            ss.context,
            ss.doc_context,
            ss.messages
        FROM studios s
        INNER JOIN studio_snapshots ss ON s.id = ss.studio_id
        INNER JOIN projects p ON p.id = s.project_id
        WHERE s.project_id = ? AND p.user_id = ? AND (ss.studio_id, ss.modified_at) IN (
            SELECT studio_id, MAX(modified_at)
            FROM studio_snapshots
            GROUP BY studio_id
        )",
        project_id,
        user_id,
    )
    .fetch_all(&*app.sql)
    .await?;

    let mut list_items = Vec::new();

    for studio in studios {
        let context: Vec<ContextFile> =
            serde_json::from_str(&studio.context).map_err(Error::internal)?;
        let doc_context: Vec<DocContextFile> =
            serde_json::from_str(&studio.doc_context).map_err(Error::internal)?;
        let messages: Vec<Message> =
            serde_json::from_str(&studio.messages).map_err(Error::internal)?;

        let repos: HashSet<String> = context.iter().map(|file| file.repo.name.clone()).collect();

        let ext_tokens = token_counts((*app).clone(), &[], &context, &[])
            .await?
            .per_file
            .iter()
            .zip(
                context
                    .iter()
                    .map(|file| file.path.split('.').last().unwrap_or_default()),
            )
            .fold(HashMap::new(), |mut tokens_by_ext, (count, extension)| {
                *tokens_by_ext.entry(extension).or_insert(0) += count.unwrap_or(0);
                tokens_by_ext
            });

        let most_common_ext = ext_tokens
            .into_iter()
            .max_by_key(|(_, tokens)| *tokens)
            .map(|(ext, _)| ext)
            .unwrap_or_default()
            .to_owned();

        let token_counts = token_counts((*app).clone(), &messages, &context, &doc_context).await?;

        let list_item = ListItem {
            id: studio.id,
            name: studio.name.unwrap_or_else(default_studio_name),
            modified_at: studio.modified_at,
            repos: repos.into_iter().collect::<Vec<_>>(),
            most_common_ext,
            context,
            doc_context,
            token_counts,
        };

        list_items.push(list_item);
    }

    Ok(Json(list_items))
}

#[derive(serde::Serialize)]
pub struct TokenCounts {
    total: usize,
    messages: usize,
    per_file: Vec<Option<usize>>,
    baseline: usize,
    per_doc_file: Vec<Option<usize>>,
}

async fn token_counts(
    app: Application,
    messages: &[Message],
    context: &[ContextFile],
    doc_context: &[DocContextFile],
) -> webserver::Result<TokenCounts> {
    let per_file = stream::iter(context)
        .map(|file| {
            let app = app.clone();

            async move {
                if file.hidden {
                    return Ok::<_, Error>(None);
                }

                let content = app
                    .indexes
                    .file
                    .by_path(&file.repo, &file.path, file.branch.as_deref())
                    .await?
                    .map(|doc| doc.content);

                Ok(Some((file, content)))
            }
        })
        // We need to box here, to avoid a higher-ranked lifetime error.
        .boxed()
        .buffered(16)
        .try_collect::<Vec<_>>()
        .await?
        .into_par_iter()
        .map(|data: Option<(&ContextFile, Option<String>)>| {
            let (file, body) = match data {
                Some(t) => t,
                None => return Some(0),
            };

            body.map(|b| count_tokens_for_file(&file.path, &b, &file.ranges))
        })
        .collect::<Vec<_>>();

    let core_bpe = tiktoken_rs::get_bpe_from_model("gpt-4-1106-preview").unwrap();
    let per_doc_file = stream::iter(doc_context)
        .map(|file| async {
            if file.hidden {
                return Ok::<_, Error>(None);
            }

            let content = app
                .indexes
                .doc
                .fetch(file.doc_id, &file.relative_url)
                .await
                .map(|search_results| {
                    search_results
                        .into_iter()
                        .filter(|search_result| {
                            if file.ranges.is_empty() {
                                true
                            } else {
                                file.ranges.contains(&search_result.point_id)
                            }
                        })
                        .map(|sr| sr.text)
                        .collect::<String>()
                })
                .ok();

            Ok(content)
        })
        .boxed()
        .buffered(16)
        .try_collect::<Vec<_>>()
        .await?
        .into_par_iter()
        .map(|data| data.map(|d| core_bpe.encode_ordinary(&d).len()))
        .collect::<Vec<_>>();

    let empty_context = generate_llm_context(app.clone(), &[], &[]).await?;
    let empty_system_message = tiktoken_rs::ChatCompletionRequestMessage {
        role: "system".to_owned(),
        content: Some(prompts::studio_article_prompt(&empty_context)),
        name: None,
        function_call: None,
    };

    let baseline =
        tiktoken_rs::num_tokens_from_messages(LLM_GATEWAY_MODEL, &[empty_system_message.clone()])
            .unwrap();

    let tiktoken_messages = messages.iter().cloned().map(|message| match message {
        Message::User(content) => tiktoken_rs::ChatCompletionRequestMessage {
            role: "user".to_owned(),
            content: Some(content),
            name: None,
            function_call: None,
        },
        Message::Assistant(content) => tiktoken_rs::ChatCompletionRequestMessage {
            role: "assistant".to_owned(),
            content: Some(content),
            name: None,
            function_call: None,
        },
    });

    let messages = tiktoken_rs::num_tokens_from_messages(
        LLM_GATEWAY_MODEL,
        &iter::once(empty_system_message)
            .chain(tiktoken_messages)
            .collect::<Vec<_>>(),
    )
    .unwrap();

    // We calculate `total` here as a summation of other calculated values here, because OpenAI's
    // tokenization in general is contextual. Summing token counts from subsections of a string
    // will often result in a different (and slightly larger) token count compared to counting
    // tokens in the same string as a whole.
    //
    // We accept that here, and opt to always use the slightly less accurate (but larger) number
    // for consistency.
    let total = (messages
        + per_file
            .iter()
            .flatten()
            .chain(per_doc_file.iter().flatten())
            .sum::<usize>())
    .saturating_sub(baseline);

    Ok(TokenCounts {
        total,
        messages,
        per_file,
        baseline,
        per_doc_file,
    })
}

#[derive(serde::Deserialize)]
pub struct GetFileTokenCount {
    pub path: String,
    pub repo: RepoRef,
    pub branch: Option<String>,
    pub ranges: Option<Vec<Range<usize>>>,
}

pub async fn get_file_token_count(
    app: Extension<Application>,
    Json(params): Json<GetFileTokenCount>,
) -> webserver::Result<Json<usize>> {
    let file = ContextFile {
        path: params.path,
        hidden: false,
        repo: params.repo,
        branch: params.branch,
        ranges: params.ranges.unwrap_or_default(),
    };

    let doc = app
        .indexes
        .file
        .by_path(&file.repo, &file.path, file.branch.as_deref())
        .await?
        .with_context(|| {
            format!(
                "file `{}` did not exist in repo `{}`, branch `{:?}`",
                file.path, file.repo, file.branch
            )
        })?;

    let token_count = count_tokens_for_file(&file.path, &doc.content, &file.ranges);

    Ok(Json(token_count))
}

#[derive(serde::Deserialize)]
pub struct GetDocFileTokenCount {
    pub doc_id: i64,
    pub relative_url: String,
    pub ranges: Vec<Uuid>,
}

pub async fn get_doc_file_token_count(
    app: Extension<Application>,
    Json(params): Json<GetDocFileTokenCount>,
) -> webserver::Result<Json<usize>> {
    let content = app
        .indexes
        .doc
        .fetch(params.doc_id, &params.relative_url)
        .await
        .map_err(Error::internal)?
        .into_iter()
        .filter(|search_result| {
            if params.ranges.is_empty() {
                true
            } else {
                params.ranges.contains(&search_result.point_id)
            }
        })
        .map(|sr| sr.text)
        .collect::<String>();

    let core_bpe = tiktoken_rs::get_bpe_from_model("gpt-4-1106-preview").unwrap();
    let token_count = core_bpe.encode_ordinary(&content).len();

    Ok(Json(token_count))
}

fn count_tokens_for_file(path: &str, body: &str, ranges: &[Range<usize>]) -> usize {
    let core_bpe = tiktoken_rs::get_bpe_from_model("gpt-4-1106-preview").unwrap();

    let mut chunks = Vec::new();

    if ranges.is_empty() {
        let numbered_body = body
            .lines()
            .enumerate()
            .map(|(i, line)| format!("{} {line}\n", i + 1))
            .collect::<Vec<_>>()
            .join("\n");

        chunks.push(numbered_body);
    } else {
        let lines = body.lines().collect::<Vec<_>>();
        for range in ranges {
            let chunk = lines
                .iter()
                .copied()
                .enumerate()
                .skip(range.start)
                .take(range.end - range.start)
                .map(|(i, line)| format!("{} {line}\n", range.start + i + 1))
                .collect::<Vec<_>>()
                .join("\n");

            chunks.push(chunk);
        }
    }

    // Here, we build up a pseudo context in order to count tokens more accurately. This includes
    // the path twice; once for the full path list under the `##### PATHS #####` section, and
    // another time for the path when it is re-printed above the code chunk.

    let mut pseudo_context = format!("{path}\n");

    for chunk in chunks {
        pseudo_context += &format!("### {path} ###\n{chunk}\n");
    }

    core_bpe.encode_ordinary(&pseudo_context).len()
}

pub async fn generate(
    app: Extension<Application>,
    user: Extension<User>,
    Path((_project_id, studio_id)): Path<(i64, i64)>,
) -> webserver::Result<Sse<Pin<Box<dyn tokio_stream::Stream<Item = Result<sse::Event>> + Send>>>> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    let snapshot_id = latest_snapshot_id(studio_id, &*app.sql, &user_id).await?;

    let llm_gateway = user
        .llm_gateway(&app)
        .await
        .map_err(|e| Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .quota_gated(!app.env.is_cloud_instance())
        .model(LLM_GATEWAY_MODEL)
        .temperature(0.0);

    let (messages_json, context_json, doc_context_json) = sqlx::query!(
        "SELECT messages, context, doc_context FROM studio_snapshots WHERE id = ?",
        snapshot_id,
    )
    .fetch_optional(&*app.sql)
    .await?
    .map(|row| (row.messages, row.context, row.doc_context))
    .ok_or_else(studio_not_found)?;

    let mut messages =
        serde_json::from_str::<Vec<Message>>(&messages_json).map_err(Error::internal)?;

    let context =
        serde_json::from_str::<Vec<ContextFile>>(&context_json).map_err(Error::internal)?;

    let doc_context =
        serde_json::from_str::<Vec<DocContextFile>>(&doc_context_json).map_err(Error::internal)?;

    app.track_studio(
        &user,
        StudioEvent::new(studio_id, "generate")
            .with_payload("context", &context)
            .with_payload("doc_context", &doc_context)
            .with_payload("messages", &messages),
    );

    let llm_context = generate_llm_context((*app).clone(), &context, &doc_context).await?;
    let system_prompt = prompts::studio_article_prompt(&llm_context);
    let llm_messages = iter::once(llm_gateway::api::Message::system(&system_prompt))
        .chain(messages.iter().map(llm_gateway::api::Message::from))
        .collect::<Vec<_>>();

    let tokens = llm_gateway.chat_stream(&llm_messages, None).await?;

    let stream = async_stream::try_stream! {
        pin_mut!(tokens);

        let mut response = String::new();

        while let Some(fragment) = tokens.next().await {
            let fragment = fragment?;
            response += &fragment;
            yield response.clone();
        }

        app.track_studio(
            &user,
            StudioEvent::new(studio_id, "generate_complete")
                .with_payload("response", &response)
        );

        messages.push(Message::Assistant(response));
        let messages_json = serde_json::to_string(&messages).unwrap();

        sqlx::query! {
            "INSERT INTO studio_snapshots(studio_id, context, doc_context, messages)
            SELECT studio_id, context, doc_context, ?
            FROM studio_snapshots
            WHERE id = ?",
            messages_json,
            snapshot_id,
        }
        .execute(&*app.sql)
        .await?;

        populate_studio_name(app.clone(), user.clone(), studio_id).await?;
    };

    let mut errored = false;
    let stream = stream.take_while(move |r| {
        let ok = !errored;
        if let Err(e) = &r {
            error!(?e, "stream error");
            errored = true;
        }
        async move { ok }
    });

    let event_stream = stream.map(|result| {
        sse::Event::default()
            .json_data(result.map_err(|e: Error| e.to_string()))
            .map_err(anyhow::Error::new)
    });
    let done_stream = stream::once(async { Ok(sse::Event::default().data("[DONE]")) });

    let stream = event_stream.chain(done_stream);

    Ok(Sse::new(Box::pin(stream)))
}

async fn generate_llm_context(
    app: Application,
    context: &[ContextFile],
    doc_context: &[DocContextFile],
) -> Result<String> {
    let mut s = String::new();

    s += "##### PATHS #####\n";

    for file in context.iter().filter(|f| !f.hidden) {
        s += &format!("{}:{}\n", file.repo, file.path);
    }

    s += "\n##### CODE CHUNKS #####\n\n";

    for file in context.iter().filter(|f| !f.hidden) {
        let doc = app
            .indexes
            .file
            .by_path(&file.repo, &file.path, file.branch.as_deref())
            .await?
            .with_context(|| {
                format!(
                    "file `{}` did not exist in repo `{}`, branch `{:?}`",
                    file.path, file.repo, file.branch
                )
            })?;

        let lines = doc
            .content
            .lines()
            .enumerate()
            .map(|(i, s)| format!("{} {s}\n", i + 1))
            .collect::<Vec<_>>();

        #[allow(clippy::single_range_in_vec_init)]
        let ranges = if file.ranges.is_empty() {
            vec![0..lines.len()]
        } else {
            file.ranges.clone()
        };

        for range in ranges {
            let snippet = lines
                .iter()
                .skip(range.start)
                .take(range.end - range.start)
                .map(String::as_str)
                .collect::<String>();

            s += &format!("### {}:{} ###\n{snippet}\n", file.repo, file.path);
        }
    }

    s += "\n##### DOCUMENTATION #####\n\n";

    for file in doc_context.iter().filter(|f| !f.hidden) {
        let sections = app
            .indexes
            .doc
            .fetch(file.doc_id, &file.relative_url)
            .await?
            .into_iter()
            .filter(|search_result| {
                if file.ranges.is_empty() {
                    true
                } else {
                    file.ranges.contains(&search_result.point_id)
                }
            })
            .map(|sr| sr.text)
            .collect::<Vec<_>>()
            .join("\n");
        s += &format!(
            "### {}{} ###\n{sections}\n",
            &file.doc_source.as_str(),
            &file.relative_url
        );
    }

    Ok(s)
}

/// A set of structured diff definitions consumed by the front-end.
mod structured_diff {
    use std::fmt;

    use crate::repo::RepoRef;

    #[derive(serde::Serialize, serde::Deserialize)]
    pub struct Diff {
        pub chunks: Vec<Chunk>,
    }

    impl fmt::Display for Diff {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            use std::fmt::Write;

            let mut s = String::new();

            for c in &self.chunks {
                writeln!(s, "--- {}\n+++ {}", c.file, c.file)?;

                for h in &c.hunks {
                    writeln!(s, "@@ -{},0 +{},0 @@", h.line_start, h.line_start)?;
                    write!(s, "{}", h.patch)?;
                }
            }

            for c in super::diff::relaxed_parse(&s) {
                write!(f, "{}", c)?;
            }

            Ok(())
        }
    }

    #[derive(serde::Serialize, serde::Deserialize)]
    pub struct Chunk {
        pub file: String,
        pub repo: RepoRef,
        pub branch: Option<String>,
        pub lang: Option<String>,
        pub hunks: Vec<Hunk>,

        /// This field is additionally included for simplicity on the front-end.
        pub raw_patch: String,
    }

    #[derive(serde::Serialize, serde::Deserialize)]
    pub struct Hunk {
        pub line_start: usize,
        pub patch: String,
    }
}

pub async fn diff(
    app: Extension<Application>,
    user: Extension<User>,
    Path((_project_id, studio_id)): Path<(i64, i64)>,
) -> webserver::Result<Json<structured_diff::Diff>> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    let snapshot_id = latest_snapshot_id(studio_id, &*app.sql, &user_id).await?;

    let llm_gateway = user
        .llm_gateway(&app)
        .await
        .map_err(|e| Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .quota_gated(!app.env.is_cloud_instance())
        .model(LLM_GATEWAY_MODEL)
        .temperature(0.0);

    let (messages_json, context_json) = sqlx::query!(
        "SELECT messages, context FROM studio_snapshots WHERE id = ?",
        snapshot_id,
    )
    .fetch_optional(&*app.sql)
    .await?
    .map(|row| (row.messages, row.context))
    .ok_or_else(studio_not_found)?;

    let messages = serde_json::from_str::<Vec<Message>>(&messages_json).map_err(Error::internal)?;

    let context =
        serde_json::from_str::<Vec<ContextFile>>(&context_json).map_err(Error::internal)?;

    let user_message = messages
        .iter()
        .rev()
        .find_map(|msg| match msg {
            Message::User(m) => Some(m),
            Message::Assistant(..) => None,
        })
        .context("studio did not contain a user message")?;

    let assistant_message = messages
        .iter()
        .rev()
        .find_map(|msg| match msg {
            Message::User(..) => None,
            Message::Assistant(m) => Some(m),
        })
        .context("studio did not contain an assistant message")?;

    app.track_studio(
        &user,
        StudioEvent::new(studio_id, "diff")
            .with_payload("context", &context)
            .with_payload("user_message", &user_message)
            .with_payload("assistant_message", &assistant_message),
    );

    let llm_context = generate_llm_context((*app).clone(), &context, &[]).await?;

    let system_prompt = prompts::studio_diff_prompt(&llm_context);
    let user_message = format!("Create a patch for the task \"{user_message}\".\n\n\nHere is the solution:\n\n{assistant_message}");

    let messages = vec![
        llm_gateway::api::Message::system(&system_prompt),
        llm_gateway::api::Message::user(&user_message),
    ];

    let response = llm_gateway.chat(&messages, None).await?;
    let diff_chunks = diff::extract(&response)?.collect::<Vec<_>>();

    let valid_chunks = futures::stream::iter(diff_chunks)
        .map(|mut chunk| {
            let app = (*app).clone();
            let llm_context = llm_context.clone();
            let llm_gateway = llm_gateway.clone();

            async move {
                match (&chunk.src, &chunk.dst) {
                    (Some(src), Some(dst)) => {
                        if src != dst {
                            error!(
                                "patch source and destination file were different: \
                                got `{src}` and `{dst}`"
                            );

                            return Ok(None);
                        }

                        let (repo, path) = parse_diff_path(src)?;

                        chunk.hunks = rectify_hunks(
                            &app,
                            &llm_context,
                            &llm_gateway,
                            chunk.hunks.iter(),
                            path,
                            &repo,
                            None,
                        )
                        .await?;

                        Ok(Some(chunk))
                    }

                    (Some(src), None) => {
                        let (repo, path) = parse_diff_path(src)?;
                        if validate_delete_file(&app, path, &repo, None).await? {
                            Ok(Some(chunk))
                        } else {
                            Ok(None)
                        }
                    }

                    (None, Some(dst)) => {
                        let (repo, path) = parse_diff_path(dst)?;
                        if validate_add_file(&app, &chunk, path, &repo, None).await? {
                            Ok(Some(chunk))
                        } else {
                            Ok(None)
                        }
                    }

                    (None, None) => {
                        error!("patch chunk had no file source or destination");
                        Ok(None)
                    }
                }
            }
        })
        .buffered(10)
        .try_filter_map(|c: Option<_>| async move { Ok::<_, anyhow::Error>(c) })
        .try_collect::<Vec<_>>()
        .await
        .context("failed to interpret diff chunks")?;

    let mut file_langs = HashMap::<String, String>::new();
    let mut out = structured_diff::Diff { chunks: vec![] };

    for chunk in valid_chunks {
        let path = chunk.src.as_deref().or(chunk.dst.as_deref()).unwrap();
        let (repo, path) = parse_diff_path(path)?;
        let lang = if let Some(l) = file_langs.get(path) {
            Some(l.clone())
        } else {
            let detected_lang = if chunk.src.is_some() {
                let doc = app
                    .indexes
                    .file
                    .by_path(&repo, path, None)
                    .await?
                    .context("path did not exist in the index")?;

                doc.lang
            } else {
                hyperpolyglot::detect(std::path::Path::new(&path))
                    .ok()
                    .flatten()
                    .map(|detection| detection.language().to_owned())
            };

            if let Some(l) = detected_lang.clone() {
                file_langs.insert(path.to_owned(), l);
            }

            detected_lang
        };

        out.chunks.push(structured_diff::Chunk {
            raw_patch: chunk.to_string(),

            lang: lang.clone(),
            repo: repo.clone(),
            branch: None,
            file: path.to_owned(),
            hunks: chunk
                .hunks
                .into_iter()
                .map(|hunk| structured_diff::Hunk {
                    line_start: hunk.src_line,
                    patch: hunk
                        .lines
                        .into_iter()
                        .map(|line| line.to_string())
                        .collect::<String>(),
                })
                .collect(),
        });
    }

    Ok(Json(out))
}

fn parse_diff_path(p: &str) -> Result<(RepoRef, &str)> {
    let (repo, path) = p
        .split_once(':')
        .context("diff path did not conform to repo:path syntax")?;

    let repo = repo.parse().context("repo ref was invalid")?;

    Ok((repo, path))
}

async fn rectify_hunks(
    app: &Application,
    llm_context: &str,
    llm_gateway: &llm_gateway::Client,
    hunks: impl Iterator<Item = &DiffHunk>,
    path: &str,
    repo: &RepoRef,
    branch: Option<&str>,
) -> Result<Vec<DiffHunk>> {
    let file = app
        .indexes
        .file
        .by_path(repo, path, branch)
        .await?
        .context("path did not exist in the index")?;

    let mut file_content = file.content;

    let mut out = Vec::new();

    for (i, hunk) in hunks.enumerate() {
        let mut singular_chunk = DiffChunk {
            src: Some(path.to_owned()),
            dst: Some(path.to_owned()),
            hunks: vec![hunk.clone()],
        };

        let diff = singular_chunk.to_string();
        let patch = diffy::Patch::from_str(&diff).context("invalid patch")?;

        if let Ok(t) = diffy::apply(&file_content, &patch) {
            file_content = t;
            out.extend(singular_chunk.hunks);
        } else {
            debug!("fixing up patch:\n\n{hunk:?}\n\n{diff}");

            singular_chunk.hunks[0].lines.retain(|line| match line {
                diff::Line::AddLine(..) | diff::Line::DelLine(..) => true,
                diff::Line::Context(..) => false,
            });
            singular_chunk.fixup_hunks();

            let diff = if singular_chunk.hunks[0]
                .lines
                .iter()
                .all(|l| matches!(l, diff::Line::AddLine(..)))
            {
                let system_prompt = prompts::studio_diff_regen_hunk_prompt(llm_context);
                let messages = vec![
                    llm_gateway::api::Message::system(&system_prompt),
                    llm_gateway::api::Message::user(&singular_chunk.to_string()),
                ];
                llm_gateway.chat(&messages, None).await?
            } else {
                singular_chunk.to_string()
            };

            let patch = diffy::Patch::from_str(&diff).context("redacted patch was invalid")?;

            if let Ok(t) = diffy::apply(&file_content, &patch) {
                file_content = t;
                out.extend(singular_chunk.hunks);
            } else {
                warn!("hunk {path}#{i} failed: {diff}");
            }
        }
    }

    Ok(out)
}

async fn validate_delete_file(
    app: &Application,
    path: &str,
    repo: &RepoRef,
    branch: Option<&str>,
) -> Result<bool> {
    if app
        .indexes
        .file
        .by_path(repo, path, branch)
        .await?
        .is_none()
    {
        error!("diff tried to delete a file that doesn't exist: {path}");
        Ok(false)
    } else {
        Ok(true)
    }
}

async fn validate_add_file(
    app: &Application,
    chunk: &DiffChunk,
    path: &str,
    repo: &RepoRef,
    branch: Option<&str>,
) -> Result<bool> {
    if app
        .indexes
        .file
        .by_path(repo, path, branch)
        .await?
        .is_some()
    {
        error!("diff tried to create a file that already exists: {path}");
        return Ok(false);
    };

    if chunk.hunks.iter().any(|h| {
        h.lines
            .iter()
            .any(|l| !matches!(l, diff::Line::AddLine(..)))
    }) {
        error!("diff to create a new file had non-addition lines");
        Ok(false)
    } else {
        Ok(true)
    }
}

pub async fn diff_apply(
    app: State<Application>,
    user: Extension<User>,
    Path((_project_id, studio_id)): Path<(i64, i64)>,
    diff: String,
) -> webserver::Result<()> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    let snapshot_id = latest_snapshot_id(studio_id, &*app.sql, &user_id).await?;

    let context_json = sqlx::query!(
        "SELECT context FROM studio_snapshots WHERE id = ?",
        snapshot_id,
    )
    .fetch_optional(&*app.sql)
    .await?
    .map(|row| row.context)
    .ok_or_else(studio_not_found)?;

    let _context =
        serde_json::from_str::<Vec<ContextFile>>(&context_json).map_err(Error::internal)?;

    let diff_chunks = diff::relaxed_parse(&diff);

    let mut dirty_repos = HashSet::new();

    for (i, chunk) in diff_chunks.enumerate() {
        let (repo, path) = chunk
            .src
            .as_ref()
            .or(chunk.dst.as_ref())
            .context("diff was missing src and dst")
            .and_then(|p| parse_diff_path(p))?;

        let Some(repo_path) = repo.local_path() else {
            error!("cannot apply patch to remote repo");
            continue;
        };

        dirty_repos.insert(repo.clone());

        let mut file_content = if chunk.src.is_some() {
            app.indexes
                .file
                .by_path(&repo, path, None)
                .await?
                .context("path did not exist in the index")?
                .content
        } else {
            String::new()
        };

        for (j, hunk) in chunk.hunks.iter().enumerate() {
            let mut singular_chunk = chunk.clone();
            singular_chunk.hunks = vec![hunk.clone()];

            let diff = singular_chunk.to_string();
            let patch = diffy::Patch::from_str(&diff).context("invalid patch")?;

            match diffy::apply(&file_content, &patch) {
                Ok(t) => file_content = t,
                Err(e) => {
                    return Err(
                        Error::user(format!("chunk {i}, hunk {j} failed to apply: {e}"))
                            .with_status(StatusCode::BAD_REQUEST),
                    )
                }
            }
        }

        let file_path = repo_path.join(path);

        if chunk.dst.is_some() {
            std::fs::write(file_path, file_content).context("failed to patch file on disk")?;
        } else {
            if !file_content.trim().is_empty() {
                return Err(Error::user(
                    "diff deletes a file but not all contents were removed",
                ));
            }

            std::fs::remove_file(file_path).context("failed to delete file on disk")?;
        }
    }

    // Force a re-sync.
    for repo in dirty_repos {
        let _ = crate::webserver::repos::sync(
            Query(webserver::repos::RepoParams {
                repo,
                shallow: false,
            }),
            app.clone(),
            user.clone(),
        )
        .await?;
    }

    Ok(())
}

/// If a given studio's name is `NULL`, try to auto-generate a name.
///
/// If the requested studio already has a name, this is a no-op.
async fn populate_studio_name(
    app: Extension<Application>,
    user: Extension<User>,
    studio_id: i64,
) -> webserver::Result<()> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    let snapshot_id = latest_snapshot_id(studio_id, &*app.sql, &user_id).await?;
    let needs_name = sqlx::query! {
        "SELECT id FROM studios WHERE id = ? AND name IS NULL",
        studio_id,
    }
    .fetch_optional(&*app.sql)
    .await?
    .is_some();

    if !needs_name {
        return Ok(());
    }

    let (context_json, messages_json) = sqlx::query! {
        "SELECT context, messages FROM studio_snapshots WHERE id = ?",
        snapshot_id,
    }
    .fetch_one(&*app.sql)
    .await
    .map(|r| (r.context, r.messages))?;

    let llm_gateway = user
        .llm_gateway(&app)
        .await
        .map_err(|e| Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .model("gpt-3.5-turbo-16k-0613")
        .temperature(0.0);

    let messages = &[llm_gateway::api::Message::system(
        &prompts::studio_name_prompt(&context_json, &messages_json),
    )];

    let name = llm_gateway.chat(messages, None).await?;

    // Normalize studio name by removing:
    // - surrounding whitespace
    // - enclosing quotation marks
    // - the prefix phrase "Understanding "
    let name = name.trim();
    let name = name.trim_matches('"');
    let name = name.trim_start_matches("Understanding ");

    debug!("populate studio `{studio_id}` with LLM-generated name: `{name}`");

    sqlx::query!("UPDATE studios SET name = ? WHERE id = ?", name, studio_id)
        .execute(&*app.sql)
        .await?;

    Ok(())
}

#[derive(serde::Deserialize)]
pub struct Import {
    pub thread_id: Uuid,
    /// An optional studio ID to import into.
    pub studio_id: Option<i64>,
}

/// Returns a new studio ID, or the `?studio_id=...` query param if present.
pub async fn import(
    app: Extension<Application>,
    user: Extension<User>,
    Path(project_id): Path<i64>,
    Query(params): Query<Import>,
) -> webserver::Result<String> {
    let mut transaction = app.sql.begin().await?;

    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    let thread_id = params.thread_id.to_string();

    let conversation = sqlx::query! {
        "SELECT c.title, c.exchanges
        FROM conversations c
        JOIN projects p ON p.id = c.project_id AND p.user_id = ?
        WHERE thread_id = ?",
        user_id,
        thread_id,
    }
    .fetch_optional(&mut transaction)
    .await?
    .ok_or_else(|| Error::not_found("conversation not found"))?;

    let exchanges = serde_json::from_str::<Vec<Exchange>>(&conversation.exchanges)
        .context("couldn't deserialize exchange list")?;

    let snapshot_id = match params.studio_id {
        None => None,
        Some(studio_id) => Some(latest_snapshot_id(studio_id, &mut transaction, &user_id).await?),
    };

    let old_context: Vec<ContextFile> = if let Some(snapshot_id) = snapshot_id {
        sqlx::query! {
            "SELECT context FROM studio_snapshots WHERE id = ?",
            snapshot_id,
        }
        .fetch_optional(&mut transaction)
        .await?
        .ok_or_else(studio_not_found)
        .and_then(|r| serde_json::from_str(&r.context).map_err(Error::internal))?
    } else {
        Vec::new()
    };

    let imported_context = canonicalize_context(exchanges.iter().flat_map(|e| {
        #[allow(clippy::single_range_in_vec_init)]
        e.code_chunks.iter().map(|c| ContextFile {
            repo: c.repo_path.repo.clone(),
            path: c.repo_path.path.clone(),
            hidden: false,
            branch: e.query.branch().next().map(Cow::into_owned),
            ranges: vec![c.start_line..c.end_line + 1],
        })
    }))
    .collect::<Vec<_>>();

    let new_context = extract_relevant_chunks(&user, &app, &exchanges, &imported_context).await?;

    let context = canonicalize_context(new_context.clone().into_iter().chain(old_context.clone()))
        .collect::<Vec<_>>();

    let context_json = serde_json::to_string(&context).unwrap();

    let studio_id = match params.studio_id {
        Some(id) => id,
        None => {
            sqlx::query!(
                "INSERT INTO studios(name, project_id) VALUES (?, ?) RETURNING id",
                conversation.title,
                project_id,
            )
            .fetch_one(&mut transaction)
            .await?
            .id
        }
    };

    let messages_json = sqlx::query! {
        "SELECT messages FROM studio_snapshots WHERE id = ?",
        snapshot_id
    }
    .fetch_optional(&mut transaction)
    .await?
    .map(|r| r.messages)
    .unwrap_or_else(|| "[]".to_owned());

    sqlx::query! {
        "INSERT INTO studio_snapshots(studio_id, context, messages) VALUES (?, ?, ?)",
        studio_id,
        context_json,
        messages_json,
    }
    .execute(&mut transaction)
    .await?;

    app.track_studio(
        &user,
        StudioEvent::new(studio_id, "import")
            .with_payload("thread_id", &params.thread_id)
            .with_payload("old_context", &old_context)
            .with_payload("new_context", &new_context),
    );

    transaction.commit().await?;

    Ok(studio_id.to_string())
}

async fn extract_relevant_chunks(
    user: &User,
    app: &Application,
    exchanges: &[Exchange],
    context: &[ContextFile],
) -> webserver::Result<Vec<ContextFile>> {
    let context_json = serde_json::to_string(&context).unwrap();

    let llm_gateway = user
        .llm_gateway(app)
        .await
        .map_err(|e| Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .model(LLM_GATEWAY_MODEL)
        .temperature(0.0);

    // Get last message
    let mut last_message = String::new();
    for exchange in exchanges.iter().rev() {
        if let Some(answer) = &exchange.answer {
            last_message = answer.clone();
            break;
        }
    }

    // Construct LLM messages
    let llm_messages = [
        llm_gateway::api::Message::system(
            "Your job is to output which file paths are used in the answer. Output ONLY a JSON list of \
            paths. For example ['path/to/file1', 'path/to/file2']",
        ),
        llm_gateway::api::Message::assistant(&last_message),
        llm_gateway::api::Message::assistant(&context_json)
    ];

    // Call the LLM gateway
    let result = llm_gateway
        .chat(&llm_messages, None)
        .await
        .and_then(|json: String| serde_json::from_str(&json).map_err(anyhow::Error::new));

    // Parse the response into a JSON list of paths
    let paths: Vec<String> = match result {
        Ok(paths) => paths,
        Err(e) => {
            error!(?e, "failed to parse response from LLM");
            return Ok(context.to_owned());
        }
    };

    // Create a new context with only the files that were in the list
    let mut filtered_context = Vec::new();
    for file in context {
        if paths.contains(&file.path) {
            filtered_context.push(file.clone());
        }
    }

    Ok(filtered_context)
}

fn canonicalize_context(
    context: impl Iterator<Item = ContextFile>,
) -> impl Iterator<Item = ContextFile> {
    context
        .fold(HashMap::<_, Vec<_>>::new(), |mut map, file| {
            let key = (file.path.clone(), file.branch.clone());
            map.entry(key).or_default().push(file);
            map
        })
        .into_values()
        .filter_map(|files| files.into_iter().reduce(ContextFile::merge))
        .map(|mut c| {
            fold_ranges(&mut c.ranges);
            c
        })
}

fn fold_ranges(ranges: &mut Vec<Range<usize>>) {
    ranges.sort_by_key(|range| range.start);
    *ranges = mem::take(ranges).into_iter().fold(Vec::new(), |mut a, e| {
        if let Some(cur) = a.last_mut() {
            if let Some(next) = merge_ranges(cur, e) {
                a.push(next);
            }
        } else {
            a.push(e);
        }

        a
    });
}

/// Try to merge overlapping or nearby ranges.
///
/// This function assumes the input ranges are sorted, such that `a` starts before or at the same
/// position as `b`.
///
/// If `b` is merged with `a`, this will return `None` and modify `a` directly. If this function
/// determines that no merge needs to happen, then `a` will not be modified, and this function will
/// return `Some(b)` back.
fn merge_ranges(a: &mut Range<usize>, b: Range<usize>) -> Option<Range<usize>> {
    const NEARBY_THRESHOLD: usize = 3;

    if b.start <= a.end + NEARBY_THRESHOLD {
        a.end = a.end.max(b.end);
        a.start = a.start.min(b.start);
        None
    } else {
        Some(b)
    }
}

#[derive(serde::Serialize)]
pub struct Snapshot {
    id: i64,
    modified_at: NaiveDateTime,
    context: Vec<ContextFile>,
    doc_context: Vec<DocContextFile>,
    messages: Vec<Message>,
    token_counts: TokenCounts,
}

pub async fn list_snapshots(
    app: Extension<Application>,
    user: Extension<User>,
    Path((project_id, studio_id)): Path<(i64, i64)>,
) -> webserver::Result<Json<Vec<Snapshot>>> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    sqlx::query! {
        "SELECT ss.id as 'id!', ss.modified_at, ss.context, ss.doc_context, ss.messages
        FROM studio_snapshots ss
        JOIN studios s ON s.id = ss.studio_id AND s.project_id = ?
        JOIN projects p ON p.id = s.project_id
        WHERE ss.studio_id = ? AND p.user_id = ?
        ORDER BY modified_at DESC",
        project_id,
        studio_id,
        user_id,
    }
    .fetch(&*app.sql)
    .map_err(Error::internal)
    .and_then(|r| {
        let app = (*app).clone();
        async move {
            let context: Vec<ContextFile> =
                serde_json::from_str(&r.context).context("failed to deserialize context")?;
            let doc_context: Vec<DocContextFile> = serde_json::from_str(&r.doc_context)
                .context("failed to deserialize doc context")?;
            let messages: Vec<Message> =
                serde_json::from_str(&r.messages).context("failed to deserialize messages")?;

            let token_counts = token_counts(app, &messages, &context, &doc_context).await?;

            Ok(Snapshot {
                id: r.id,
                modified_at: r.modified_at,
                context,
                doc_context,
                messages,
                token_counts,
            })
        }
    })
    .try_collect::<Vec<_>>()
    .await
    .map(Json)
}

pub async fn delete_snapshot(
    app: Extension<Application>,
    user: Extension<User>,
    Path((project_id, studio_id, snapshot_id)): Path<(i64, i64, i64)>,
) -> webserver::Result<()> {
    let user_id = user.username().ok_or_else(super::no_user_id)?.to_string();

    sqlx::query! {
        "DELETE FROM studio_snapshots
        WHERE id IN (
            SELECT ss.id
            FROM studio_snapshots ss
            JOIN studios s ON s.id = ss.studio_id
            JOIN projects p ON p.id = s.project_id
            WHERE ss.id = ? AND ss.studio_id = ? AND s.project_id = ? AND p.user_id = ?
        )
        RETURNING id",
        snapshot_id,
        studio_id,
        project_id,
        user_id,
    }
    .fetch_optional(&*app.sql)
    .await?
    .map(|_id| ())
    .ok_or_else(|| Error::not_found("snapshot not found"))
}

#[cfg(test)]
mod test {
    use pretty_assertions::assert_eq;
    use rand::seq::SliceRandom;

    use super::*;

    #[test]
    fn test_merge_ranges_nearby() {
        let mut r = 1..10;
        assert_eq!(merge_ranges(&mut r, 15..20), Some(15..20));
        assert_eq!(r, 1..10);

        assert_eq!(merge_ranges(&mut r, 14..20), Some(14..20));
        assert_eq!(r, 1..10);

        assert_eq!(merge_ranges(&mut r, 13..20), None);
        assert_eq!(r, 1..20);
    }

    #[test]
    fn test_merge_ranges_overlap() {
        let mut r = 1..10;
        assert_eq!(merge_ranges(&mut r, 5..20), None);
        assert_eq!(r, 1..20);
    }

    #[test]
    fn test_merge_weird_ranges() {
        let mut r = 1..10;
        assert_eq!(merge_ranges(&mut r, 1..20), None);
        assert_eq!(r, 1..20);

        // This shouldn't happen as we expect sorted input, but we test anyway.
        let mut r = 5..20;
        assert_eq!(merge_ranges(&mut r, 1..10), None);
        assert_eq!(r, 1..20);
    }

    #[test]
    fn test_fold_ranges() {
        let mut ranges = vec![24..35, 5..12, 15..20, 24..30, 1..10];

        ranges.shuffle(&mut rand::thread_rng());

        fold_ranges(&mut ranges);

        assert_eq!(ranges, [1..20, 24..35]);
    }

    #[test]
    fn test_canonicalize_context() {
        let context = [
            ContextFile {
                path: "README.md".to_owned(),
                hidden: false,
                repo: "github.com/BloopAI/bloop".parse().unwrap(),
                branch: None,
                ranges: vec![5..12, 40..50],
            },
            ContextFile {
                path: "README.md".to_owned(),
                hidden: false,
                repo: "github.com/BloopAI/bloop".parse().unwrap(),
                branch: None,
                ranges: vec![0..10, 20..25],
            },
            ContextFile {
                path: "server/bleep/src/main.rs".to_owned(),
                hidden: true,
                repo: "github.com/BloopAI/bloop".parse().unwrap(),
                branch: None,
                ranges: vec![50..60, 30..35, 25..32],
            },
        ];

        let expected = [
            ContextFile {
                path: "README.md".to_owned(),
                hidden: false,
                repo: "github.com/BloopAI/bloop".parse().unwrap(),
                branch: None,
                ranges: vec![0..12, 20..25, 40..50],
            },
            ContextFile {
                path: "server/bleep/src/main.rs".to_owned(),
                hidden: true,
                repo: "github.com/BloopAI/bloop".parse().unwrap(),
                branch: None,
                ranges: vec![25..35, 50..60],
            },
        ];

        let mut output = canonicalize_context(context.into_iter()).collect::<Vec<_>>();
        output.sort_by_key(|cf| cf.path.clone());

        assert_eq!(&expected[..], &output);
    }
}
