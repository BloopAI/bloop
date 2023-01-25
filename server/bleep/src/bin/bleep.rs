use anyhow::Result;
use bleep::{Application, Configuration, Environment};

#[tokio::main]
async fn main() -> Result<()> {
    Application::install_logging();
    Application::install_sentry();
    let app = Application::initialize(Environment::Server, Configuration::from_cli()?).await?;

    app.run().await
}
