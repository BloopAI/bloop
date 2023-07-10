use std::sync::RwLock;

use crate::repo::{RepoRef, SyncStatus};

use super::{Progress, ProgressEvent, SyncHandle};

enum ControlEvent {
    /// Cancel whatever's happening, and return
    Cancel,

    /// Cancel and immediately remove the repo
    Remove,
}

pub struct SyncPipes {
    reporef: RepoRef,
    progress: super::ProgressStream,
    event: RwLock<Option<ControlEvent>>,
}

impl SyncPipes {
    pub(super) fn new(reporef: RepoRef, progress: super::ProgressStream) -> Self {
        Self {
            reporef,
            progress,
            event: Default::default(),
        }
    }

    pub(crate) fn index_percent(&self, current: u8) {
        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            event: ProgressEvent::IndexPercent(current),
        });
    }

    pub(crate) fn status(&self, handle: &SyncHandle, new: SyncStatus) {
        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            event: ProgressEvent::StatusChange {
                branch_filter: handle.new_branch_filters.clone(),
                status: new,
            },
        });
    }

    pub(crate) fn is_cancelled(&self) -> bool {
        use ControlEvent::*;
        matches!(self.event.read().unwrap().as_ref(), Some(Cancel | Remove))
    }

    pub(crate) fn is_removed(&self) -> bool {
        use ControlEvent::*;
        matches!(self.event.read().unwrap().as_ref(), Some(Remove))
    }

    pub(crate) fn cancel(&self) {
        *self.event.write().unwrap() = Some(ControlEvent::Cancel);
    }

    pub(crate) fn remove(&self) {
        *self.event.write().unwrap() = Some(ControlEvent::Remove);
    }
}
