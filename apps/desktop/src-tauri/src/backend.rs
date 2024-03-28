use bleep::{Application, Configuration, Environment};
use tracing::error;

use super::{Manager, Payload, Runtime};
use std::thread;
use std::time::Duration;

#[tauri::command]
pub fn get_last_log_file(config: tauri::State<Configuration>) -> Option<String> {
    let log_dir = config.log_dir();

    let mut entries = std::fs::read_dir(log_dir)
        .ok()?
        .collect::<Result<Vec<_>, _>>()
        .ok()?;

    // Sort the entries by modified time (most recent first)
    entries.sort_by_key(|entry| {
        entry
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
    });
    entries.reverse();

    // The first entry is the most recent log file
    let filename = match entries.first() {
        Some(path) => path.path().to_string_lossy().to_string(),
        None => {
            tracing::warn!("No log files found");
            return None;
        }
    };

    std::fs::read_to_string(filename).ok()
}

pub fn initialize<R: Runtime>(app: &mut tauri::App<R>) -> tauri::plugin::Result<()> {
    let handle = app.handle();
    let configuration = crate::config::init(&app.handle()).clone();
    app.manage(configuration.clone());

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .thread_name("bleep-backend")
        .build()
        .unwrap();

    runtime.spawn(start_backend(configuration, handle));
    app.manage(runtime);

    Ok(())
}

async fn wait_for_qdrant() -> anyhow::Result<()> {
    use qdrant_client::prelude::*;
    let qdrant =
        QdrantClient::new(Some(QdrantClientConfig::from_url("http://127.0.0.1:6334"))).unwrap();

    for _ in 0..60 {
        if qdrant.health_check().await.is_ok() {
            return Ok(());
        }

        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }

    anyhow::bail!("qdrant cannot be started");
}

async fn start_backend<R: Runtime>(configuration: Configuration, app: tauri::AppHandle<R>) {
    tracing::info!("booting bleep back-end");

    if let Err(err) = wait_for_qdrant().await {
        error!(?err, "qdrant failed to come up");
        thread::sleep(Duration::from_secs(4));
        app.emit_all(
            "server-crashed",
            Payload {
                message: "Failed to start qdrant".into(),
            },
        )
        .unwrap();
    };

    app.manage(configuration.clone());

    let initialized = Application::initialize(Environment::insecure_local(), configuration).await;

    match initialized {
        Ok(backend) => {
            if let Err(err) = backend.run().await {
                error!(?err, "server crashed error");
                app.emit_all(
                    "server-crashed",
                    Payload {
                        message: err.to_string(),
                    },
                )
                .unwrap()
            }
        }
        Err(err) => {
            error!(?err, "server failed to start");
            app.emit_all(
                "server-crashed",
                Payload {
                    message: "Something bad happened".into(),
                },
            )
            .unwrap();
        }
    }
}

// ensure that the leading header and trailer are stripped
#[cfg(windows)]
#[test]
fn device_id_on_single_line() {
    assert_eq!(get_device_id().lines().count(), 1)
}
