use tracing::info;

use crate::{
    background::{BoundSyncQueue, SyncConfig},
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
        let Self(app) = self;
        let jobs = app.sync_queue.clone();

        info!(%reporef, ?patch, "queueing for sync with branches");
        jobs.queue
            .push(
                SyncConfig::new(app, reporef)
                    .filter_updates(patch.into())
                    .into_handle()
                    .await,
            )
            .await;
    }
}
