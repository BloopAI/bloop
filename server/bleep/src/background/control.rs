use crate::repo::RepoRef;

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

    pub(crate) fn progress(&self, current: u8) {
        _ = self.progress.send((self.reporef.clone(), 1, current));
    }
}
