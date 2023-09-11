use std::{
    borrow::Cow,
    collections::{HashMap, HashSet},
    iter, mem,
    ops::Range,
    pin::Pin,
};

use anyhow::{Context, Result};
use axum::{
    extract::{Path, Query},
    response::{sse, Sse},
    Extension, Json,
};
use chrono::NaiveDateTime;
use futures::{pin_mut, stream, StreamExt, TryStreamExt};
use rayon::prelude::*;
use reqwest::StatusCode;
use secrecy::ExposeSecret;
use tracing::error;
use uuid::Uuid;

use super::{middleware::User, Error};
use crate::{
    agent::{exchange::Exchange, prompts},
    analytics::StudioEvent,
    llm_gateway,
    repo::RepoRef,
    webserver, Application,
};

const LLM_GATEWAY_MODEL: &str = "gpt-4-0613";

#[derive(serde::Deserialize)]
pub struct Create {
    name: String,
}

pub async fn create(
    app: Extension<Application>,
    user: Extension<User>,
    params: Json<Create>,
) -> webserver::Result<String> {
    let mut transaction = app.sql.begin().await?;

    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let studio_id: i64 = sqlx::query! {
        "INSERT INTO studios (user_id, name) VALUES (?, ?) RETURNING id",
        user_id,
        params.name,
    }
    .fetch_one(&mut transaction)
    .await?
    .id;

    sqlx::query! {
        "INSERT INTO studio_snapshots (studio_id, context, messages)
         VALUES (?, ?, ?)",
        studio_id,
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
pub struct ListItem {
    id: i64,
    name: String,
    modified_at: NaiveDateTime,
    repos: Vec<String>,
    most_common_ext: String,
}

pub async fn list(
    app: Extension<Application>,
    user: Extension<User>,
) -> webserver::Result<Json<Vec<ListItem>>> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let studios = sqlx::query!(
        "SELECT
            s.id,
            s.name,
            ss.modified_at as \"modified_at!\",
            ss.context
        FROM studios s
        INNER JOIN studio_snapshots ss ON s.id = ss.studio_id
        WHERE s.user_id = ? AND (ss.studio_id, ss.modified_at) IN (
            SELECT studio_id, MAX(modified_at)
            FROM studio_snapshots
            GROUP BY studio_id
        )",
        user_id,
    )
    .fetch_all(&*app.sql)
    .await?;

    let mut list_items = Vec::new();

    for studio in studios {
        let context: Vec<ContextFile> =
            serde_json::from_str(&studio.context).map_err(Error::internal)?;

        let repos: HashSet<String> = context.iter().map(|file| file.repo.name.clone()).collect();

        let ext_tokens = token_counts((*app).clone(), &[], &context)
            .await?
            .per_file
            .iter()
            .zip(
                context
                    .iter()
                    .map(|file| file.path.split('.').last().unwrap_or_default()),
            )
            .fold(HashMap::new(), |mut tokens_by_ext, (count, extension)| {
                *tokens_by_ext.entry(extension).or_insert(0) += count;
                tokens_by_ext
            });

        let most_common_ext = ext_tokens
            .into_iter()
            .max_by_key(|(_, tokens)| *tokens)
            .map(|(ext, _)| ext)
            .unwrap_or_default()
            .to_owned();

        let list_item = ListItem {
            id: studio.id,
            name: studio.name,
            modified_at: studio.modified_at,
            repos: repos.into_iter().collect::<Vec<_>>(),
            most_common_ext,
        };

        list_items.push(list_item);
    }

    Ok(Json(list_items))
}

#[derive(serde::Serialize)]
pub struct Studio {
    name: String,
    modified_at: NaiveDateTime,
    context: Vec<ContextFile>,
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

async fn latest_snapshot_id<'a, E>(studio_id: i64, exec: E, user_id: &str) -> webserver::Result<i64>
where
    E: sqlx::Executor<'a, Database = sqlx::Sqlite>,
{
    sqlx::query! {
        "SELECT ss.id
        FROM studio_snapshots ss
        JOIN studios s ON s.id = ss.studio_id AND s.user_id = ?
        WHERE ss.studio_id = ?
        ORDER BY ss.modified_at DESC
        LIMIT 1",
        user_id,
        studio_id,
    }
    .fetch_optional(exec)
    .await?
    .and_then(|r| r.id)
    .ok_or_else(|| Error::not_found("no snapshots with given studio ID"))
}

#[derive(serde::Deserialize)]
pub struct Get {
    pub snapshot_id: Option<i64>,
}

pub async fn get(
    app: Extension<Application>,
    user: Extension<User>,
    Path(id): Path<i64>,
    Query(params): Query<Get>,
) -> webserver::Result<Json<Studio>> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let snapshot_id = match params.snapshot_id {
        Some(id) => id,
        None => latest_snapshot_id(id, &*app.sql, &user_id).await?,
    };

    let row = sqlx::query! {
        "SELECT s.id, s.name, ss.context, ss.messages, ss.modified_at
        FROM studios s
        INNER JOIN studio_snapshots ss ON ss.id = ?
        WHERE s.id = ? AND s.user_id = ?",
        snapshot_id,
        id,
        user_id,
    }
    .fetch_optional(&*app.sql)
    .await?
    .ok_or_else(|| Error::not_found("unknown studio ID"))?;

    let context: Vec<ContextFile> =
        serde_json::from_str(&row.context).context("failed to deserialize context")?;
    let messages: Vec<Message> =
        serde_json::from_str(&row.messages).context("failed to deserialize message list")?;

    Ok(Json(Studio {
        modified_at: row.modified_at,
        name: row.name,
        token_counts: token_counts((*app).clone(), &messages, &context).await?,
        context,
        messages,
    }))
}

#[derive(serde::Deserialize)]
pub struct Patch {
    name: Option<String>,
    modified_at: Option<NaiveDateTime>,
    context: Option<Vec<ContextFile>>,
    messages: Option<Vec<Message>>,
    snapshot_id: Option<i64>,
}

pub async fn patch(
    app: Extension<Application>,
    user: Extension<User>,
    Path(studio_id): Path<i64>,
    Json(patch): Json<Patch>,
) -> webserver::Result<Json<TokenCounts>> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let mut transaction = app.sql.begin().await?;

    let snapshot_id = match patch.snapshot_id {
        Some(id) => id,
        None => latest_snapshot_id(studio_id, &mut transaction, &user_id).await?,
    };

    // Ensure the ID is valid first.
    sqlx::query!(
        "SELECT id FROM studios WHERE id = ? AND user_id = ?",
        studio_id,
        user_id
    )
    .fetch_optional(&mut transaction)
    .await?
    .ok_or_else(|| Error::not_found("unknown code studio ID"))?;

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
    let (messages_json, context_json) = sqlx::query!(
        "SELECT messages, context FROM studio_snapshots WHERE id = ?",
        snapshot_id
    )
    .fetch_optional(&mut transaction)
    .await?
    .map(|r| (r.messages, r.context))
    .unwrap_or_default();

    let context: Vec<ContextFile> =
        serde_json::from_str(&context_json).context("invalid context JSON")?;

    let messages: Vec<Message> =
        serde_json::from_str(&messages_json).context("invalid messages JSON")?;

    let counts = token_counts((*app).clone(), &messages, &context).await?;

    transaction.commit().await?;

    Ok(Json(counts))
}

pub async fn delete(
    app: Extension<Application>,
    user: Extension<User>,
    Path(id): Path<i64>,
) -> webserver::Result<()> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    sqlx::query!(
        "DELETE FROM studios WHERE id = ? AND user_id = ? RETURNING id",
        id,
        user_id
    )
    .fetch_optional(&*app.sql)
    .await?
    .ok_or_else(|| Error::not_found("unknown code studio ID"))
    .map(|_| ())
}

fn get_token_count(body: &str, ranges: &[Range<usize>]) -> usize {
    let mut token_count = 0;
    let core_bpe = tiktoken_rs::get_bpe_from_model("gpt-4-0613").unwrap();

    if ranges.is_empty() {
        token_count = core_bpe.encode_ordinary(body).len();
    } else {
        let lines = body.lines().collect::<Vec<_>>();
        for range in ranges {
            let chunk = lines
                .iter()
                .copied()
                .skip(range.start)
                .take(range.end - range.start)
                .collect::<Vec<_>>()
                .join("\n");
            token_count += core_bpe.encode_ordinary(&chunk).len();
        }
    }

    token_count
}

#[derive(serde::Serialize)]
pub struct TokenCounts {
    total: usize,
    messages: usize,
    per_file: Vec<usize>,
}

async fn token_counts(
    app: Application,
    messages: &[Message],
    context: &[ContextFile],
) -> webserver::Result<TokenCounts> {
    let per_file = stream::iter(context)
        .map(|file| {
            let app = app.clone();

            async move {
                if file.hidden {
                    return Ok::<_, Error>(None);
                }

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

                Ok(Some((file, doc.content)))
            }
        })
        // We need to box here, to avoid a higher-ranked lifetime error.
        .boxed()
        .buffered(16)
        .try_collect::<Vec<_>>()
        .await?
        .into_par_iter()
        .map(|data: Option<(&ContextFile, String)>| {
            let (file, body) = match data {
                Some(t) => t,
                None => return 0,
            };

            get_token_count(&body, &file.ranges)
        })
        .collect::<Vec<_>>();

    let empty_system_message = tiktoken_rs::ChatCompletionRequestMessage {
        role: "system".to_owned(),
        content: prompts::studio_article_prompt(""),
        name: None,
    };

    let tiktoken_messages = messages.iter().cloned().map(|message| match message {
        Message::User(content) => tiktoken_rs::ChatCompletionRequestMessage {
            role: "user".to_owned(),
            content,
            name: None,
        },
        Message::Assistant(content) => tiktoken_rs::ChatCompletionRequestMessage {
            role: "assistant".to_owned(),
            content,
            name: None,
        },
    });

    let messages = tiktoken_rs::num_tokens_from_messages(
        LLM_GATEWAY_MODEL,
        &iter::once(empty_system_message)
            .chain(tiktoken_messages)
            .collect::<Vec<_>>(),
    )
    .unwrap();

    Ok(TokenCounts {
        total: per_file.iter().sum::<usize>() + messages,
        messages,
        per_file,
    })
}

#[derive(serde::Deserialize)]
pub struct GetTokenCount {
    pub path: String,
    pub repo: RepoRef,
    pub branch: Option<String>,
    pub ranges: Option<Vec<Range<usize>>>,
}

pub async fn get_file_token_count(
    app: Extension<Application>,
    Json(params): Json<GetTokenCount>,
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

    let token_count = get_token_count(&doc.content, &file.ranges);

    Ok(Json(token_count))
}

pub async fn generate(
    app: Extension<Application>,
    Extension(user): Extension<User>,
    Path(studio_id): Path<i64>,
) -> webserver::Result<Sse<Pin<Box<dyn tokio_stream::Stream<Item = Result<sse::Event>> + Send>>>> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let snapshot_id = latest_snapshot_id(studio_id, &*app.sql, &user_id).await?;

    let answer_api_token = app
        .answer_api_token()
        .map_err(|e| Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .map(|s| s.expose_secret().clone());

    let llm_gateway = llm_gateway::Client::new(&app.config.answer_api_url)
        .quota_gated(true)
        .model(LLM_GATEWAY_MODEL)
        .temperature(0.0)
        .bearer(answer_api_token);

    let (messages_json, context_json) = sqlx::query!(
        "SELECT messages, context FROM studio_snapshots WHERE id = ?",
        snapshot_id,
    )
    .fetch_optional(&*app.sql)
    .await?
    .map(|row| (row.messages, row.context))
    .ok_or_else(|| Error::not_found("unknown code studio ID"))?;

    let mut messages =
        serde_json::from_str::<Vec<Message>>(&messages_json).map_err(Error::internal)?;

    let context =
        serde_json::from_str::<Vec<ContextFile>>(&context_json).map_err(Error::internal)?;

    app.track_studio(
        &user,
        StudioEvent::new(studio_id, "generate")
            .with_payload("context", &context)
            .with_payload("messages", &messages),
    );

    let llm_context = generate_llm_context((*app).clone(), context).await?;
    let system_prompt = prompts::studio_article_prompt(&llm_context);
    let llm_messages = iter::once(llm_gateway::api::Message::system(&system_prompt))
        .chain(messages.iter().map(llm_gateway::api::Message::from))
        .collect::<Vec<_>>();

    let tokens = llm_gateway.chat(&llm_messages, None).await?;

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
            "INSERT INTO studio_snapshots(studio_id, context, messages)
            SELECT studio_id, context, ?
            FROM studio_snapshots
            WHERE id = ?",
            messages_json,
            snapshot_id,
        }
        .execute(&*app.sql)
        .await?;
    };

    let mut errored = false;
    let stream = stream.take_while(move |e| {
        let ok = !errored;
        if let Err(e) = &e {
            error!(?e, "stream error");
            errored = true;
        }
        async move { ok }
    });

    let event_stream = stream.map(|result| {
        sse::Event::default()
            .json_data(result.map_err(|e: anyhow::Error| e.to_string()))
            .map_err(anyhow::Error::new)
    });
    let done_stream = stream::once(async { Ok(sse::Event::default().data("[DONE]")) });

    let stream = event_stream.chain(done_stream);

    Ok(Sse::new(Box::pin(stream)))
}

async fn generate_llm_context(app: Application, context: Vec<ContextFile>) -> Result<String> {
    let mut s = String::new();

    s += "##### PATHS #####\n";

    for file in context.iter().filter(|f| !f.hidden) {
        s += &format!("{}\n", file.path);
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

            s += &format!("### {} ###\n{snippet}\n", file.path);
        }
    }

    Ok(s)
}

#[derive(serde::Deserialize)]
pub struct Import {
    pub thread_id: Uuid,
    /// An optional studio ID to import into.
    pub studio_id: Option<i64>,
}

async fn extract_relevant_chunks(
    app: Application,
    exchanges: &[Exchange],
    context: &[ContextFile],
) -> webserver::Result<Vec<ContextFile>> {
    let context_json = serde_json::to_string(&context).unwrap();

    let answer_api_token = app
        .answer_api_token()
        .map_err(|e| Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .map(|s| s.expose_secret().clone());

    // Create an instance of the LLM gateway client
    let llm_gateway = llm_gateway::Client::new(&app.config.answer_api_url)
        .model(LLM_GATEWAY_MODEL)
        .temperature(0.0)
        .bearer(answer_api_token);

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
    let response_stream = llm_gateway.chat(&llm_messages, None).await?;

    // Collect the response into a string
    let result = response_stream
        .try_collect()
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

/// Returns a new studio UUID, or the `?studio_id=...` query param if present.
pub async fn import(
    app: Extension<Application>,
    user: Extension<User>,
    Query(params): Query<Import>,
) -> webserver::Result<String> {
    let mut transaction = app.sql.begin().await?;

    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    let thread_id = params.thread_id.to_string();

    let conversation = sqlx::query! {
        "SELECT title, repo_ref, exchanges
        FROM conversations
        WHERE user_id = ? AND thread_id = ?",
        user_id,
        thread_id,
    }
    .fetch_optional(&mut transaction)
    .await?
    .ok_or_else(|| Error::not_found("conversation not found"))?;

    let repo_ref = conversation.repo_ref;
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
        .ok_or_else(|| Error::not_found("unknown studio ID"))
        .and_then(|r| serde_json::from_str(&r.context).map_err(Error::internal))?
    } else {
        Vec::new()
    };

    let imported_context = canonicalize_context(exchanges.iter().flat_map(|e| {
        e.code_chunks.iter().map(|c| ContextFile {
            path: c.path.clone(),
            hidden: false,
            repo: repo_ref.parse().unwrap(),
            branch: e.query.branch().next().map(Cow::into_owned),
            ranges: vec![c.start_line..c.end_line + 1],
        })
    }))
    .collect::<Vec<_>>();

    let new_context =
        extract_relevant_chunks((*app).clone(), &exchanges, &imported_context).await?;

    let context = canonicalize_context(new_context.clone().into_iter().chain(old_context.clone()))
        .collect::<Vec<_>>();

    let context_json = serde_json::to_string(&context).unwrap();

    let studio_id = match params.studio_id {
        Some(id) => id,
        None => {
            sqlx::query!(
                "INSERT INTO studios(name, user_id) VALUES (?, ?) RETURNING id",
                conversation.title,
                user_id,
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

fn canonicalize_context(
    context: impl Iterator<Item = ContextFile>,
) -> impl Iterator<Item = ContextFile> {
    context
        .fold(HashMap::new(), |mut map, file| {
            let key = (file.path.clone(), file.branch.clone());
            map.entry(key).or_insert_with(Vec::new).push(file);
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
    messages: Vec<Message>,
}

pub async fn list_snapshots(
    app: Extension<Application>,
    user: Extension<User>,
    Path(studio_id): Path<i64>,
) -> webserver::Result<Json<Vec<Snapshot>>> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    sqlx::query! {
        "SELECT ss.id as 'id!', ss.modified_at, ss.context, ss.messages
        FROM studio_snapshots ss
        JOIN studios s ON s.id = ss.studio_id AND s.user_id = ?
        WHERE ss.studio_id = ?
        ORDER BY modified_at DESC",
        user_id,
        studio_id,
    }
    .fetch(&*app.sql)
    .map_err(Error::internal)
    .and_then(|r| async move {
        Ok(Snapshot {
            id: r.id,
            modified_at: r.modified_at,
            context: serde_json::from_str(&r.context).context("failed to deserialize context")?,
            messages: serde_json::from_str(&r.messages)
                .context("failed to deserialize messages")?,
        })
    })
    .try_collect::<Vec<_>>()
    .await
    .map(Json)
}

pub async fn delete_snapshot(
    app: Extension<Application>,
    user: Extension<User>,
    Path((studio_id, snapshot_id)): Path<(i64, i64)>,
) -> webserver::Result<()> {
    let user_id = user
        .login()
        .ok_or_else(|| super::Error::user("didn't have user ID"))?
        .to_string();

    sqlx::query! {
        "DELETE FROM studio_snapshots
        WHERE id IN (
            SELECT ss.id
            FROM studio_snapshots ss
            JOIN studios s ON s.id = ss.studio_id AND s.user_id = ?
            WHERE ss.id = ? AND ss.studio_id = ?
        )
        RETURNING id",
        user_id,
        snapshot_id,
        studio_id,
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
