use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod harness;
mod modules;
mod toolsets;
mod types;
mod utils;

use config::Config;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - A Model Context Protocol server for Harness APIs")]
#[command(version = VERSION)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable debug logging
    #[arg(long, global = true)]
    debug: bool,

    /// Log file path
    #[arg(long, global = true)]
    log_file: Option<String>,

    /// Base URL for Harness API
    #[arg(long, global = true, env = "HARNESS_BASE_URL")]
    base_url: Option<String>,

    /// Harness API key
    #[arg(long, global = true, env = "HARNESS_API_KEY")]
    api_key: Option<String>,

    /// Default organization ID
    #[arg(long, global = true, env = "HARNESS_DEFAULT_ORG_ID")]
    org_id: Option<String>,

    /// Default project ID
    #[arg(long, global = true, env = "HARNESS_DEFAULT_PROJECT_ID")]
    project_id: Option<String>,

    /// Comma-separated list of toolsets to enable
    #[arg(long, global = true, env = "HARNESS_TOOLSETS")]
    toolsets: Option<String>,

    /// Run in read-only mode
    #[arg(long, global = true, env = "HARNESS_READ_ONLY")]
    read_only: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Start MCP server with stdio transport
    Stdio,
    /// Start MCP server with HTTP transport
    HttpServer {
        /// Port to listen on
        #[arg(short, long, default_value = "8080")]
        port: u16,
        /// Host to bind to
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables from .env file if present
    dotenvy::dotenv().ok();

    let cli = Cli::parse();

    // Initialize logging
    init_logging(&cli)?;

    info!("Starting Harness MCP Server v{}", VERSION);

    // Load configuration
    let config = Config::from_cli(&cli)?;

    // Validate configuration
    config.validate()?;

    info!("Configuration loaded successfully");
    info!("Base URL: {}", config.base_url);
    info!("Read-only mode: {}", config.read_only);

    match cli.command {
        Commands::Stdio => {
            info!("Starting MCP server with stdio transport");
            harness::server::run_stdio(config).await?;
        }
        Commands::HttpServer { port, host } => {
            info!("Starting MCP server with HTTP transport on {}:{}", host, port);
            harness::server::run_http(config, &host, port).await?;
        }
    }

    Ok(())
}

fn init_logging(cli: &Cli) -> Result<()> {
    let log_level = if cli.debug {
        tracing::Level::DEBUG
    } else {
        tracing::Level::INFO
    };

    let subscriber = tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| format!("harness_mcp_server={}", log_level).into()),
        );

    if let Some(log_file) = &cli.log_file {
        let file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_file)?;
        
        let file_layer = tracing_subscriber::fmt::layer()
            .with_writer(file)
            .with_ansi(false);
        
        subscriber.with(file_layer).init();
    } else {
        let stdout_layer = tracing_subscriber::fmt::layer()
            .with_writer(std::io::stderr);
        
        subscriber.with(stdout_layer).init();
    }

    Ok(())
}