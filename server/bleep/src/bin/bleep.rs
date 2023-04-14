use anyhow::Result;
use bleep::{Application, Configuration, Environment};

#[tokio::main]
async fn main() -> Result<()> {
    Application::install_logging();
    let app = Application::initialize(
        Environment::server(),
        Configuration::cli_overriding_config_file()?,
        None,
        None,
    )
    .await?;

    app.initialize_sentry();
    app.run().await
}
