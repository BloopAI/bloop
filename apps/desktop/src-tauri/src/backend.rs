use std::fs::File;

use anyhow::Context;
use bleep::{Application, Configuration, Environment};

use super::{plugin, relative_command_path, App, Manager, Payload, Runtime};

pub(super) fn bleep<R>(app: &mut App<R>) -> plugin::Result<()>
where
    R: Runtime,
{
    let config = app
        .path_resolver()
        .resolve_resource("config.json")
        .context("failed to resolve resource `config.json`")
        .and_then(|p| File::open(&p).with_context(|| format!("failed to read `{}`", p.display())))
        .and_then(Configuration::read)
        .unwrap_or_default();

    let mut configuration = Configuration::merge(config, Configuration::from_cli().unwrap());
    configuration.ctags_path = relative_command_path("ctags");
    configuration.max_threads = bleep::default_parallelism() / 4;
    configuration.model_dir = app
        .path_resolver()
        .resolve_resource("model")
        .expect("bad bundle");

    let cache_dir = app.path_resolver().app_cache_dir().unwrap();
    configuration.index_dir = cache_dir.join("bleep");

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
