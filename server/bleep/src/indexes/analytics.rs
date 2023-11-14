use crate::{analytics::RepoEvent, repo::RepoRef};
use tokio::{sync::mpsc, time::Instant};

#[derive(Default)]
pub struct WorkerStats {
    // size in bytes
    pub size: usize,
    // number of qdrant chunkc
    pub chunks: usize,
    // number of dir-entries reindexed by this worker
    pub reindex_count: usize,
}

impl std::ops::AddAssign for WorkerStats {
    fn add_assign(&mut self, rhs: Self) {
        self.size += rhs.size;
        self.chunks += rhs.chunks;
        self.reindex_count += rhs.reindex_count;
    }
}

#[derive(serde::Serialize, Clone, Copy, PartialEq, Eq)]
enum IndexJobKind {
    Index,
    PeriodicSync { reindex_file_count: usize },
    SchemaUpgrade { reindex_file_count: usize },
}

// the main entrypoint into gathering analytics for an index job
pub struct StatsGatherer {
    // reciever of stats from worker threads
    stats_rx: mpsc::UnboundedReceiver<WorkerStats>,
    // pass this along to each worker thread
    stats_tx: mpsc::UnboundedSender<WorkerStats>,
    // the reporef of the target index job
    reporef: RepoRef,
    // the moment this job began
    start_time: Instant,
    // set to true if this is the first index of this reporef
    pub is_first_index: bool,
    // set to true if the index was reset on startup
    pub was_index_reset: bool,
    // gather analytics events into this `event` field
    pub event: RepoEvent,
    // combine stats from each worker thread into `repo_stats`
    pub repo_stats: WorkerStats,
}

impl StatsGatherer {
    pub fn for_repo(reporef: RepoRef) -> Self {
        let (stats_tx, stats_rx) = mpsc::unbounded_channel();
        Self {
            stats_rx,
            stats_tx,
            event: RepoEvent::new("index"),
            reporef,
            is_first_index: false,
            was_index_reset: false,
            start_time: Instant::now(),
            repo_stats: WorkerStats::default(),
        }
    }

    pub fn sender(&self) -> mpsc::UnboundedSender<WorkerStats> {
        self.stats_tx.clone()
    }

    #[rustfmt::skip]
    pub async fn finish(mut self) -> RepoEvent {
        // aggregate stats
        self.stats_rx.close();
        while let Some(stats) = self.stats_rx.recv().await {
            self.repo_stats += stats;
        }

        // determine the type of index job run
        //
        let job_kind = if self.was_index_reset {
            IndexJobKind::SchemaUpgrade {
                reindex_file_count: self.repo_stats.reindex_count,
            }
        } else if self.is_first_index {
            IndexJobKind::Index
        } else {
            IndexJobKind::PeriodicSync {
                reindex_file_count: self.repo_stats.reindex_count,
            }
        };

        self.event.add_payload("reporef", &self.reporef.name());
        self.event.add_payload("provider", &self.reporef.backend());
        self.event.add_payload("index_job_kind", &job_kind);
        self.event.add_payload("chunk_count", &self.repo_stats.chunks);
        self.event.add_payload("bytes", &human_readable(self.repo_stats.size));
        self.event.add_payload("sync_time", &format!("{:?}", self.start_time.elapsed()));
        self.event
    }
}

fn human_readable(size: usize) -> String {
    let suffixes = ["B", "KB", "MB", "GB"];
    let s = suffixes
        .iter()
        .zip(0..10)
        .rev()
        .map(|(suf, exp)| (suf, size as f64 / (1024_f64.powi(exp))))
        .find(|(_, t)| t >= &1.0);
    s.map(|(suffix, value)| format!("{value:.2}{suffix}"))
        .unwrap_or_else(|| size.to_string())
}

#[cfg(test)]
mod test {
    #[test]
    fn human_readable() {
        assert_eq!(super::human_readable(15), "15.00B");
        assert_eq!(super::human_readable(1024), "1.00KB");
        assert_eq!(super::human_readable(7616597515), "7.09GB");
    }
}
