use tracing::info;

use crate::{
    background::{BoundSyncQueue, SyncHandle},
    repo::{BranchFilter, RepoRef},
};

impl BoundSyncQueue {
    /// Index new branches specified in the `BranchFilter`.
    ///
    /// Unlike `sync_and_index`, this allows queueing multiple syncs
    /// for the same repo multiple times to allow incrementally
    /// syncing individual branches without restrictions.
    pub(crate) async fn add_branches_for_repo(self, reporef: RepoRef, new_branches: BranchFilter) {
        info!(%reporef, ?new_branches, "queueing for sync with branches");
        let handle = SyncHandle::new(
            self.0.clone(),
            reporef,
            self.1.progress.clone(),
            Some(new_branches),
        )
        .await;
        self.1.queue.push(handle).await;
    }
}
