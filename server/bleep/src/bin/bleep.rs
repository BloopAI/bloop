use anyhow::Result;
use bleep::{Application, Configuration, Environment};

#[tokio::main]
async fn main() -> Result<()> {
    Application::install_logging();
    let app = Application::initialize(
        Environment::server(),
        Configuration::cli_overriding_config_file()?,
    )
    .await?;

    app.install_sentry();
    app.install_analytics();
    app.run().await
}
