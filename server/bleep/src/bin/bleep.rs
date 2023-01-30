use anyhow::Result;
use bleep::{Application, Configuration, Environment};

#[tokio::main]
async fn main() -> Result<()> {
    Application::install_logging();
    let app = Application::initialize(Environment::server(), Configuration::from_cli()?).await?;

    app.install_sentry();
    app.run().await
}
