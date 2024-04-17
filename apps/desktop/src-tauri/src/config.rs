use bleep::Configuration;
use once_cell::sync::OnceCell;
use sentry::ClientInitGuard;
use tauri::Runtime;

static SENTRY: OnceCell<ClientInitGuard> = OnceCell::new();
static CONFIG: OnceCell<Configuration> = OnceCell::new();

pub fn init<R: Runtime>(app: &tauri::AppHandle<R>) -> &Configuration {
    CONFIG.get_or_init(|| {
        let config = create_configuration(app);

        // the order of initializing these is actually important
        // first set up sentry
        if let Some(ref dsn) = config.sentry_dsn {
            tracing::info!("initializing sentry");
            initialize_sentry(dsn)
        }

        // only after that set up bleep logging hooks
        bleep::Application::install_logging(&config);

        config
    })
}

fn create_configuration<R: Runtime>(app: &tauri::AppHandle<R>) -> Configuration {
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

pub fn sentry_user() -> sentry::User {
    sentry::User {
        other: [("device_id".to_string(), get_device_id().into())].into(),
        ..Default::default()
    }
}

#[cfg(test)]
pub fn get_device_id() -> String {
    String::default()
}

#[cfg(all(not(test), target_os = "macos"))]
pub fn get_device_id() -> String {
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
pub fn get_device_id() -> String {
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
pub fn get_device_id() -> String {
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
