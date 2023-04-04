#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use bleep::Application;

mod backend;
mod qdrant;

pub use tauri::{plugin, App, Manager, Runtime};

use std::{path::PathBuf, sync::RwLock};

pub static TELEMETRY: RwLock<bool> = RwLock::new(false);

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
            enable_telemetry,
            disable_telemetry,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
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
