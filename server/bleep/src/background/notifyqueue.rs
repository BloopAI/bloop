use std::{collections::VecDeque, sync::Arc};

use tokio::sync::{RwLock, Semaphore};

use crate::repo::RepoRef;

use super::sync::SyncHandle;

/// Asynchronous queue with await semantics for popping the front
/// element.
pub(super) struct NotifyQueue {
    queue: RwLock<VecDeque<Arc<SyncHandle>>>,
    available: Semaphore,
}

impl Default for NotifyQueue {
    fn default() -> Self {
        Self {
            queue: Default::default(),
            available: Semaphore::new(0),
        }
    }
}

impl NotifyQueue {
    pub(super) async fn push(&self, item: Arc<SyncHandle>) {
        let mut q = self.queue.write().await;

        self.available.add_permits(1);

        q.push_back(item);
    }

    pub(super) async fn pop_if(&self, pred: impl Fn(&SyncHandle) -> bool) -> Arc<SyncHandle> {
        loop {
            let permit = self.available.acquire().await.expect("fatal");
            let mut q = self.queue.write().await;

            let first = q.iter().position(|h| (pred)(&h));

            if let Some(pos) = first {
                permit.forget();
                return q.remove(pos).expect("locked");
            }
        }
    }

    #[allow(unused)]
    pub(super) async fn get_list(&self) -> Vec<Arc<SyncHandle>> {
        self.queue.read().await.iter().cloned().collect()
    }

    pub(super) async fn contains(&self, reporef: &RepoRef) -> bool {
        self.queue
            .read()
            .await
            .iter()
            .any(|h| &h.reporef == reporef)
    }

    #[allow(unused)]
    pub(super) async fn remove(&self, reporef: RepoRef) {
        let mut q = self.queue.write().await;
        self.available.acquire().await.expect("fatal").forget();
        q.retain(|item| item.reporef != reporef);
    }
}
