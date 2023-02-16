use bleep::{Application, Configuration, Environment};

use super::{
    initialize_rudder_analytics, plugin, relative_command_path, App, Manager, Payload, Runtime,
};

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
        initialize_rudder_analytics(key.to_owned(), data_plane.to_owned());
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
