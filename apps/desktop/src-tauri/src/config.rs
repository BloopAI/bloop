use bleep::Configuration;
use once_cell::sync::OnceCell;
use tauri::Runtime;

static CONFIG: OnceCell<Configuration> = OnceCell::new();

pub fn init<R: Runtime>(app: &tauri::AppHandle<R>) -> &Configuration {
    CONFIG.get_or_init(|| {
        let config = create_configuration(app);
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
