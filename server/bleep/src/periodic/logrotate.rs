use std::{borrow::Cow, collections::HashSet};

use chrono::{Duration, Utc};
use rand::{distributions, thread_rng, Rng};
use rayon::prelude::{IntoParallelRefIterator, ParallelIterator};
use tracing::error;

use crate::{
    query::parser::{self, ParsedQuery},
    repo::BranchFilter,
    state::RepositoryPool,
};

pub(crate) async fn log_and_branch_rotate(app: crate::Application) {
    let log = crate::db::QueryLog::new(&app.sql);
    loop {
        let cutoff = Utc::now() - Duration::days(1);
        let queries = log.since(cutoff).await.unwrap();

        let used_branches = collect_branches_for_repos(queries);
        let to_sync = update_branch_filters(used_branches, &app.repo_pool);

        app.write_index().sync_and_index(to_sync).await;

        if let Err(err) = log.prune(cutoff).await {
            error!(?err, "failed to prune old log entries");
        };

        let jitter = thread_rng().sample(distributions::Uniform::new(100, 300));
        tokio::time::sleep(
            tokio::time::Duration::from_secs(3600) + tokio::time::Duration::from_secs(jitter),
        )
        .await;
    }
}

fn update_branch_filters(
    map: scc::HashMap<String, HashSet<String>>,
    repo_pool: &RepositoryPool,
) -> Vec<crate::repo::RepoRef> {
    let mut to_sync = vec![];
    map.for_each(|repo, branches| {
        let Ok(reporef) = repo.try_into()
        else {
            return;
        };

        repo_pool.update(&reporef, |_, v| {
            let branches = {
                let mut b = std::mem::take(branches);
                b.insert("HEAD".into());
                b.into_iter().collect()
            };

            let new_filter = Some(BranchFilter::Select(branches));
            if new_filter != v.branch_filter {
                v.branch_filter = new_filter;
                to_sync.push(reporef.clone());
            }
        });
    });
    to_sync
}

fn collect_branches_for_repos(queries: Vec<String>) -> scc::HashMap<String, HashSet<String>> {
    let map = scc::HashMap::default();
    queries.par_iter().for_each(|q| {
        let parsed = parser::parse_nl(q);
        match parsed {
            Ok(ParsedQuery::Grep(list)) => {
                for q in list {
                    if let Some((r, b)) = q
                        .repo
                        .and_then(|r| r.as_plain())
                        .zip(q.branch.and_then(|b| b.as_plain()))
                    {
                        record_branch(&map, r, b);
                    }
                }
            }
            Ok(ParsedQuery::Semantic(semantic)) => {
                for r in semantic.repos() {
                    for b in semantic.branch() {
                        record_branch(&map, r.clone(), b);
                    }
                }
            }
            Err(_) => (),
        }
    });
    map
}

fn record_branch<'a>(
    map: &scc::HashMap<String, HashSet<String>>,
    r: Cow<'a, str>,
    b: Cow<'a, str>,
) {
    map.entry(r.to_string())
        .or_insert_with(HashSet::default)
        .get_mut()
        .insert(b.to_string());
}
