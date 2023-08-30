use tracing::info;

use crate::{
    background::{BoundSyncQueue, SyncHandle},
    repo::RepoRef,
};

use crate::repo::FilterUpdate;

impl BoundSyncQueue {
    /// Index new branches specified in the `BranchFilter`.
    ///
    /// Unlike `sync_and_index`, this allows queueing multiple syncs
    /// for the same repo multiple times to allow incrementally
    /// syncing individual branches without restrictions.
    pub(crate) async fn add_branches_for_repo(self, reporef: RepoRef, patch: FilterUpdate) {
        info!(%reporef, ?patch, "queueing for sync with branches");
        let handle = SyncHandle::new(
            self.0.clone(),
            reporef,
            self.1.progress.clone(),
            Some(patch),
        )
        .await;
        self.1.queue.push(handle).await;
    }
}
