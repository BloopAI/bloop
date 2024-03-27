use tokio::sync::mpsc;

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

// the main entrypoint into gathering analytics for an index job
pub struct StatsGatherer {
    // reciever of stats from worker threads
    stats_rx: mpsc::UnboundedReceiver<WorkerStats>,
    // pass this along to each worker thread
    stats_tx: mpsc::UnboundedSender<WorkerStats>,
    // set to true if this is the first index of this reporef
    pub is_first_index: bool,
    // set to true if the index was reset on startup
    pub was_index_reset: bool,
    // combine stats from each worker thread into `repo_stats`
    pub repo_stats: WorkerStats,
}

impl StatsGatherer {
    pub fn for_repo() -> Self {
        let (stats_tx, stats_rx) = mpsc::unbounded_channel();
        Self {
            stats_rx,
            stats_tx,
            is_first_index: false,
            was_index_reset: false,
            repo_stats: WorkerStats::default(),
        }
    }

    pub fn sender(&self) -> mpsc::UnboundedSender<WorkerStats> {
        self.stats_tx.clone()
    }

    pub async fn finish(&mut self) {
        // aggregate stats
        self.stats_rx.close();
        while let Some(stats) = self.stats_rx.recv().await {
            self.repo_stats += stats;
        }
    }
}
