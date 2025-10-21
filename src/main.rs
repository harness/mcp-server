use anyhow::Result;
use clap::Parser;
use tracing::{info, error};

mod cli;
mod config;
mod server;
mod mcp;
mod tools;
mod auth;
mod error;
mod utils;
mod client;

use cli::Cli;
use config::Config;

#[tokio::main]
async fn main() -> Result<()> {
    // Parse command line arguments
    let cli = Cli::parse();
    
    // Initialize configuration
    let config = Config::from_cli(&cli)?;
    
    // Initialize logging
    init_logging(&config)?;
    
    info!("Starting Harness MCP Server v{}", env!("CARGO_PKG_VERSION"));
    
    // Run the appropriate server mode
    match cli.command {
        cli::Commands::Stdio => {
            server::stdio::run(config).await
        }
        cli::Commands::HttpServer => {
            server::http::run(config).await
        }
        cli::Commands::Internal => {
            server::internal::run(config).await
        }
    }
}

fn init_logging(config: &Config) -> Result<()> {
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
    
    let filter = if config.debug {
        EnvFilter::new("debug")
    } else {
        EnvFilter::new("info")
    };
    
    let subscriber = tracing_subscriber::registry().with(filter);
    
    if config.log_format == config::LogFormat::Json {
        let json_layer = tracing_subscriber::fmt::layer()
            .json()
            .with_current_span(false)
            .with_span_list(true);
        subscriber.with(json_layer).init();
    } else {
        let fmt_layer = tracing_subscriber::fmt::layer()
            .with_target(false)
            .with_thread_ids(true)
            .with_file(true)
            .with_line_number(true);
        subscriber.with(fmt_layer).init();
    }
    
    Ok(())
}