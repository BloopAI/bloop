use std::{
    fs::{create_dir_all, write},
    path::Path,
    process::{Child, Command},
    thread,
    time::Duration,
};

use sysinfo::{ProcessExt, ProcessRefreshKind, RefreshKind, Signal, System, SystemExt};
use tauri::{plugin::Plugin, Runtime};
use tracing::warn;

use super::relative_command_path;

#[derive(Default)]
pub(super) struct QdrantSupervisor {
    child: Option<Child>,
}

impl<R> Plugin<R> for QdrantSupervisor
where
    R: Runtime,
{
    fn name(&self) -> &'static str {
        "qdrant"
    }

    fn initialize(
        &mut self,
        app: &tauri::AppHandle<R>,
        _config: serde_json::Value,
    ) -> tauri::plugin::Result<()> {
        close_existing_qdrant_processes();

        let data_dir = app.path_resolver().app_data_dir().unwrap();
        let qdrant_dir = data_dir.join("qdrant");
        let qd_config_dir = qdrant_dir.join("config");
        create_dir_all(&qd_config_dir).unwrap();
        write(
            qd_config_dir.join("config.yaml"),
            format!(
                include_str!("./QDRANT_CONFIG_TEMPLATE.yml"),
                storage = &qdrant_dir.join("storage").to_string_lossy(),
                snapshots = &qdrant_dir.join("snapshots").to_string_lossy()
            ),
        )
        .unwrap();

        let command = relative_command_path("qdrant").expect("bad bundle");
        self.child = Some(run_command(&command, &qdrant_dir));

        Ok(())
    }

    fn on_event(&mut self, _app: &tauri::AppHandle<R>, event: &tauri::RunEvent) {
        use tauri::RunEvent::{Exit, ExitRequested};
        if matches!(event, Exit | ExitRequested { .. }) {
            let Some(mut child) = self.child.take() else {
                warn!("qdrant has been killed");
                return;
            };

            if let Err(err) = child.kill() {
                warn!(?err, "failed to kill qdrant");
            };
        }
    }
}

#[cfg(unix)]
fn run_command(command: &Path, qdrant_dir: &Path) -> Child {
    use nix::sys::resource::{getrlimit, setrlimit, Resource};
    use tracing::{error, info};
    match getrlimit(Resource::RLIMIT_NOFILE) {
        Ok((current_soft, current_hard)) if current_hard < 2048 => {
            if let Err(err) = setrlimit(Resource::RLIMIT_NOFILE, 1024, 2048) {
                error!(
                    ?err,
                    new_soft = 1024,
                    new_hard = 2048,
                    current_soft,
                    current_hard,
                    "failed to set rlimit/nofile"
                );
            }
        }
        Ok((current_soft, current_hard)) => {
            info!(current_soft, current_hard, "no change to rlimit needed");
        }
        Err(err) => {
            error!(?err, "failed to get rlimit/nofile");
        }
    }

    // nix::sys::resource::setrlimit().unwrap();
    Command::new(command)
        .current_dir(qdrant_dir)
        .spawn()
        .expect("failed to start qdrant")
}

#[cfg(windows)]
fn run_command(command: &Path, qdrant_dir: &Path) -> Child {
    use std::os::windows::process::CommandExt;

    Command::new(command)
        .current_dir(qdrant_dir)
        // Add a CREATE_NO_WINDOW flag to prevent qdrant console popup
        .creation_flags(0x08000000)
        .spawn()
        .expect("failed to start qdrant")
}

fn close_existing_qdrant_processes() {
    // Limit total open files from `sysinfo` crate on Linux.
    sysinfo::set_open_files_limit(10);

    let mut sys =
        System::new_with_specifics(RefreshKind::new().with_processes(ProcessRefreshKind::new()));

    for process in sys.processes_by_exact_name("qdrant") {
        if process.kill_with(Signal::Term).is_none() && !process.kill() {
            tracing::error!("was not able to close existing qdrant process");
        }
    }

    // We now wait for these processes to close.

    let mut qdrant_procs = vec![];
    for _ in 0..10 {
        thread::sleep(Duration::from_millis(500));
        sys.refresh_processes();
        qdrant_procs = sys.processes_by_exact_name("qdrant").collect();
        if qdrant_procs.is_empty() {
            break;
        }
    }

    // As a last-ditch resort, kill any remaining processes.
    for proc in qdrant_procs {
        proc.kill();
    }
}
