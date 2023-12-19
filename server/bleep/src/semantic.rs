use std::{borrow::Cow, collections::HashMap, env, path::Path, sync::Arc};

use crate::{query::parser::SemanticQuery, Configuration};

use anyhow::bail;
use qdrant_client::{
    prelude::{QdrantClient, QdrantClientConfig},
    qdrant::{
        point_id::PointIdOptions, r#match::MatchValue, vectors::VectorsOptions,
        with_payload_selector, with_vectors_selector, CollectionOperationResponse, FieldCondition,
        FieldType, Filter, Match, PointId, PointsOperationResponse, RetrievedPoint, ScoredPoint,
        SearchParams, SearchPoints, Value, Vectors, WithPayloadSelector, WithVectorsSelector,
    },
};

use futures::{stream, StreamExt, TryStreamExt};
use rayon::prelude::*;
use thiserror::Error;
use tracing::{debug, error, info, trace, warn};

pub mod chunk;
pub mod embedder;
pub mod execute;
mod schema;

pub use embedder::Embedder;
use embedder::LocalEmbedder;
use schema::{create_collection, create_lexical_index, EMBEDDING_DIM};
pub use schema::{Embedding, Payload};

use itertools::Itertools;

#[derive(Error, Debug)]
pub enum SemanticError {
    /// Represents failure to initialize Qdrant client
    #[error("Qdrant initialization failed. Is Qdrant running on `qdrant-url`?")]
    QdrantInitializationError,

    #[cfg(feature = "onnx")]
    #[error("ONNX runtime error")]
    OnnxRuntimeError {
        #[from]
        error: ort::OrtError,
    },

    #[error("semantic error")]
    Anyhow {
        #[from]
        error: anyhow::Error,
    },
}

#[derive(Debug, Clone)]
pub struct SemanticSearchParams {
    pub limit: u64,
    pub offset: u64,
    pub threshold: f32,
    pub exact_match: bool, // keyword match for all filters
}

#[derive(Clone)]
pub struct Semantic {
    qdrant: Arc<QdrantClient>,
    embedder: Arc<dyn Embedder>,
    pub(crate) config: Arc<Configuration>,
}

macro_rules! val_str(($hash:ident, $val:expr) => { serde_json::from_value($hash.remove($val).unwrap()).unwrap() });
macro_rules! val_parse_str(($hash:ident, $val:expr) => {
    serde_json::from_value::<Cow<'_, str>>($hash.remove($val).unwrap())
        .unwrap()
        .parse()
        .unwrap()
});

impl Payload {
    pub fn from_qdrant(orig: ScoredPoint) -> Payload {
        let ScoredPoint {
            id,
            payload,
            score,
            vectors,
            ..
        } = orig;

        parse_payload(id, vectors, payload, score)
    }

    pub fn from_scroll(orig: RetrievedPoint) -> Payload {
        let RetrievedPoint {
            id,
            payload,
            vectors,
            ..
        } = orig;

        parse_payload(id, vectors, payload, 0.0)
    }

    pub(crate) fn into_qdrant(self) -> HashMap<String, Value> {
        HashMap::from([
            ("lang".into(), self.lang.to_ascii_lowercase().into()),
            ("repo_name".into(), self.repo_name.into()),
            ("repo_ref".into(), self.repo_ref.into()),
            ("relative_path".into(), self.relative_path.into()),
            ("content_hash".into(), self.content_hash.into()),
            ("snippet".into(), self.text.into()),
            ("start_line".into(), self.start_line.to_string().into()),
            ("end_line".into(), self.end_line.to_string().into()),
            ("start_byte".into(), self.start_byte.to_string().into()),
            ("end_byte".into(), self.end_byte.to_string().into()),
            ("branches".into(), self.branches.into()),
        ])
    }
}

fn parse_payload(
    id: Option<PointId>,
    vectors: Option<Vectors>,
    payload: HashMap<String, Value>,
    score: f32,
) -> Payload {
    let Some(PointId {
        point_id_options: Some(PointIdOptions::Uuid(id)),
    }) = id
    else {
        // unless the db was corrupted/written by someone else,
        // this shouldn't happen
        unreachable!("corrupted db");
    };

    let embedding = match vectors {
        None => None,
        Some(Vectors {
            vectors_options: Some(VectorsOptions::Vector(v)),
        }) => Some(v.data),
        _ => {
            // this also should probably never happen
            unreachable!("got non-vector value");
        }
    };

    let mut converted = payload
        .into_iter()
        .map(|(key, value)| (key, kind_to_value(value.kind)))
        .collect::<HashMap<String, serde_json::Value>>();

    Payload {
        lang: val_str!(converted, "lang"),
        repo_name: val_str!(converted, "repo_name"),
        repo_ref: val_str!(converted, "repo_ref"),
        relative_path: val_str!(converted, "relative_path"),
        content_hash: val_str!(converted, "content_hash"),
        text: val_str!(converted, "snippet"),
        branches: val_str!(converted, "branches"),
        start_line: val_parse_str!(converted, "start_line"),
        end_line: val_parse_str!(converted, "end_line"),
        start_byte: val_parse_str!(converted, "start_byte"),
        end_byte: val_parse_str!(converted, "end_byte"),

        id: Some(id),
        score: Some(score),
        embedding,
    }
}

fn kind_to_value(kind: Option<qdrant_client::qdrant::value::Kind>) -> serde_json::Value {
    use qdrant_client::qdrant::value::Kind;
    match kind {
        Some(Kind::NullValue(_)) => serde_json::Value::Null,
        Some(Kind::BoolValue(v)) => serde_json::Value::Bool(v),
        Some(Kind::DoubleValue(v)) => {
            serde_json::Value::Number(serde_json::Number::from_f64(v).unwrap())
        }
        Some(Kind::IntegerValue(v)) => serde_json::Value::Number(v.into()),
        Some(Kind::StringValue(v)) => serde_json::Value::String(v),
        Some(Kind::ListValue(v)) => serde_json::Value::Array(
            v.values
                .into_iter()
                .map(|v| kind_to_value(v.kind))
                .collect(),
        ),
        Some(Kind::StructValue(_v)) => todo!(),
        None => serde_json::Value::Null,
    }
}

async fn create_indexes(collection_name: &str, qdrant: &QdrantClient) -> anyhow::Result<()> {
    let text_fields = &["repo_ref", "content_hash", "branches", "relative_path"];
    for field in text_fields {
        qdrant
            .create_field_index(collection_name, field, FieldType::Text, None, None)
            .await?;
    }

    Ok(())
}

impl Semantic {
    #[tracing::instrument(fields(collection=%config.collection_name, %qdrant_url), skip_all)]
    pub async fn initialize(
        model_dir: &Path,
        qdrant_url: &str,
        config: Arc<Configuration>,
    ) -> Result<Self, SemanticError> {
        let qdrant = QdrantClient::new(Some(QdrantClientConfig::from_url(qdrant_url))).unwrap();
        debug!("initialized client");

        match qdrant.has_collection(&config.collection_name).await {
            Ok(false) => {
                let CollectionOperationResponse { result, time } =
                    create_collection(&config.collection_name, &qdrant)
                        .await
                        .unwrap();

                debug!(time, created = result, "collection created");
                assert!(result);
                let PointsOperationResponse { result, time: _ } =
                    create_lexical_index(&config.collection_name, &qdrant)
                        .await
                        .unwrap();

                debug!("lexical index created");
                debug!("{:?}", result);
            }
            Ok(true) => {
                debug!("collection already exists");
            }
            Err(_) => return Err(SemanticError::QdrantInitializationError),
        }

        create_indexes(&config.collection_name, &qdrant).await?;
        debug!("indexes created");

        if let Some(dylib_dir) = config.dylib_dir.as_ref() {
            init_ort_dylib(dylib_dir);
            debug!(
                dylib_dir = dylib_dir.to_string_lossy().as_ref(),
                "initialized ORT dylib"
            );
        }

        #[cfg(feature = "ee-cloud")]
        let embedder: Arc<dyn Embedder> = if let Some(ref url) = config.embedding_server_url {
            let embedder = Arc::new(embedder::RemoteEmbedder::new(url.clone(), model_dir)?);
            debug!("using remote embedder");
            embedder
        } else {
            let embedder = Arc::new(LocalEmbedder::new(model_dir)?);
            debug!("using local embedder");
            embedder
        };

        #[cfg(not(feature = "ee-cloud"))]
        let embedder: Arc<dyn Embedder> = Arc::new(LocalEmbedder::new(model_dir)?);
        debug!("using local embedder");

        Ok(Self {
            qdrant: qdrant.into(),
            embedder,
            config,
        })
    }

    pub fn collection_name(&self) -> &str {
        &self.config.collection_name
    }

    pub fn qdrant_client(&self) -> &QdrantClient {
        &self.qdrant
    }

    pub fn embedder(&self) -> &dyn Embedder {
        self.embedder.as_ref()
    }

    pub async fn reset_collection_blocking(&self) -> anyhow::Result<()> {
        _ = self
            .qdrant
            .delete_collection(&self.config.collection_name)
            .await?;

        let deleted = 'deleted: {
            for _ in 0..60 {
                match self
                    .qdrant
                    .has_collection(&self.config.collection_name)
                    .await
                {
                    Ok(true) => {
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    }
                    Ok(false) => {
                        break 'deleted true;
                    }
                    Err(err) => {
                        error!(?err, "failed to delete qdrant collection for migration");
                    }
                }
            }
            false
        };

        if !deleted {
            error!("failed to delete qdrant collection after 60s");
            bail!("deletion failed")
        }

        let CollectionOperationResponse { result, .. } =
            create_collection(&self.config.collection_name, &self.qdrant)
                .await
                .unwrap();

        assert!(result);

        let PointsOperationResponse { result, time: _ } =
            create_lexical_index(&self.config.collection_name, &self.qdrant)
                .await
                .unwrap();

        debug!("lexical index created");
        debug!("{:?}", result);

        Ok(())
    }

    pub async fn health_check(&self) -> anyhow::Result<()> {
        self.qdrant.health_check().await?;
        Ok(())
    }

    // Search Qdrant snippets (payload)
    pub async fn search_lexical<'a>(
        &self,
        parsed_query: &SemanticQuery<'a>,
        vector: Embedding,
        limit: u64,
        offset: u64,
        threshold: f32,
        exact: bool,
    ) -> anyhow::Result<Vec<ScoredPoint>> {
        let hybrid_filter = Some(Filter {
            should: build_conditions_lexical(parsed_query),
            must: build_conditions(parsed_query, exact),
            ..Default::default()
        });

        let response = self
            .qdrant
            .search_points(&SearchPoints {
                limit,
                vector,
                collection_name: self.config.collection_name.to_string(),
                offset: Some(offset),
                score_threshold: Some(threshold),
                with_payload: Some(true.into()),
                filter: hybrid_filter,
                with_vectors: Some(true.into()),
                ..Default::default()
            })
            .await?;

        Ok(response.result)
    }

    pub async fn search_with<'a>(
        &self,
        parsed_query: &SemanticQuery<'a>,
        vector: Embedding,
        limit: u64,
        offset: u64,
        threshold: f32,
        exact: bool,
    ) -> anyhow::Result<Vec<ScoredPoint>> {
        let response = self
            .qdrant
            .search_points(&SearchPoints {
                limit,
                vector,
                collection_name: self.config.collection_name.to_string(),
                offset: Some(offset),
                score_threshold: Some(threshold),
                with_payload: Some(WithPayloadSelector {
                    selector_options: Some(with_payload_selector::SelectorOptions::Enable(true)),
                }),
                filter: Some(Filter {
                    must: build_conditions(parsed_query, exact),
                    ..Default::default()
                }),
                with_vectors: Some(WithVectorsSelector {
                    selector_options: Some(with_vectors_selector::SelectorOptions::Enable(true)),
                }),
                params: Some(SearchParams {
                    indexed_only: Some(true),
                    ..Default::default()
                }),
                ..Default::default()
            })
            .await?;

        Ok(response.result)
    }

    pub async fn batch_search_with<'a>(
        &self,
        parsed_queries: &[&SemanticQuery<'a>],
        vectors: Vec<Embedding>,
        limit: u64,
        offset: u64,
        threshold: f32,
        exact: bool,
    ) -> anyhow::Result<Vec<ScoredPoint>> {
        // FIXME: This method uses `search_points` internally, and not `search_batch_points`. It's
        // not clear why, but it seems that the `batch` variant of the `qdrant` calls leads to
        // HTTP2 errors on some deployment configurations. A typical example error:
        //
        // ```
        // hyper::proto::h2::client: client response error: stream error received: stream no longer needed
        // ```
        //
        // Given that qdrant uses `tonic`, this may be a `tonic` issue, possibly similar to:
        // https://github.com/hyperium/tonic/issues/222

        // Queries should contain the same filters, so we get the first one
        let parsed_query = parsed_queries.first().unwrap();
        let filters = &build_conditions(parsed_query, exact);

        let responses = stream::iter(vectors.into_iter())
            .map(|vector| async move {
                let points = SearchPoints {
                    limit,
                    vector,
                    collection_name: self.config.collection_name.to_string(),
                    offset: Some(offset),
                    score_threshold: Some(threshold),
                    with_payload: Some(WithPayloadSelector {
                        selector_options: Some(with_payload_selector::SelectorOptions::Enable(
                            true,
                        )),
                    }),
                    filter: Some(Filter {
                        must: filters.clone(),
                        ..Default::default()
                    }),
                    with_vectors: Some(WithVectorsSelector {
                        selector_options: Some(with_vectors_selector::SelectorOptions::Enable(
                            true,
                        )),
                    }),
                    ..Default::default()
                };

                self.qdrant.search_points(&points).await
            })
            .buffered(10)
            .try_collect::<Vec<_>>()
            .await?;

        Ok(responses.into_iter().flat_map(|r| r.result).collect())
    }

    // Rank Qdrant lexical results by counts of word matches
    // Multiple word hits count more
    // Score is 10 * (# of query words matched) + (total number of hits)
    fn rank_lexical(payloads: Vec<Payload>, query: &str) -> Vec<Payload> {
        let keywords: Vec<&str> = query.split_whitespace().collect();
        let counts = payloads.iter().map(|p| {
            (
                keywords
                    .iter()
                    .map(|&k| p.text.matches(k).count())
                    .collect::<Vec<usize>>(),
                p.clone(),
            )
        });
        let mut scores: Vec<(f32, Payload)> = counts
            .map(|(count, payload)| {
                let score: f32 = (count.iter().sum::<usize>()
                    + 10 * count.iter().filter(|&&c| c != 0).count())
                    as f32;
                (score, payload.clone())
            })
            .collect();
        scores.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        scores.into_iter().map(|(_, payload)| payload).collect()
    }

    // Join semantic and lexical results using Reciprocal Rank Fusion (RRF)
    // For item i present in j rankings (rank_i,j) score_i = sum_j (1/ (rank_i,j + k))
    // k controls how much weight to give to lower ranks and is set to 60 which is
    // the default value in multiple implementations and in http://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf
    fn merge_rrf(payloads_lexical: Vec<Payload>, payloads_semantic: Vec<Payload>) -> Vec<Payload> {
        let k = 60;
        let lexical_scores = payloads_lexical
            .into_iter()
            .enumerate()
            .map(|(rank, payload)| (1.0 / ((rank + 1 + k) as f32), payload.clone()));
        let payload_scores = payloads_semantic
            .into_iter()
            .enumerate()
            .map(|(rank, payload)| (1.0 / ((rank + 1 + k) as f32), payload.clone()));
        let mut concatenated: Vec<(f32, Payload)> = lexical_scores.chain(payload_scores).collect();
        // group by requires pre-sorting
        concatenated.sort_by(|a, b| {
            b.1.id
                .partial_cmp(&a.1.id)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        let mut merged: Vec<(f32, Payload)> = concatenated
            .iter()
            .group_by(|(_, payload)| payload.id.clone())
            .into_iter()
            .map(|(_id, group)| {
                let group_vec: Vec<_> = group.collect();

                let sum: f32 = group_vec.iter().map(|(score, _payload)| score).sum();
                let payload = group_vec
                    .into_iter()
                    .map(|(_score, payload)| payload)
                    .next();
                (sum, payload.cloned().unwrap())
            })
            .collect();
        merged.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        merged.into_iter().map(|(_, payload)| payload).collect()
    }

    pub async fn search<'a>(
        &self,
        parsed_query: &SemanticQuery<'a>,
        params: SemanticSearchParams,
    ) -> anyhow::Result<Vec<Payload>> {
        let Some(query) = parsed_query.target() else {
            anyhow::bail!("no search target for query");
        };
        let vector = self.embedder.embed(&query).await?;
        let SemanticSearchParams {
            limit,
            offset,
            threshold,
            exact_match: exact,
        } = params;

        // TODO: Remove the need for `retrieve_more`. It's here because:
        // In /q `limit` is the maximum number of results returned (the actual number will often be lower due to deduplication)
        // In /answer we want to retrieve `limit` results exactly
        let results = self
            .search_with(
                parsed_query,
                vector.clone(),
                limit * 2, // Retrieve double `limit` and deduplicate
                offset,
                threshold,
                exact,
            )
            .await
            .map(|raw| {
                raw.into_iter()
                    .map(Payload::from_qdrant)
                    .collect::<Vec<_>>()
            })?;
        let results = deduplicate_snippets(results, vector.clone(), limit);

        let results_lexical = self
            .search_lexical(
                parsed_query,
                vector.clone(),
                limit * 2, // Retrieve double `limit` and deduplicate
                offset,
                0.0,
                exact,
            )
            .await
            .map(|raw| {
                raw.into_iter()
                    .map(Payload::from_qdrant)
                    .collect::<Vec<_>>()
            })?;
        let results_lexical = deduplicate_snippets(results_lexical, vector.clone(), limit);
        let results_lexical = Self::rank_lexical(results_lexical, &query);

        let merged_results = Self::merge_rrf(results_lexical, results);

        Ok(merged_results
            .iter()
            .take(limit.try_into().unwrap())
            .cloned()
            .collect())
    }

    pub async fn batch_search<'a>(
        &self,
        parsed_queries: &[&SemanticQuery<'a>],
        params: SemanticSearchParams,
    ) -> anyhow::Result<Vec<Payload>> {
        if parsed_queries.iter().any(|q| q.target().is_none()) {
            anyhow::bail!("no search target for query");
        };

        let vectors = futures::future::join_all(
            parsed_queries
                .iter()
                .map(|q| async { self.embedder.embed(&q.target().unwrap()).await }),
        )
        .await
        .into_iter()
        .collect::<anyhow::Result<Vec<_>>>()?;

        let SemanticSearchParams {
            limit,
            offset,
            threshold,
            exact_match: exact,
        } = params;

        trace!(?parsed_queries, "performing qdrant batch search");

        let result = self
            .batch_search_with(
                parsed_queries,
                vectors.clone(),
                limit * 2, // Retrieve double `limit` and deduplicate
                offset,
                threshold,
                exact,
            )
            .await;

        trace!(?result, "qdrant batch search returned");

        let results = result?
            .into_iter()
            .map(Payload::from_qdrant)
            .collect::<Vec<_>>();

        // deduplicate with mmr with respect to the mean of query vectors
        // TODO: implement a more robust multi-vector deduplication strategy
        let target_vector = mean_pool(vectors);
        Ok(deduplicate_snippets(results, target_vector, limit))
    }

    #[allow(clippy::too_many_arguments)]
    #[tracing::instrument(skip(self, repo_name, buffer))]
    pub fn chunks_for_buffer<'a>(
        &'a self,
        file_cache_key: String,
        repo_name: &'a str,
        repo_ref: &'a str,
        relative_path: &'a str,
        buffer: &'a str,
        lang_str: &'a str,
        branches: &'a [String],
    ) -> impl ParallelIterator<Item = (String, Payload)> + 'a {
        const MIN_CHUNK_TOKENS: usize = 50;

        let chunks = chunk::by_tokens(
            repo_name,
            relative_path,
            buffer,
            self.embedder.tokenizer(),
            MIN_CHUNK_TOKENS..self.config.max_chunk_tokens,
            chunk::OverlapStrategy::default(),
        );
        trace!(chunk_count = chunks.len(), "found chunks");

        chunks.into_par_iter().map(move |chunk| {
            let data = format!("{repo_name}\t{relative_path}\n{}", chunk.data);
            let payload = Payload {
                repo_name: repo_name.to_owned(),
                repo_ref: repo_ref.to_owned(),
                relative_path: relative_path.to_owned(),
                content_hash: file_cache_key.to_string(),
                text: chunk.data.to_owned(),
                lang: lang_str.to_ascii_lowercase(),
                branches: branches.to_owned(),
                start_line: chunk.range.start.line as u64,
                end_line: chunk.range.end.line as u64,
                start_byte: chunk.range.start.byte as u64,
                end_byte: chunk.range.end.byte as u64,
                ..Default::default()
            };

            (data, payload)
        })
    }

    pub async fn delete_points_for_hash(
        &self,
        repo_ref: &str,
        paths: impl Iterator<Item = String>,
    ) {
        let repo_filter = make_kv_keyword_filter("repo_ref", repo_ref).into();
        let file_filter = paths
            .map(|p| make_kv_keyword_filter("content_hash", &p).into())
            .collect::<Vec<_>>();

        let selector = Filter {
            must: vec![repo_filter],
            should: file_filter,
            ..Default::default()
        }
        .into();

        let _ = self
            .qdrant
            .delete_points(&self.config.collection_name, &selector, None)
            .await;
    }
}

/// Initialize the `ORT_DYLIB_PATH` variable, consumed by the `ort` crate.
///
/// This doesn't do anything on Windows, as tauri on Windows will automatically bundle any `.dll`
/// files found in the `target/$profile` folder. The `ort` crate by default will also copy the
/// built dynamic library over to the `target/$profile` folder, when using the download strategy.
fn init_ort_dylib(dylib_dir: impl AsRef<Path>) {
    #[cfg(target_os = "linux")]
    let lib_name = "libonnxruntime.so";
    #[cfg(target_os = "macos")]
    let lib_name = "libonnxruntime.dylib";
    #[cfg(windows)]
    let lib_name = "onnxruntime.dll";

    let ort_dylib_path = dylib_dir.as_ref().join(lib_name);

    if env::var("ORT_DYLIB_PATH").is_err() {
        env::set_var("ORT_DYLIB_PATH", ort_dylib_path);
    }
}

/// Exact match filter
pub(crate) fn make_kv_keyword_filter(key: &str, value: &str) -> FieldCondition {
    let key = key.to_owned();
    let value = value.to_owned();
    FieldCondition {
        key,
        r#match: Some(Match {
            match_value: MatchValue::Keyword(value).into(),
        }),
        ..Default::default()
    }
}

// Substring match filter
fn make_kv_text_filter(key: &str, value: &str) -> FieldCondition {
    let key = key.to_owned();
    let value = value.to_owned();
    FieldCondition {
        key,
        r#match: Some(Match {
            match_value: MatchValue::Text(value).into(),
        }),
        ..Default::default()
    }
}

// add a filter that matches any of the keywords in the query
fn build_conditions_lexical(
    parsed_query: &SemanticQuery<'_>,
) -> Vec<qdrant_client::qdrant::Condition> {
    let Some(query) = parsed_query.target() else {
        debug!("empty query for lexical search");
        return Vec::new();
    };
    let conditions = query
        .split(' ')
        .map(|s| make_kv_text_filter("snippet", s))
        .map(Into::into)
        .collect::<Vec<FieldCondition>>();
    conditions
        .iter()
        .map(|c| qdrant_client::qdrant::Condition {
            condition_one_of: Some(qdrant_client::qdrant::condition::ConditionOneOf::Field(
                c.clone(),
            )),
        })
        .collect()
}

fn build_conditions(
    query: &SemanticQuery<'_>,
    exact_match: bool,
) -> Vec<qdrant_client::qdrant::Condition> {
    let path_filter = {
        let conditions = query
            .paths()
            .map(|r| {
                if exact_match {
                    make_kv_keyword_filter("relative_path", r.as_ref())
                } else {
                    make_kv_text_filter("relative_path", r.as_ref())
                }
                .into()
            })
            .collect::<Vec<_>>();
        if conditions.is_empty() {
            None
        } else {
            Some(Filter {
                should: conditions,
                ..Default::default()
            })
        }
    };

    let repo_filter = {
        let conditions = query
            .repos()
            .map(|r| {
                if r.contains('/') && !r.starts_with("github.com/") {
                    format!("github.com/{r}")
                } else {
                    r.to_string()
                }
            })
            .map(|r| make_kv_keyword_filter("repo_name", r.as_ref()).into())
            .collect::<Vec<_>>();
        // one of the above repos should match
        if conditions.is_empty() {
            None
        } else {
            Some(Filter {
                should: conditions,
                ..Default::default()
            })
        }
    };

    let lang_filter = {
        let conditions = query
            .langs()
            .map(|l| make_kv_keyword_filter("lang", l.as_ref()).into())
            .collect::<Vec<_>>();
        // one of the above langs should match
        if conditions.is_empty() {
            None
        } else {
            Some(Filter {
                should: conditions,
                ..Default::default()
            })
        }
    };

    let branch_filter = {
        let conditions = query
            .branch()
            .map(|l| make_kv_keyword_filter("branches", l.as_ref()).into())
            .collect::<Vec<_>>();

        if conditions.is_empty() {
            None
        } else {
            Some(Filter {
                should: conditions,
                ..Default::default()
            })
        }
    };

    let filters: Vec<_> = [repo_filter, path_filter, lang_filter, branch_filter]
        .into_iter()
        .flatten()
        .map(Into::into)
        .collect();

    filters
}

fn dot(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b.iter()).map(|(ai, bi)| ai * bi).sum()
}

fn norm(a: &[f32]) -> f32 {
    dot(a, a)
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    dot(a, b) / (norm(a) * norm(b))
}

// Calculate the element-wise mean of the embeddings
fn mean_pool(embeddings: Vec<Vec<f32>>) -> Vec<f32> {
    let len = embeddings.len() as f32;
    let mut result = vec![0.0; EMBEDDING_DIM];
    for embedding in embeddings {
        for (i, v) in embedding.iter().enumerate() {
            result[i] += v;
        }
    }
    result.iter_mut().for_each(|v| *v /= len);
    result
}

// returns a list of indices to preserve from `snippets`
//
// query_embedding: the embedding of the query terms
// embeddings: the list of embeddings to select from
// lambda: MMR is a weighted selection of two opposing factors:
//    - relevance to the query
//    - "novelty" or, the measure of how minimal the similarity is
//      to existing documents in the selection
//      The value of lambda skews the weightage in favor of either relevance or novelty.
//    - we add a language diversity factor to the score to encourage a range of languages in the results
//    - we also add a path diversity factor to the score to encourage a range of paths in the results
//  k: the number of embeddings to select
pub fn deduplicate_with_mmr(
    query_embedding: &[f32],
    embeddings: &[&[f32]],
    languages: &[&str],
    paths: &[&str],
    lambda: f32,
    k: usize,
) -> Vec<usize> {
    let mut idxs = vec![];
    let mut lang_counts = HashMap::new();
    let mut path_counts = HashMap::new();

    if embeddings.len() < k {
        return (0..embeddings.len()).collect();
    }

    while idxs.len() < k {
        let mut best_score = f32::NEG_INFINITY;
        let mut idx_to_add = None;

        for (i, emb) in embeddings.iter().enumerate() {
            if idxs.contains(&i) {
                continue;
            }
            let first_part = cosine_similarity(query_embedding, emb);
            let mut second_part = 0.;
            for j in idxs.iter() {
                let cos_sim = cosine_similarity(emb, embeddings[*j]);
                if cos_sim > second_part {
                    second_part = cos_sim;
                }
            }
            let mut equation_score = lambda * first_part - (1. - lambda) * second_part;

            // MMR + (1/2)^n where n is the number of times a language has been selected
            let lang_count = lang_counts.get(languages[i]).unwrap_or(&1);
            equation_score += 0.5_f32.powi(*lang_count);

            // MMR + (3/4)^n where n is the number of times a path has been selected
            let path_count = path_counts.get(paths[i]).unwrap_or(&1);
            equation_score += 0.75_f32.powi(*path_count);

            if equation_score > best_score {
                best_score = equation_score;
                idx_to_add = Some(i);
            }
        }
        if let Some(i) = idx_to_add {
            idxs.push(i);
            *lang_counts.entry(languages[i]).or_insert(0) += 1;
            *path_counts.entry(paths[i]).or_insert(0) += 1;
        }
    }
    idxs
}

fn filter_overlapping_snippets(mut snippets: Vec<Payload>) -> Vec<Payload> {
    snippets.sort_by(|a, b| {
        a.relative_path
            .cmp(&b.relative_path)
            .then(a.start_line.cmp(&b.start_line))
    });

    snippets = snippets
        .into_iter()
        .fold(Vec::<Payload>::new(), |mut deduped_snippets, snippet| {
            if let Some(prev) = deduped_snippets.last_mut() {
                if prev.relative_path == snippet.relative_path
                    && prev.end_line >= snippet.start_line
                {
                    debug!(
                        "Filtering overlapping snippets. End: {:?} - Start: {:?} from {:?}",
                        prev.end_line, snippet.start_line, prev.relative_path
                    );
                    return deduped_snippets;
                }
            }
            deduped_snippets.push(snippet);
            deduped_snippets
        });

    snippets.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
    snippets
}

pub fn deduplicate_snippets(
    mut all_snippets: Vec<Payload>,
    query_embedding: Embedding,
    output_count: u64,
) -> Vec<Payload> {
    all_snippets = filter_overlapping_snippets(all_snippets);

    let idxs = {
        let lambda = 0.5;
        let k = output_count; // number of snippets
        let embeddings = all_snippets
            .iter()
            .map(|s| s.embedding.as_deref().unwrap())
            .collect::<Vec<_>>();
        let languages = all_snippets
            .iter()
            .map(|s| s.lang.as_ref())
            .collect::<Vec<_>>();
        let paths = all_snippets
            .iter()
            .map(|s| s.relative_path.as_ref())
            .collect::<Vec<_>>();
        deduplicate_with_mmr(
            &query_embedding,
            &embeddings,
            &languages,
            &paths,
            lambda,
            k as usize,
        )
    };

    info!("preserved idxs after MMR are {:?}", idxs);

    all_snippets
        .drain(..)
        .enumerate()
        .filter_map(|(ref i, payload)| {
            if idxs.contains(i) {
                Some(payload)
            } else {
                None
            }
        })
        .collect()
}
