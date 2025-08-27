use anyhow::Result;
use clap::Parser;
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod cli;
mod config;
mod server;
mod auth;
mod client;
mod tools;
mod modules;
mod dto;
mod error;
mod utils;

use cli::Cli;
use config::Config;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    init_tracing()?;

    // Parse command line arguments
    let cli = Cli::parse();

    // Load configuration
    let config = Config::load(&cli)?;

    info!("Starting Harness MCP Server");
    info!("Version: {}", env!("CARGO_PKG_VERSION"));
    info!("Base URL: {}", config.base_url);

    // Run the appropriate command
    match cli.command {
        cli::Commands::Stdio { .. } => {
            server::run_stdio_server(config).await?;
        }
        cli::Commands::Internal { .. } => {
            server::run_internal_server(config).await?;
        }
    }

    Ok(())
}

fn init_tracing() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "harness_mcp_server=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    Ok(())
}