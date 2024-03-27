use anyhow::Result;
use bleep::{Application, Configuration, Environment};

#[tokio::main]
async fn main() -> Result<()> {
    let config = {
        let c = Configuration::cli_overriding_config_file()?;
        if let Ok(remote) = c.clone().with_remote_cognito_config().await {
            remote
        } else {
            c
        }
    };

    _ = color_eyre::install();

    Application::install_logging(&config);
    let app = Application::initialize(Environment::server(), config).await?;

    app.run().await
}
