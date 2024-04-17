use std::collections::HashSet;

use chrono::{Duration, Utc};
use rand::{distributions, thread_rng, Rng};
use rayon::prelude::{IntoParallelRefIterator, ParallelIterator};
use tracing::{error, info};

use crate::{query::parser, repo::BranchFilterConfig, state::RepositoryPool};

pub(crate) async fn log_and_branch_rotate(app: crate::Application) {
    let log = crate::db::QueryLog::new(&app.sql);
    loop {
        let jitter = thread_rng().sample(distributions::Uniform::new(100, 300));
        tokio::time::sleep(
            tokio::time::Duration::from_secs(3600) + tokio::time::Duration::from_secs(jitter),
        )
        .await;

        let cutoff = Utc::now() - Duration::days(1);
        let queries = log.since(cutoff).await.unwrap();

        let used_branches = collect_branches_for_repos(queries);
        let to_sync = update_branch_filters(used_branches, &app.repo_pool);

        app.write_index().enqueue_all(to_sync).await;

        if let Err(err) = log.prune(cutoff).await {
            error!(?err, "failed to prune old log entries");
        };
    }
}

/// Remove log files older than 7 days.
///
/// Runs on startup and every hour thereafter
pub(crate) async fn clear_disk_logs(app: crate::Application) {
    let log_dir = app.config.log_dir();
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600));
    loop {
        interval.tick().await;
        info!("removing old logs");

        let today = Utc::now().date_naive();
        let allowed_files = (0..7)
            .map(|offset| today - Duration::days(offset))
            .map(|d| format!("bloop.log.{}", d.format("%Y-%m-%d")))
            .collect::<HashSet<_>>();

        if let Ok(mut r) = tokio::fs::read_dir(&log_dir).await {
            while let Ok(Some(entry)) = r.next_entry().await {
                if !entry
                    .file_name()
                    .to_str()
                    .map(|f| allowed_files.contains(f))
                    .unwrap_or_default()
                {
                    if tokio::fs::remove_file(entry.path()).await.is_ok() {
                        info!("removed old log file {:?}", entry.file_name())
                    } else {
                        info!(
                            "failed to remove log file {:?} ... skipping",
                            entry.file_name()
                        )
                    };
                }
            }
        }
    }
}

fn update_branch_filters(
    map: scc::HashMap<String, HashSet<String>>,
    repo_pool: &RepositoryPool,
) -> Vec<crate::repo::RepoRef> {
    let mut to_sync = vec![];
    map.for_each(|repo, branches| {
        let Ok(reporef) = repo.parse() else {
            return;
        };

        repo_pool.update(&reporef, |_, v| {
            let effective = std::mem::take(branches).into_iter().collect();
            let new_filter = Some(BranchFilterConfig::Select(effective));
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
        if let Ok(parsed) = parser::parse_nl(q) {
            for r in parsed.repos() {
                for b in parsed.branch() {
                    map.entry(r.to_string())
                        .or_insert_with(HashSet::default)
                        .get_mut()
                        .insert(b.to_string());
                }
            }
        }
    });
    map
}
