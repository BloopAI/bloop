use std::{
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, RwLock,
    },
    time::{Duration, Instant},
};

use tracing::debug;

use crate::repo::{FilterUpdate, RepoRef, SyncStatus};

use super::{Progress, ProgressEvent};

const GIT_REPORT_DELAY: Duration = Duration::from_secs(3);

enum ControlEvent {
    /// Cancel whatever's happening, and return
    Cancel,

    /// Cancel and immediately remove the repo
    Remove,
}

pub struct SyncPipes {
    /// Together with `filter_updates`, it uniquely identifies the sync process
    reporef: RepoRef,

    /// Together with `reporef`, it uniquely identifies the sync process
    filter_updates: FilterUpdate,

    /// Channel to stream updates to the frontend
    progress: super::ProgressStream,

    /// Control event received from frontend
    event: RwLock<Option<ControlEvent>>,

    /// Interrupt signal channel for `gix`
    git_interrupt: Arc<AtomicBool>,
}

impl SyncPipes {
    pub(super) fn new(
        reporef: RepoRef,
        filter_updates: FilterUpdate,
        progress: super::ProgressStream,
    ) -> Self {
        Self {
            reporef,
            progress,
            filter_updates,
            git_interrupt: Default::default(),
            event: Default::default(),
        }
    }

    pub(crate) fn git_sync_progress(&self) -> GitSync {
        // clear any state stored on the frontend
        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            branch_filter: self.filter_updates.branch_filter.clone(),
            event: ProgressEvent::IndexPercent(None),
        });

        GitSync {
            created: Instant::now(),
            max: Arc::new(usize::MAX.into()),
            cnt: Arc::new(0.into()),
            id: Default::default(),
            name: Default::default(),
            progress: self.progress.clone(),
            reporef: self.reporef.clone(),
            filter_updates: self.filter_updates.clone(),
        }
    }

    pub(crate) fn index_percent(&self, current: u8) {
        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            branch_filter: self.filter_updates.branch_filter.clone(),
            event: ProgressEvent::IndexPercent(Some(current)),
        });
    }

    pub(crate) fn status(&self, new: SyncStatus) {
        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            branch_filter: self.filter_updates.branch_filter.clone(),
            event: ProgressEvent::StatusChange(new),
        });
    }

    pub(crate) fn is_interrupted(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.git_interrupt)
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
        self.git_interrupt.store(true, Ordering::Relaxed);
    }

    pub(crate) fn remove(&self) {
        *self.event.write().unwrap() = Some(ControlEvent::Remove);
        self.git_interrupt.store(true, Ordering::Relaxed);
    }
}

#[derive(Clone)]
pub(crate) struct GitSync {
    /// Record creation time so we can delay sending events
    created: Instant,

    /// Maximum value
    max: Arc<AtomicUsize>,

    /// Current value
    cnt: Arc<AtomicUsize>,

    /// This is where we report status
    progress: super::ProgressStream,

    /// Copy from `SyncPipes`, because we can't make this a referential type
    reporef: RepoRef,

    /// Copy from `SyncPipes`, because we can't make this a referential type
    filter_updates: FilterUpdate,

    /// Used by `gix`
    id: gix::progress::Id,

    /// Used by `gix`
    name: String,
}

impl gix::progress::Progress for GitSync {
    fn init(
        &mut self,
        max: Option<gix::progress::prodash::progress::Step>,
        _unit: Option<gix::progress::Unit>,
    ) {
        let Some(max) = max else {
            return;
        };

        self.max.store(max, Ordering::SeqCst);
        self.cnt.store(0, Ordering::SeqCst);
    }

    fn set_name(&mut self, name: String) {
        self.name = name;
    }

    fn name(&self) -> Option<String> {
        Some(self.name.clone())
    }

    fn id(&self) -> gix::progress::Id {
        self.id
    }

    fn message(&self, level: gix::progress::MessageLevel, message: String) {
        debug!(name = self.name, message, ?level, "git status message");
    }
}

impl gix::progress::Count for GitSync {
    fn set(&self, step: gix::progress::prodash::progress::Step) {
        self.cnt.store(step, Ordering::SeqCst);

        if self.created.elapsed() > GIT_REPORT_DELAY {
            let current = ((step as f32 / self.max.load(Ordering::SeqCst) as f32) * 100f32) as u8;
            _ = self.progress.send(Progress {
                reporef: self.reporef.clone(),
                branch_filter: self.filter_updates.branch_filter.clone(),
                event: ProgressEvent::IndexPercent(Some(current.min(100))),
            });
        }
    }

    fn step(&self) -> gix::progress::prodash::progress::Step {
        1
    }

    fn inc_by(&self, step: gix::progress::prodash::progress::Step) {
        self.cnt.fetch_add(step, Ordering::SeqCst);

        if self.created.elapsed() > GIT_REPORT_DELAY {
            let max = self.max.load(Ordering::SeqCst);
            let current = self.cnt.load(Ordering::SeqCst);

            let current = if max > 10000 {
                ((current as f32 / (max * 4 * 1024) as f32) * 100f32) as u8
            } else {
                0
            };

            _ = self.progress.send(Progress {
                reporef: self.reporef.clone(),
                branch_filter: self.filter_updates.branch_filter.clone(),
                event: ProgressEvent::IndexPercent(Some(current.min(100))),
            });
        }
    }

    fn counter(&self) -> gix::progress::StepShared {
        self.cnt.clone()
    }
}

/// These implementations just create clones of the original one, we
/// don't treat children as separate tasks apart from id/naming to
/// preserve some illusion of being good citizens.
impl gix::progress::NestedProgress for GitSync {
    type SubProgress = Self;

    fn add_child(&mut self, name: impl Into<String>) -> Self::SubProgress {
        let name = name.into();
        let progress = if name == "read pack" {
            self.progress.clone()
        } else {
            let (sender, _) = tokio::sync::broadcast::channel(1000);
            sender
        };

        GitSync {
            created: self.created,
            max: self.max.clone(),
            cnt: self.cnt.clone(),
            id: self.id,
            filter_updates: self.filter_updates.clone(),
            reporef: self.reporef.clone(),
            progress,
            name,
        }
    }

    fn add_child_with_id(
        &mut self,
        name: impl Into<String>,
        id: gix::progress::Id,
    ) -> Self::SubProgress {
        let name = name.into();
        let progress = if name == "read pack" {
            self.progress.clone()
        } else {
            let (sender, _) = tokio::sync::broadcast::channel(1000);
            sender
        };

        GitSync {
            created: self.created,
            max: self.max.clone(),
            cnt: self.cnt.clone(),
            filter_updates: self.filter_updates.clone(),
            reporef: self.reporef.clone(),
            progress,
            name,
            id,
        }
    }
}
