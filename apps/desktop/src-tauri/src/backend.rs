use std::sync::Arc;

use super::{plugin, relative_command_path, App, Manager, Payload, Runtime};

// a hack to get server/bleep/tests/desktop to run correctly
#[cfg(not(test))]
use super::TELEMETRY;
#[cfg(test)]
static TELEMETRY: std::sync::RwLock<bool> = std::sync::RwLock::new(false);

use bleep::{analytics, Application, Configuration, Environment};
use tracing::info;

pub(super) fn bleep<R>(app: &mut App<R>) -> plugin::Result<()>
where
    R: Runtime,
{
    let config = app
        .path_resolver()
        .resolve_resource("config.json")
        .expect("failed to resolve resource");

    let mut configuration = Configuration::merge(
        Configuration::read(config).unwrap(),
        Configuration::from_cli().unwrap(),
    );
    configuration.qdrant_url = Some("http://127.0.0.1:6334".into());
    configuration.ctags_path = relative_command_path("ctags");
    configuration.max_threads = bleep::default_parallelism() / 4;
    configuration.model_dir = app
        .path_resolver()
        .resolve_resource("model")
        .expect("bad bundle");

    let cache_dir = app.path_resolver().app_cache_dir().unwrap();
    configuration.index_dir = cache_dir.join("bleep");

    if let (Some(key), Some(data_plane)) = (
        &configuration.analytics_key,
        &configuration.analytics_data_plane,
    ) {
        initialize_analytics(key.to_owned(), data_plane.to_owned());
    } else {
        info!("Analytics not configured, skipping initialization...")
    }

    let app = app.handle();
    tokio::spawn(async move {
        let initialized =
            Application::initialize(Environment::insecure_local(), configuration).await;

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

pub fn initialize_analytics(key: String, data_plane: String) {
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
        package_metadata: Some(analytics::PackageMetadata {
            name: env!("CARGO_CRATE_NAME"),
            version: env!("CARGO_PKG_VERSION"),
            git_rev: git_version::git_version!(fallback = "unknown"),
        }),
    };
    tokio::task::block_in_place(|| {
        analytics::RudderHub::new_with_options(key, data_plane, options)
    });
}
