//! Harness MCP Server
//! 
//! A Model Context Protocol server that provides seamless integration with Harness APIs,
//! enabling advanced automation and interaction capabilities for developers and tools.

use anyhow::Result;
use clap::{Parser, Subcommand};
use harness_mcp_server::{
    config::Config,
    server::{HttpServer, StdioServer},
};
use tracing::{info, level_filters::LevelFilter};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// Harness MCP Server CLI
#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "A Harness MCP server that handles various tools and resources")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable debug logging
    #[arg(long, global = true)]
    debug: bool,

    /// Log format (text or json)
    #[arg(long, global = true, default_value = "text")]
    log_format: String,

    /// Configuration file path
    #[arg(long, global = true)]
    config: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// Start MCP as a standalone server with HTTP transport
    HttpServer {
        /// HTTP server port
        #[arg(long, default_value = "8080")]
        port: u16,

        /// HTTP server path
        #[arg(long, default_value = "/mcp")]
        path: String,

        /// Metrics server port
        #[arg(long, default_value = "8889")]
        metrics_port: u16,
    },
    /// Start stdio server
    Stdio {
        /// API key for authentication
        #[arg(long, env = "HARNESS_API_KEY")]
        api_key: String,

        /// Base URL for Harness
        #[arg(long, default_value = "https://app.harness.io")]
        base_url: String,

        /// Default org ID to use
        #[arg(long)]
        default_org_id: Option<String>,

        /// Default project ID to use
        #[arg(long)]
        default_project_id: Option<String>,
    },
    /// Start stdio server in internal mode
    Internal {
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize tracing
    init_tracing(&cli)?;

    // Load configuration
    let mut config = Config::load(cli.config.as_deref())?;
    
    // Override config with CLI arguments
    if cli.debug {
        config.debug = true;
    }

    info!("Starting Harness MCP Server");

    match cli.command {
        Commands::HttpServer { port, path, metrics_port } => {
            config.http.port = port;
            config.http.path = path;
            config.metrics.port = metrics_port;
            config.transport = harness_mcp_server::config::TransportType::Http;
            
            let server = HttpServer::new(config).await?;
            server.serve().await?;
        }
        Commands::Stdio { api_key, base_url, default_org_id, default_project_id } => {
            config.api_key = Some(api_key);
            config.base_url = base_url;
            config.default_org_id = default_org_id;
            config.default_project_id = default_project_id;
            config.transport = harness_mcp_server::config::TransportType::Stdio;
            
            let server = StdioServer::new(config).await?;
            server.serve().await?;
        }
        Commands::Internal { bearer_token } => {
            config.bearer_token = Some(bearer_token);
            config.internal = true;
            config.transport = harness_mcp_server::config::TransportType::Stdio;
            
            let server = StdioServer::new(config).await?;
            server.serve().await?;
        }
    }

    Ok(())
}

fn init_tracing(cli: &Cli) -> Result<()> {
    let level = if cli.debug {
        LevelFilter::DEBUG
    } else {
        LevelFilter::INFO
    };

    let subscriber = tracing_subscriber::registry()
        .with(tracing_error::ErrorLayer::default());

    match cli.log_format.as_str() {
        "json" => {
            subscriber
                .with(
                    tracing_subscriber::fmt::layer()
                        .json()
                        .with_level(true)
                        .with_target(true)
                        .with_filter(level),
                )
                .init();
        }
        _ => {
            subscriber
                .with(
                    tracing_subscriber::fmt::layer()
                        .with_level(true)
                        .with_target(true)
                        .with_filter(level),
                )
                .init();
        }
    }

    Ok(())
}