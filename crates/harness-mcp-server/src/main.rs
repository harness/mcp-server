//! Harness MCP Server
//!
//! A Model Context Protocol server that provides seamless integration
//! with Harness APIs, enabling advanced automation and interaction
//! capabilities for developers and tools.

use anyhow::Result;
use clap::Parser;
use std::process;
use tracing::{error, info};

mod cli;
mod server;

use cli::Cli;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Parse command line arguments
    let cli = Cli::parse();

    // Run the application
    if let Err(e) = run(cli).await {
        error!("Application error: {:#}", e);
        process::exit(1);
    }
}

async fn run(cli: Cli) -> Result<()> {
    info!("Starting Harness MCP Server");

    match cli.command {
        cli::Commands::Stdio(args) => server::run_stdio_server(args).await,
        cli::Commands::HttpServer(args) => server::run_http_server(args).await,
        cli::Commands::Internal(args) => server::run_internal_server(args).await,
    }
}
