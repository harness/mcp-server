use anyhow::Result;
use clap::Parser;
use std::process;
use tracing::{info, error};

mod config;
mod error;
mod mcp;
mod client;
mod toolsets;
mod tools;
mod types;

use config::{Config, Commands};

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Parse command line arguments
    let config = Config::parse();

    // Run the application
    if let Err(e) = run(config).await {
        error!("Application error: {:#}", e);
        process::exit(1);
    }
}

async fn run(config: Config) -> Result<()> {
    info!("Starting Harness MCP Server v{}", env!("CARGO_PKG_VERSION"));
    
    match config.command {
        Commands::Stdio(stdio_config) => {
            info!("Starting stdio server");
            mcp::stdio::run_stdio_server(stdio_config).await
        }
        Commands::Http(http_config) => {
            info!("Starting HTTP server on port {}", http_config.port);
            mcp::http::run_http_server(http_config).await
        }
        Commands::Internal(internal_config) => {
            info!("Starting internal server");
            mcp::internal::run_internal_server(internal_config).await
        }
    }
}