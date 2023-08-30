use std::{borrow::Cow, collections::HashMap, iter, mem, ops::Range, pin::Pin};

use anyhow::{Context, Result};
use axum::{
    extract::{Path, Query},
    response::{sse, Sse},
    Extension, Json,
};
use chrono::NaiveDateTime;
use futures::{pin_mut, stream, StreamExt, TryStreamExt};
use reqwest::StatusCode;
use secrecy::ExposeSecret;
use tracing::error;
use uuid::Uuid;

use super::{middleware::User, Error, ErrorKind};
use crate::{
    agent::{exchange::Exchange, prompts},
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
    params: Json<Create>,
) -> webserver::Result<String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query! {
        "INSERT INTO studios (id, name, context, messages) VALUES (?, ?, ?, ?)",
        id,
        params.name,
        "[]",
        "[]"
    }
    .execute(&*app.sql)
    .await
    .map_err(Error::internal)?;

    Ok(id)
}

#[derive(serde::Serialize)]
pub struct ListItem {
    id: String,
    name: String,
    modified_at: NaiveDateTime,
}

pub async fn list(app: Extension<Application>) -> webserver::Result<Json<Vec<ListItem>>> {
    sqlx::query_as! { ListItem, "SELECT id, name, modified_at FROM studios" }
        .fetch_all(&*app.sql)
        .await
        .map_err(Error::internal)
        .map(Json)
}

#[derive(serde::Serialize)]
pub struct Studio {
    name: String,
    modified_at: NaiveDateTime,
    context: Vec<ContextFile>,
    messages: Vec<Message>,
    token_counts: TokenCounts,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct ContextFile {
    path: String,
    hidden: bool,
    repo: RepoRef,
    branch: Option<String>,
    ranges: Vec<Range<usize>>,
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

pub async fn get(
    app: Extension<Application>,
    Path(id): Path<String>,
) -> webserver::Result<Json<Studio>> {
    let row = sqlx::query! {
        "SELECT id, name, context, messages, modified_at
         FROM studios
         WHERE id = ?",
         id
    }
    .fetch_optional(&*app.sql)
    .await
    .map_err(Error::internal)?
    .ok_or_else(|| Error::new(ErrorKind::NotFound, "unknown studio ID"))?;

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
}

pub async fn patch(
    app: Extension<Application>,
    Path(id): Path<String>,
    Json(patch): Json<Patch>,
) -> webserver::Result<Json<TokenCounts>> {
    let mut transaction = app.sql.begin().await.map_err(Error::internal)?;

    // Ensure the ID is valid first.
    sqlx::query!("SELECT id FROM studios WHERE id = ?", id)
        .fetch_optional(&mut transaction)
        .await
        .map_err(Error::internal)?
        .ok_or_else(|| Error::new(ErrorKind::NotFound, "unknown code studio ID"))?;

    if let Some(name) = patch.name {
        sqlx::query!("UPDATE studios SET name = ? WHERE id = ?", name, id)
            .execute(&mut transaction)
            .await
            .map_err(Error::internal)?;
    }

    if let Some(modified_at) = patch.modified_at {
        sqlx::query!(
            "UPDATE studios SET modified_at = ? WHERE id = ?",
            modified_at,
            id
        )
        .execute(&mut transaction)
        .await
        .map_err(Error::internal)?;
    }

    if let Some(context) = patch.context {
        let json = serde_json::to_string(&context).unwrap();
        sqlx::query!("UPDATE studios SET context = ? WHERE id = ?", json, id)
            .execute(&mut transaction)
            .await
            .map_err(Error::internal)?;
    }

    if let Some(messages) = patch.messages {
        let json = serde_json::to_string(&messages).unwrap();
        sqlx::query!("UPDATE studios SET messages = ? WHERE id = ?", json, id)
            .execute(&mut transaction)
            .await
            .map_err(Error::internal)?;
    }

    sqlx::query!(
        "UPDATE studios SET modified_at = datetime('now') WHERE id = ?",
        id
    )
    .execute(&mut transaction)
    .await
    .map_err(Error::internal)?;

    // Re-fetch the context and messages in case we didn't change them. If we did, this will now
    // contain the updated values.
    let (messages_json, context_json) =
        sqlx::query!("SELECT messages, context FROM studios WHERE id = ?", id)
            .fetch_optional(&mut transaction)
            .await
            .map_err(Error::internal)?
            .map(|r| (r.messages, r.context))
            .unwrap_or_default();

    let context: Vec<ContextFile> =
        serde_json::from_str(&context_json).context("invalid context JSON")?;

    let messages: Vec<Message> =
        serde_json::from_str(&messages_json).context("invalid messages JSON")?;

    let counts = token_counts((*app).clone(), &messages, &context).await?;

    transaction.commit().await.map_err(Error::internal)?;

    Ok(Json(counts))
}

pub async fn delete(app: Extension<Application>, Path(id): Path<String>) -> webserver::Result<()> {
    sqlx::query!("DELETE FROM studios WHERE id = ? RETURNING id", id)
        .fetch_optional(&*app.sql)
        .await
        .map_err(Error::internal)?
        .ok_or_else(|| Error::new(ErrorKind::NotFound, "unknown code studio ID"))
        .map(|_| ())
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
        .then(|file| {
            let app = app.clone();

            async move {
                let doc = app
                    .indexes
                    .file
                    .by_path(&file.repo, &file.path, file.branch.as_deref())
                    .await
                    .map_err(Error::internal)?
                    .with_context(|| {
                        format!(
                            "file `{}` did not exist in repo `{}`, branch `{:?}`",
                            file.path, file.repo, file.branch
                        )
                    })?;

                if file.hidden {
                    return Ok(0);
                }

                let mut token_count = 0;
                let core_bpe = tiktoken_rs::get_bpe_from_model(LLM_GATEWAY_MODEL).unwrap();

                if file.ranges.is_empty() {
                    token_count = core_bpe.encode_ordinary(&doc.content).len();
                } else {
                    let lines = doc.content.lines().collect::<Vec<_>>();
                    for range in &file.ranges {
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

                Ok::<_, Error>(token_count)
            }
        })
        .try_collect::<Vec<_>>()
        .await?;

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

pub async fn generate(
    app: Extension<Application>,
    Path(id): Path<String>,
) -> webserver::Result<Sse<Pin<Box<dyn tokio_stream::Stream<Item = Result<sse::Event>> + Send>>>> {
    let answer_api_token = app
        .answer_api_token()
        .map_err(|e| Error::user(e).with_status(StatusCode::UNAUTHORIZED))?
        .map(|s| s.expose_secret().clone());

    let llm_gateway = llm_gateway::Client::new(&app.config.answer_api_url)
        .model(LLM_GATEWAY_MODEL)
        .temperature(0.0)
        .bearer(answer_api_token);

    let (messages_json, context_json) =
        sqlx::query!("SELECT messages, context FROM studios WHERE id = ?", id)
            .fetch_optional(&*app.sql)
            .await
            .map_err(Error::internal)?
            .map(|row| (row.messages, row.context))
            .ok_or_else(|| Error::new(ErrorKind::NotFound, "unknown code studio ID"))?;

    let mut messages =
        serde_json::from_str::<Vec<Message>>(&messages_json).map_err(Error::internal)?;

    let context =
        serde_json::from_str::<Vec<ContextFile>>(&context_json).map_err(Error::internal)?;

    let llm_context = generate_llm_context((*app).clone(), context).await?;
    let system_prompt = prompts::studio_article_prompt(&llm_context);
    let llm_messages = iter::once(llm_gateway::api::Message::system(&system_prompt))
        .chain(messages.iter().map(llm_gateway::api::Message::from))
        .collect::<Vec<_>>();

    let tokens = llm_gateway
        .chat(&llm_messages, None)
        .await
        .map_err(Error::internal)?;

    let stream = async_stream::try_stream! {
        pin_mut!(tokens);

        let mut response = String::new();

        while let Some(fragment) = tokens.next().await {
            let fragment = fragment?;
            response += &fragment;
            yield response.clone();
        }

        messages.push(Message::Assistant(response));
        let messages_json = serde_json::to_string(&messages).unwrap();
        sqlx::query!("UPDATE studios SET messages = ? WHERE id = ?", messages_json, id)
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
    let response_stream = llm_gateway
        .chat(&llm_messages, None)
        .await
        .map_err(Error::internal)?;

    // Collect the response into a string
    let result = response_stream
        .try_collect()
        .await
        .and_then(|json: String| serde_json::from_str(&json).map_err(|e| anyhow::Error::new(e)));

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

/// Returns a new studio UUID.
pub async fn import(
    app: Extension<Application>,
    user: Extension<User>,
    Query(params): Query<Import>,
) -> webserver::Result<String> {
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
    .fetch_optional(&*app.sql)
    .await
    .map_err(Error::internal)?
    .ok_or_else(|| Error::new(ErrorKind::NotFound, "conversation not found"))?;

    let repo_ref = conversation.repo_ref;
    let exchanges = serde_json::from_str::<Vec<Exchange>>(&conversation.exchanges)
        .context("couldn't deserialize exchange list")?;

    let context = exchanges
        .iter()
        .flat_map(|e| {
            let mut range_map = HashMap::new();

            for c in &e.code_chunks {
                range_map
                    .entry(&c.path)
                    .or_insert_with(Vec::new)
                    .push(c.start_line..c.end_line + 1);
            }

            for ranges in range_map.values_mut() {
                fold_ranges(ranges);
            }

            range_map.into_iter().map(|(path, ranges)| ContextFile {
                path: path.clone(),
                hidden: false,
                repo: repo_ref.parse().unwrap(),
                branch: e.query.branch().next().map(Cow::into_owned),
                ranges,
            })
        })
        .collect::<Vec<_>>();

    let filtered_context = extract_relevant_chunks((*app).clone(), &exchanges, &context).await?;

    let filtered_context_json = serde_json::to_string(&filtered_context).unwrap();

    let studio_id = Uuid::new_v4();
    let studio_id_str = studio_id.to_string();

    sqlx::query! {
        "INSERT INTO studios (id, name, context, messages) VALUES (?, ?, ?, ?)",
        studio_id_str,
        conversation.title,
        filtered_context_json,
        "[]",
    }
    .execute(&*app.sql)
    .await
    .map_err(Error::internal)?;

    Ok(studio_id.to_string())
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

#[cfg(test)]
mod test {
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
}
