use anyhow::Result;
use clap::Parser;
use tracing::{info, Level};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, Layer};

mod auth;
mod client;
mod config;
mod dto;
mod error;
mod harness;
mod middleware;
mod modules;
mod server;
mod toolsets;
mod tools;
mod types;
mod utils;

use config::{Cli, Config, LogFormat, TransportType};
use server::{http_server, stdio_server};

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse_args();
    
    // Initialize configuration
    let config = Config::from_cli(&cli)?;
    
    // Initialize logging
    init_logging(&config)?;
    
    info!(
        version = VERSION,
        transport = ?config.transport,
        "Starting Harness MCP Server"
    );
    
    // Run the appropriate server based on transport type
    match config.transport {
        TransportType::Stdio => stdio_server::run(config).await,
        TransportType::Http => http_server::run(config).await,
        TransportType::Internal => http_server::run(config).await, // Internal uses HTTP transport
    }
}

fn init_logging(config: &Config) -> Result<()> {
    let level = if config.debug {
        Level::DEBUG
    } else {
        Level::INFO
    };
    
    let subscriber = tracing_subscriber::registry();
    
    match config.log_format {
        LogFormat::Json => {
            subscriber
                .with(
                    tracing_subscriber::fmt::layer()
                        .json()
                        .with_level(true)
                        .with_target(true)
                        .with_thread_ids(true)
                        .with_filter(tracing_subscriber::filter::LevelFilter::from_level(level))
                )
                .init();
        }
        LogFormat::Text => {
            subscriber
                .with(
                    tracing_subscriber::fmt::layer()
                        .with_level(true)
                        .with_target(true)
                        .with_thread_ids(true)
                        .with_filter(tracing_subscriber::filter::LevelFilter::from_level(level))
                )
                .init();
        }
    }
    
    Ok(())
}