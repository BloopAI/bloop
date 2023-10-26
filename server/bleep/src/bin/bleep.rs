use anyhow::Result;
use bleep::{Application, Configuration, Environment};

#[tokio::main]
async fn main() -> Result<()> {
    let config = Configuration::cli_overriding_config_file()?;

    _ = color_eyre::install();

    Application::install_logging(&config);
    let app = Application::initialize(Environment::server(), config, None, None).await?;

    app.initialize_sentry();
    app.run().await
}
