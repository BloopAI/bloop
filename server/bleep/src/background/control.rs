use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc, RwLock,
};

use crate::repo::{FilterUpdate, RepoRef, SyncStatus};

use super::{Progress, ProgressEvent};

enum ControlEvent {
    /// Cancel whatever's happening, and return
    Cancel,

    /// Cancel and immediately remove the repo
    Remove,
}

pub struct SyncPipes {
    reporef: RepoRef,
    filter_updates: FilterUpdate,
    progress: super::ProgressStream,
    event: RwLock<Option<ControlEvent>>,
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
            event: Default::default(),
        }
    }

    pub(crate) fn git_sync_progress(&self) -> GitSync {
        GitSync {
            max: 0.into(),
            cnt: 0.into(),
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
            event: ProgressEvent::IndexPercent(current),
        });
    }

    pub(crate) fn status(&self, new: SyncStatus) {
        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            branch_filter: self.filter_updates.branch_filter.clone(),
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

pub(crate) struct GitSync {
    max: AtomicUsize,
    cnt: AtomicUsize,
    progress: super::ProgressStream,
    reporef: RepoRef,
    filter_updates: FilterUpdate,
    id: gix::progress::Id,
    name: String,
}

impl Clone for GitSync {
    fn clone(&self) -> Self {
        GitSync {
            max: 0.into(),
            cnt: 0.into(),
            progress: self.progress.clone(),
            id: self.id.clone(),
            filter_updates: self.filter_updates.clone(),
            reporef: self.reporef.clone(),
            name: Default::default(),
        }
    }
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
        self.id.clone()
    }

    fn message(&self, level: gix::progress::MessageLevel, message: String) {
        println!("-- {level:?} : {name} {message}", name = self.name);
    }
}

impl gix::progress::Count for GitSync {
    fn set(&self, step: gix::progress::prodash::progress::Step) {
        self.cnt.store(step, Ordering::SeqCst);

        let current = ((step as f32 / self.max.load(Ordering::SeqCst) as f32) * 100f32) as u8;
        // println!("-- {step:?} {name}", name = self.name);
        // println!("set: {name} {}", current, name = self.name,);

        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            branch_filter: self.filter_updates.branch_filter.clone(),
            event: ProgressEvent::IndexPercent(current.min(100)),
        });
    }

    fn step(&self) -> gix::progress::prodash::progress::Step {
        1
    }

    fn inc_by(&self, step: gix::progress::prodash::progress::Step) {
        self.cnt.fetch_add(step, Ordering::SeqCst);
        let max = self.max.load(Ordering::SeqCst);
        let current = self.cnt.load(Ordering::SeqCst);
        println!("inc: {name} {current}/{max}", name = self.name,);
        let current = if max > 10000 {
            ((current as f32 / (max * 3 * 1024) as f32) * 100f32) as u8
        } else {
            ((current as f32 / (max) as f32) * 100f32) as u8
        };

        _ = self.progress.send(Progress {
            reporef: self.reporef.clone(),
            branch_filter: self.filter_updates.branch_filter.clone(),
            event: ProgressEvent::IndexPercent((current.min(100)) as u8),
        });
    }

    fn counter(&self) -> gix::progress::StepShared {
        Arc::new(self.cnt.load(Ordering::Relaxed).into())
    }
}

impl gix::progress::NestedProgress for GitSync {
    type SubProgress = Self;

    fn add_child(&mut self, name: impl Into<String>) -> Self::SubProgress {
        GitSync {
            max: 0.into(),
            cnt: 0.into(),
            progress: self.progress.clone(),
            id: self.id.clone(),
            filter_updates: self.filter_updates.clone(),
            reporef: self.reporef.clone(),
            name: name.into(),
        }
    }

    fn add_child_with_id(
        &mut self,
        name: impl Into<String>,
        id: gix::progress::Id,
    ) -> Self::SubProgress {
        GitSync {
            max: 0.into(),
            cnt: 0.into(),
            progress: self.progress.clone(),
            filter_updates: self.filter_updates.clone(),
            reporef: self.reporef.clone(),
            name: name.into(),
            id,
        }
    }
}
