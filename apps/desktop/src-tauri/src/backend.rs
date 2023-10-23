use std::sync::Arc;

use bleep::{analytics, Application, Configuration, Environment};
use once_cell::sync::OnceCell;
use sentry::ClientInitGuard;
use tracing::error;

use super::{Manager, Payload, Runtime};

// a hack to get server/bleep/tests/desktop to run correctly
#[cfg(not(test))]
use super::TELEMETRY;

#[cfg(test)]
use {once_cell::sync::Lazy, std::sync::RwLock};

#[cfg(test)]
static TELEMETRY: Lazy<Arc<RwLock<bool>>> = Lazy::new(|| Arc::new(RwLock::new(false)));

#[cfg(test)]
fn get_device_id() -> String {
    String::default()
}

static SENTRY: OnceCell<ClientInitGuard> = OnceCell::new();

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
    let configuration = setup_configuration(&handle);

    Application::install_logging(&configuration);

    if let Some(dsn) = &configuration.sentry_dsn {
        tracing::info!("initializing sentry");
        initialize_sentry(dsn);
    }

    app.manage(configuration.clone());

    tokio::spawn(start_backend(configuration, handle));

    Ok(())
}

async fn wait_for_qdrant() {
    use qdrant_client::prelude::*;
    let qdrant =
        QdrantClient::new(Some(QdrantClientConfig::from_url("http://127.0.0.1:6334"))).unwrap();

    for _ in 0..60 {
        if qdrant.health_check().await.is_ok() {
            return;
        }

        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }

    panic!("qdrant cannot be started");
}

async fn start_backend<R: Runtime>(configuration: Configuration, app: tauri::AppHandle<R>) {
    tracing::info!("booting bleep back-end");

    wait_for_qdrant().await;

    let initialized = Application::initialize(
        Environment::insecure_local(),
        configuration,
        get_device_id(),
        analytics::HubOptions {
            enable_telemetry: Arc::clone(&TELEMETRY),
            package_metadata: Some(analytics::PackageMetadata {
                name: env!("CARGO_CRATE_NAME"),
                version: env!("CARGO_PKG_VERSION"),
                git_rev: git_version::git_version!(fallback = "unknown"),
            }),
        },
    )
    .await;

    match initialized {
        Ok(backend) => {
            sentry::Hub::main().configure_scope(|scope| {
                let backend = backend.clone();
                scope.add_event_processor(move |mut event| {
                    event.user = Some(sentry_user()).map(|mut user| {
                        let username = backend.username();

                        user.id = Some(
                            if let (Some(analytics), Some(username)) =
                                (&backend.analytics, &username)
                            {
                                analytics.tracking_id(Some(username))
                            } else {
                                get_device_id()
                            },
                        );
                        user.username = username;
                        user
                    });

                    Some(event)
                });
            });

            if let Err(err) = backend.run().await {
                error!(?err, "server crashed error");
                sentry_anyhow::capture_anyhow(&err);
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
            sentry_anyhow::capture_anyhow(&err);
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

fn setup_configuration<R: Runtime>(app: &tauri::AppHandle<R>) -> Configuration {
    let path = app
        .path_resolver()
        .resolve_resource("config/config.json")
        .expect("failed to resolve resource");

    let mut bundled = Configuration::read(path).unwrap();
    bundled.qdrant_url = "http://127.0.0.1:6334".into();
    bundled.max_threads = bleep::default_parallelism() / 2;
    bundled.model_dir = app
        .path_resolver()
        .resolve_resource("model")
        .expect("bad bundle");

    bundled.dylib_dir = Some(if cfg!(all(target_os = "macos", debug_assertions)) {
        app.path_resolver()
            .resolve_resource("dylibs")
            .expect("missing `apps/desktop/src-tauri/dylibs`")
            .parent()
            .expect("invalid path")
            .to_owned()
    } else if cfg!(target_os = "macos") {
        app.path_resolver()
            .resolve_resource("dylibs")
            .expect("missing `apps/desktop/src-tauri/dylibs`")
            .parent()
            .expect("invalid path")
            .parent()
            .expect("invalid path")
            .join("Frameworks")
    } else {
        app.path_resolver()
            .resolve_resource("dylibs")
            .expect("missing `apps/desktop/src-tauri/dylibs`")
    });

    let data_dir = app.path_resolver().app_data_dir().unwrap();
    bundled.index_dir = data_dir.join("bleep");

    Configuration::merge(
        bundled,
        Configuration::cli_overriding_config_file().unwrap(),
    )
}

fn initialize_sentry(dsn: &str) {
    if SENTRY
        .set(sentry::init((
            dsn,
            sentry::ClientOptions {
                release: sentry::release_name!(),
                before_send: Some(Arc::new(|event| match *TELEMETRY.read().unwrap() {
                    true => Some(event),
                    false => None,
                })),
                ..Default::default()
            },
        )))
        .is_err()
    {
        // i don't see a way how this would trigger, but just to be on
        // the safe side, make sure we blow up
        panic!("in the disco");
    }

    sentry::configure_scope(|scope| scope.set_user(Some(sentry_user())));
}

fn sentry_user() -> sentry::User {
    sentry::User {
        other: [("device_id".to_string(), get_device_id().into())].into(),
        ..Default::default()
    }
}

#[cfg(all(not(test), target_os = "macos"))]
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
    format!("{target}-{id}", target = std::env::consts::OS, id = result)
}

#[cfg(all(not(test), target_os = "linux"))]
fn get_device_id() -> String {
    use tracing::warn;

    const STANDARD_MACHINE_ID: &str = "/etc/machine-id";
    const LEGACY_MACHINE_ID: &str = "/var/lib/dbus/machine-id";

    let result = std::fs::read_to_string(STANDARD_MACHINE_ID)
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
        });

    format!("{target}-{id}", target = std::env::consts::OS, id = result)
}

#[cfg(all(not(test), target_os = "windows"))]
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

    format!("{target}-{id}", target = std::env::consts::OS, id = result)
}

// ensure that the leading header and trailer are stripped
#[cfg(windows)]
#[test]
fn device_id_on_single_line() {
    assert_eq!(get_device_id().lines().count(), 1)
}
