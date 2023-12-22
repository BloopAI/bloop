use std::{
    fs::{create_dir_all, write, File},
    path::{Path, PathBuf},
    process::{Child, Command},
};

use sentry::Level;
use tauri::{plugin::Plugin, Runtime};
use tracing::{error, info, warn};

use super::relative_command_path;

#[derive(Default)]
pub(super) struct QdrantSupervisor {
    child: Option<Child>,
    stdout_file: Option<PathBuf>,
    stderr_file: Option<PathBuf>,
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
        // initialize the system configuration, including sentry &
        // other possible dependencies
        let _initialize_config = crate::config::init(app);

        let data_dir = app.path_resolver().app_data_dir().unwrap();
        let qdrant_dir = data_dir.join("qdrant");
        let qd_config_dir = qdrant_dir.join("config");

        let qd_logs_dir = qdrant_dir.join("logs");
        let stdout_file = qd_logs_dir.join("latest.stdout");
        let stderr_file = qd_logs_dir.join("latest.stderr");

        create_dir_all(&qd_config_dir).unwrap();
        create_dir_all(&qd_logs_dir).unwrap();

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

        self.stdout_file = Some(stdout_file.clone());
        self.stderr_file = Some(stderr_file.clone());
        self.child = Some(run_command(
            &command,
            &qdrant_dir,
            &stdout_file,
            &stderr_file,
        ));

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
            }
        } else if let Some(ref mut child) = self.child {
            match child.try_wait() {
                Ok(Some(status)) if status.success() => {
                    // do nothing? not sure if this gets called at all _after_ killing is done
                    sentry::capture_message(
                        &format!("qdrant finished running; status={status:?}"),
                        Level::Info,
                    );
                    // don't fire again
                    _ = self.child.take();
                }
                Ok(Some(status)) => {
                    // log error in sentry also by reading the log file
                    sentry::capture_message(
                        &format!(
                            "qdrant crashed; status={status:?}\n\nstdout:{}\n\nstderr:{}",
                            std::fs::read_to_string(self.stdout_file.as_ref().unwrap()).unwrap(),
                            std::fs::read_to_string(self.stderr_file.as_ref().unwrap()).unwrap(),
                        ),
                        Level::Error,
                    );

                    // don't fire again
                    _ = self.child.take();
                }
                Ok(None) => {
                    // all is normal, this is what we want
                }
                Err(err) => {
                    error!(?err, "failed to monitor qdrant subprocess");
                }
            }
        }
    }
}

impl Drop for QdrantSupervisor {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            if let Err(err) = child.kill() {
                warn!(?err, "failed to kill qdrant");
            }
        }
    }
}

#[cfg(unix)]
fn run_command(command: &Path, qdrant_dir: &Path, stdout: &Path, stderr: &Path) -> Child {
    use nix::sys::resource::{getrlimit, setrlimit, Resource};

    let logs_file = File::create(stdout).unwrap();
    let stderr_logs_file = File::create(stderr).unwrap();

    match getrlimit(Resource::RLIMIT_NOFILE) {
        Ok((current_soft, current_hard)) => {
            let new_soft = current_hard.min(10000);
            info!(current_soft, current_hard, "got rlimit/nofile");
            if let Err(err) = setrlimit(Resource::RLIMIT_NOFILE, new_soft, current_hard) {
                error!(
                    ?err,
                    new_soft, current_soft, current_hard, "failed to set rlimit/nofile"
                );
            } else {
                info!(new_soft, current_hard, "set rlimit/nofile");
            }
        }
        Err(err) => {
            error!(?err, "failed to get rlimit/nofile");
        }
    }

    Command::new(command)
        .current_dir(qdrant_dir)
        .stdout(logs_file)
        .stderr(stderr_logs_file)
        .spawn()
        .expect("failed to start qdrant")
}

#[cfg(windows)]
fn run_command(command: &Path, qdrant_dir: &Path, stdout: &Path, stderr: &Path) -> Child {
    use std::os::windows::process::CommandExt;

    let qd_logs_dir = qdrant_dir.join("logs");
    create_dir_all(&qd_logs_dir).unwrap();

    let logs_file = File::create(stdout).unwrap();
    let stderr_logs_file = File::create(stderr).unwrap();

    Command::new(command)
        .current_dir(qdrant_dir)
        // Add a CREATE_NO_WINDOW flag to prevent qdrant console popup
        .creation_flags(0x08000000)
        .stdout(logs_file)
        .stderr(stderr_logs_file)
        .spawn()
        .expect("failed to start qdrant")
}
