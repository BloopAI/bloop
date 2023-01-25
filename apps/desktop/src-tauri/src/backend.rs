use bleep::{Application, Configuration, Environment};

use super::{plugin, relative_command_path, App, Manager, Payload, Runtime};

pub(super) fn bleep<R>(app: &mut App<R>) -> plugin::Result<()>
where
    R: Runtime,
{
    let config = app
        .path_resolver()
        .resolve_resource("config.json")
        .expect("failed to resolve resource");

    let mut configuration = Configuration::read(config).unwrap();
    configuration.ctags_path = relative_command_path("ctags");
    configuration.max_threads = bleep::default_parallelism() / 4;
    configuration.model_dir = app
        .path_resolver()
        .resolve_resource("model")
        .expect("bad bundle");

    let cache_dir = app.path_resolver().app_cache_dir().unwrap();
    configuration
        .source
        .set_default_dir(&cache_dir.join("bleep"));

    let app = app.handle();
    tokio::spawn(async move {
        let initialized = Application::initialize(Environment::PrivateServer, configuration).await;

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
