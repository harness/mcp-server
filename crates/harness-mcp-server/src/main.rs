//! Harness MCP Server
//!
//! A Model Context Protocol (MCP) server that provides seamless integration
//! with Harness APIs, enabling advanced automation and interaction capabilities.

use anyhow::Result;
use clap::{Parser, Subcommand};
use harness_mcp_config::Config;
use harness_mcp_core::logging::{init_logging_from_env, LoggingConfig};
use tracing::{info, Level};

mod cli;
mod middleware;
mod server;

use cli::Cli;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging and tracing
    init_logging_from_env()?;

    // Parse command line arguments
    let cli = Cli::parse();

    // Load configuration
    let config = Config::load_from_sources()?;

    info!("Starting Harness MCP Server");
    info!("Version: {}", env!("CARGO_PKG_VERSION"));
    info!("Mode: {:?}", cli.command);

    // Run the appropriate server mode
    match cli.command {
        cli::Commands::Stdio(args) => {
            server::stdio::run(config, args).await?;
        }
        cli::Commands::Http(args) => {
            server::http::run(config, args).await?;
        }
        cli::Commands::Internal(args) => {
            server::internal::run(config, args).await?;
        }
    }

    Ok(())
}

