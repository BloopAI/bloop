// This test just stubs out the tauri interface so that we can
// ensure that the desktop app will build with this server.

use std::{
    marker::PhantomData,
    path::{Path, PathBuf},
};

// Rust-analyzer isn't happy about this, but the test seems to
// work, so who can say if it's good or not?
#[path = "../../../apps/desktop/src-tauri/src/backend.rs"]
pub mod backend;

#[test]
#[should_panic]
fn run_server() {
    let mut app: App<()> = App(PhantomData);
    backend::bleep(&mut app).unwrap();
}

#[derive(Copy, Clone)]
struct App<R>(PhantomData<R>);

pub struct AppHandle;

pub trait Manager {
    fn handle(&self) -> AppHandle;
}

impl<R> Manager for App<R> {
    fn handle(&self) -> AppHandle {
        AppHandle
    }
}

struct Payload {
    message: String,
}

pub trait Runtime {}
impl Runtime for () {}

impl<R> App<R> {
    fn path_resolver(&mut self) -> &mut Self {
        self
    }

    fn resolve_resource(&mut self, _p: impl AsRef<Path>) -> Option<PathBuf> {
        None
    }

    fn app_cache_dir(&self) -> Option<PathBuf> {
        None
    }
}

impl AppHandle {
    fn emit_all(&self, _event: &str, payload: Payload) -> plugin::Result<()> {
        println!("{}", payload.message);
        Ok(())
    }
}

pub mod plugin {
    pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
}
