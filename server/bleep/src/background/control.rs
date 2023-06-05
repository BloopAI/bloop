use std::sync::atomic::{AtomicBool, Ordering};

use crate::repo::{RepoRef, SyncStatus};

use super::{Progress, ProgressEvent};

enum ControlEvent {
    /// Cancel whatever's happening, and return
    Cancel,
}

pub struct SyncPipes {
    reporef: RepoRef,
    progress: super::ProgressStream,
    control_rx: flume::Receiver<ControlEvent>,
    control_tx: flume::Sender<ControlEvent>,
    cancelled: AtomicBool,
}

impl SyncPipes {
    pub(super) fn new(reporef: RepoRef, progress: super::ProgressStream) -> Self {
        let (control_tx, control_rx) = flume::bounded(1);
        Self {
            reporef,
            control_rx,
            control_tx,
            progress,
            cancelled: false.into(),
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

    pub(crate) fn is_cancelled(&self) -> bool {
        if let Ok(ControlEvent::Cancel) = self.control_rx.try_recv() {
            self.cancelled.store(true, Ordering::SeqCst);
            return true;
        }

        self.cancelled.load(Ordering::SeqCst)
    }

    pub(crate) fn cancel(&self) {
        _ = self.control_tx.send(ControlEvent::Cancel);
    }
}
