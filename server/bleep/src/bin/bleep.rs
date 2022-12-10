use anyhow::Result;
use bleep::{Application, Configuration, Environment};

#[tokio::main]
async fn main() -> Result<()> {
    let app = Application::initialize(Environment::Server, Configuration::from_cli()?)?;
    app.run().await
}
