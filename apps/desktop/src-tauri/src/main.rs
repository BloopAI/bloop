#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod backend;
mod qdrant;

use std::{
    path::PathBuf,
    sync::{Arc, RwLock},
};

use bleep::{analytics, Application};
use once_cell::sync::OnceCell;
use sentry::ClientInitGuard;
pub use tauri::{plugin, App, Manager, Runtime};
use tracing::info;

static TELEMETRY: RwLock<bool> = RwLock::new(false);
static SENTRY: OnceCell<ClientInitGuard> = OnceCell::new();

// the payload type must implement `Serialize` and `Clone`.
#[derive(Clone, serde::Serialize)]
struct Payload {
    message: String,
}

fn relative_command_path(command: impl AsRef<str>) -> Option<PathBuf> {
    let cmd = if cfg!(windows) {
        format!("{}.exe", command.as_ref())
    } else {
        command.as_ref().into()
    };

    std::env::current_exe()
        .ok()?
        .parent()
        .map(|dir| dir.join(cmd))
        .filter(|path| path.is_file())
}

#[tokio::main]
async fn main() {
    Application::install_logging();

    tauri::Builder::default()
        .plugin(qdrant::QdrantSupervisor::default())
        .setup(backend::bleep)
        .invoke_handler(tauri::generate_handler![
            show_folder_in_finder,
            get_device_id,
            enable_telemetry,
            disable_telemetry,
            initialize_sentry,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}

#[tauri::command]
fn initialize_sentry(dsn: String, environment: String) {
    if sentry::Hub::current().client().is_some() {
        tracing::info!("Sentry has already been initialized");
        return;
    }
    let guard = sentry::init((
        dsn,
        sentry::ClientOptions {
            release: sentry::release_name!(),
            environment: Some(environment.into()),
            before_send: Some(Arc::new(|event| match *TELEMETRY.read().unwrap() {
                true => Some(event),
                false => None,
            })),
            ..Default::default()
        },
    ));
    _ = SENTRY.set(guard);
}

pub async fn initialize_rudder_analytics(key: String, data_plane: String) {
    if analytics::RudderHub::get().is_some() {
        info!("analytics has already been initialized");
        return;
    }
    info!("initializing analytics");
    let options = analytics::HubOptions {
        event_filter: Some(Arc::new(|event| match *TELEMETRY.read().unwrap() {
            true => Some(event),
            false => None,
        })),
    };
    tokio::task::block_in_place(|| {
        analytics::RudderHub::new_with_options(key, data_plane, options)
    });
}

#[tauri::command]
fn enable_telemetry() {
    let mut guard = TELEMETRY.write().unwrap();
    *guard = true;
}

#[tauri::command]
fn disable_telemetry() {
    let mut guard = TELEMETRY.write().unwrap();
    *guard = false;
}

#[tauri::command]
fn show_folder_in_finder(path: String) {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .arg("-R") // will reveal the file in finder instead of opening it
            .spawn()
            .unwrap();
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .unwrap();
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .unwrap();
    }
}

#[tauri::command]
#[cfg(target_os = "macos")]
fn get_device_id() -> String {
    let ioreg = std::process::Command::new("ioreg")
        .arg("-d2")
        .arg("-c")
        .arg("IOPlatformExpertDevice")
        .stdout(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    let command = std::process::Command::new("awk")
        .arg("-F\"")
        .arg("/IOPlatformUUID/{print $(NF-1)}")
        .stdin(std::process::Stdio::from(ioreg.stdout.unwrap()))
        .stdout(std::process::Stdio::piped())
        .spawn()
        .unwrap();

    let output = command.wait_with_output().unwrap();
    let result = std::str::from_utf8(&output.stdout).unwrap();
    result.into()
}

#[tauri::command]
#[cfg(target_os = "linux")]
fn get_device_id() -> String {
    use tracing::warn;

    const STANDARD_MACHINE_ID: &str = "/etc/machine-id";
    const LEGACY_MACHINE_ID: &str = "/var/lib/dbus/machine-id";

    std::fs::read_to_string(STANDARD_MACHINE_ID)
        .or_else(|_| {
            warn!(
                "could not find machine-id at `{}`, looking in `{}`",
                STANDARD_MACHINE_ID, LEGACY_MACHINE_ID
            );
            std::fs::read_to_string(LEGACY_MACHINE_ID)
        })
        .unwrap_or_else(|_| {
            warn!("failed to determine machine-id");
            "unknown-machine-id".to_owned()
        })
}

#[tauri::command]
#[cfg(target_os = "windows")]
fn get_device_id() -> String {
    let command = std::process::Command::new("wmic")
        .arg("csproduct")
        .arg("get")
        .arg("UUID")
        .stdout(std::process::Stdio::piped())
        .spawn()
        .unwrap();

    let output = command.wait_with_output().unwrap();

    // the output contains 3 lines:
    //
    //     UUID
    //     EE134675-518A-8D49-B5E7-2475F745D1E6
    //     <newline>
    //
    // our goal is to preserve only the actual UUID.
    let result = std::str::from_utf8(&output.stdout)
        .unwrap()
        .trim_start_matches("UUID") // remove the initial `UUID` header
        .trim(); // remove the leading and trailing newlines
    result.into()
}

// ensure that the leading header and trailer are stripped
#[cfg(windows)]
#[test]
fn device_id_on_single_line() {
    assert_eq!(get_device_id().lines().count(), 1)
}
