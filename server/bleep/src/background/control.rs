pub enum ControlEvent {
    Cancel,
}

pub struct SyncPipes {
    control_rx: flume::Receiver<ControlEvent>,
    control_tx: flume::Sender<ControlEvent>,
}

impl SyncPipes {
    fn new() -> Self {
        let (control_tx, control_rx) = flume::bounded(1);
        Self {
            control_rx,
            control_tx,
        }
    }
}

impl Default for SyncPipes {
    fn default() -> Self {
        Self::new()
    }
}
