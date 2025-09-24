use anyhow::Result;
use clap::Parser;
use harness_mcp_core::config::Config;
use harness_mcp_core::server::McpServer;
use harness_mcp_core::transport::Transport;
use std::io;
use tokio::signal;
use tracing::{info, warn};

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - Model Context Protocol server for Harness APIs")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Parser)]
enum Commands {
    /// Start stdio server
    Stdio {
        #[command(flatten)]
        config: Config,
    },
    /// Start HTTP server
    HttpServer {
        #[command(flatten)]
        config: Config,
        /// HTTP server port
        #[arg(long, default_value = "8080")]
        port: u16,
        /// HTTP server path
        #[arg(long, default_value = "/mcp")]
        path: String,
    },
    /// Start internal server with bearer token authentication
    Internal {
        #[command(flatten)]
        config: Config,
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Stdio { config } => {
            // Initialize logging for stdio mode
            harness_mcp_core::logging::init_stdio_logging(&config)?;
            
            info!("Starting Harness MCP Server in stdio mode");
            
            let mut server = McpServer::new(config).await?;
            server.run_stdio(io::stdin(), io::stdout()).await?;
        }
        Commands::HttpServer { config, port, path } => {
            // Initialize logging for HTTP mode
            harness_mcp_core::logging::init_file_logging(&config)?;
            
            info!("Starting Harness MCP Server in HTTP mode on port {}", port);
            
            let mut server = McpServer::new(config).await?;
            server.run_http(port, &path).await?;
        }
        Commands::Internal { config, bearer_token } => {
            // Initialize logging for internal mode
            harness_mcp_core::logging::init_file_logging(&config)?;
            
            info!("Starting Harness MCP Server in internal mode");
            
            let mut internal_config = config;
            internal_config.bearer_token = Some(bearer_token);
            internal_config.internal = true;
            
            let mut server = McpServer::new(internal_config).await?;
            server.run_stdio(io::stdin(), io::stdout()).await?;
        }
    }

    Ok(())
}