use std::sync::RwLock;

use crate::repo::{RepoRef, SyncStatus};

use super::{Progress, ProgressEvent};

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
    new_branch_filters: Option<crate::repo::BranchFilter>,
}

impl SyncPipes {
    pub(super) fn new(
        reporef: RepoRef,
        new_branch_filters: Option<crate::repo::BranchFilter>,
        progress: super::ProgressStream,
    ) -> Self {
        Self {
            reporef,
            progress,
            new_branch_filters,
            event: Default::default(),
        }
    }

    pub(crate) fn index_percent(&self, current: u8) {
        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            branch_filter: self.new_branch_filters.clone(),
            event: ProgressEvent::IndexPercent(current),
        });
    }

    pub(crate) fn status(&self, new: SyncStatus) {
        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            branch_filter: self.new_branch_filters.clone(),
            event: ProgressEvent::StatusChange(new),
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
