use std::sync::Arc;

use bleep::{analytics, Application, Configuration, Environment};
use once_cell::sync::OnceCell;
use sentry::ClientInitGuard;

use super::{plugin, App, Manager, Payload, Runtime};

// a hack to get server/bleep/tests/desktop to run correctly
#[cfg(not(test))]
use super::TELEMETRY;

#[cfg(test)]
static TELEMETRY: std::sync::RwLock<bool> = std::sync::RwLock::new(false);

#[cfg(test)]
fn get_device_id() -> String {
    String::default()
}

static SENTRY: OnceCell<ClientInitGuard> = OnceCell::new();

pub(super) fn bleep<R>(app: &mut App<R>) -> plugin::Result<()>
where
    R: Runtime,
{
    let configuration = {
        let path = app
            .path_resolver()
            .resolve_resource("config.json")
            .expect("failed to resolve resource");

        let mut bundled = Configuration::read(path).unwrap();
        bundled.qdrant_url = Some("http://127.0.0.1:6334".into());
        bundled.max_threads = bleep::default_parallelism() / 2;
        bundled.model_dir = app
            .path_resolver()
            .resolve_resource("model")
            .expect("bad bundle");

        let cache_dir = app.path_resolver().app_cache_dir().unwrap();
        bundled.index_dir = cache_dir.join("bleep");

        Configuration::merge(
            bundled,
            Configuration::cli_overriding_config_file().unwrap(),
        )
    };

    if let Some(dsn) = &configuration.sentry_dsn {
        initialize_sentry(dsn);
    }

    let app = app.handle();
    tokio::spawn(async move {
        let initialized = Application::initialize(
            Environment::insecure_local(),
            configuration,
            get_device_id(),
            analytics::HubOptions {
                event_filter: Some(Arc::new(|event| match *TELEMETRY.read().unwrap() {
                    true => Some(event),
                    false => None,
                })),
                package_metadata: Some(analytics::PackageMetadata {
                    name: env!("CARGO_CRATE_NAME"),
                    version: env!("CARGO_PKG_VERSION"),
                    git_rev: git_version::git_version!(fallback = "unknown"),
                }),
            },
        )
        .await;

        if let Ok(backend) = initialized {
            if let Err(_e) = backend.run().await {
                app.emit_all(
                    "server-crashed",
                    Payload {
                        message: _e.to_string(),
                    },
                )
                .unwrap()
            }
        } else {
            app.emit_all(
                "server-crashed",
                Payload {
                    message: "Something bad happened".into(),
                },
            )
            .unwrap();
        }
    });

    Ok(())
}

fn initialize_sentry(dsn: &str) {
    if sentry::Hub::current().client().is_some() {
        tracing::info!("Sentry has already been initialized");
        return;
    }

    let unique_device_id = format!(
        "{target}-{id}",
        target = std::env::consts::OS,
        id = get_device_id()
    );
    let user = Some(sentry::protocol::User {
        id: Some(unique_device_id),
        ..Default::default()
    });

    sentry::configure_scope(|scope| {
        scope.set_user(user);
    });

    let guard = sentry::init((
        dsn,
        sentry::ClientOptions {
            release: sentry::release_name!(),
            before_send: Some(Arc::new(|event| match *TELEMETRY.read().unwrap() {
                true => Some(event),
                false => None,
            })),
            ..Default::default()
        },
    ));
    _ = SENTRY.set(guard);
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
    result.into()
}

#[cfg(all(not(test), target_os = "linux"))]
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
    result.into()
}

// ensure that the leading header and trailer are stripped
#[cfg(windows)]
#[test]
fn device_id_on_single_line() {
    assert_eq!(get_device_id().lines().count(), 1)
}
