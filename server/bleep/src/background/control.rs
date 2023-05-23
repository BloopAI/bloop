use crate::repo::{RepoRef, SyncStatus};

use super::{Progress, ProgressEvent};

#[allow(unused)]
pub enum ControlEvent {
    /// Cancel whatever's happening, and return
    Cancel,
}

pub struct SyncPipes {
    reporef: RepoRef,
    progress: super::ProgressStream,
    control_rx: flume::Receiver<ControlEvent>,
    control_tx: flume::Sender<ControlEvent>,
}

impl SyncPipes {
    pub(super) fn new(reporef: RepoRef, progress: super::ProgressStream) -> Self {
        let (control_tx, control_rx) = flume::bounded(1);
        Self {
            reporef,
            control_rx,
            control_tx,
            progress,
        }
    }

    pub(crate) fn index_percent(&self, current: u8) {
        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            event: ProgressEvent::IndexPercent(current),
        });
    }

    pub(crate) fn status(&self, new: SyncStatus) {
        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            event: ProgressEvent::StatusChange(new),
        });
    }
}
