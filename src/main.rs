use anyhow::Result;
use clap::{Parser, Subcommand};
use std::io;
use tokio::signal;
use tracing::{info, error};

mod config;
mod harness;
mod modules;
mod toolsets;
mod types;
mod utils;
mod client;

use config::Config;
use harness::server::HarnessServer;

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - A Model Context Protocol server for Harness APIs")]
#[command(version = env!("CARGO_PKG_VERSION"))]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable debug logging
    #[arg(long, global = true)]
    debug: bool,

    /// Path to log file
    #[arg(long, global = true)]
    log_file: Option<String>,

    /// Comma-separated list of toolsets to enable
    #[arg(long, global = true, value_delimiter = ',')]
    toolsets: Option<Vec<String>>,

    /// Enable license validation
    #[arg(long, global = true)]
    enable_license: bool,

    /// Comma-separated list of modules to enable
    #[arg(long, global = true, value_delimiter = ',')]
    enable_modules: Option<Vec<String>>,

    /// Run in read-only mode
    #[arg(long, global = true)]
    read_only: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Start stdio server
    Stdio {
        /// Base URL for Harness
        #[arg(long, default_value = "https://app.harness.io")]
        base_url: String,

        /// API key for authentication
        #[arg(long, env = "HARNESS_API_KEY")]
        api_key: String,

        /// Default organization ID
        #[arg(long, env = "HARNESS_DEFAULT_ORG_ID")]
        default_org_id: Option<String>,

        /// Default project ID
        #[arg(long, env = "HARNESS_DEFAULT_PROJECT_ID")]
        default_project_id: Option<String>,
    },
    /// Start HTTP server
    HttpServer {
        /// HTTP server port
        #[arg(long, default_value = "8080")]
        http_port: u16,

        /// HTTP server path
        #[arg(long, default_value = "/mcp")]
        http_path: String,
    },
    /// Start internal server
    Internal {
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: String,

        /// MCP service secret
        #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
        mcp_svc_secret: String,

        // Add other internal service configurations as needed
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize tracing
    init_tracing(cli.debug, cli.log_file.as_deref())?;

    info!("Starting Harness MCP Server v{}", env!("CARGO_PKG_VERSION"));

    match cli.command {
        Commands::Stdio {
            base_url,
            api_key,
            default_org_id,
            default_project_id,
        } => {
            let account_id = extract_account_id_from_api_key(&api_key)?;
            
            let config = Config::new_stdio(
                base_url,
                account_id,
                api_key,
                default_org_id,
                default_project_id,
                cli.toolsets.unwrap_or_default(),
                cli.enable_modules.unwrap_or_default(),
                cli.read_only,
                cli.enable_license,
            );

            run_stdio_server(config).await
        }
        Commands::HttpServer { http_port, http_path } => {
            let config = Config::new_http(
                http_port,
                http_path,
                cli.toolsets.unwrap_or_default(),
                cli.enable_modules.unwrap_or_default(),
                cli.read_only,
                cli.enable_license,
            );

            run_http_server(config).await
        }
        Commands::Internal {
            bearer_token,
            mcp_svc_secret,
        } => {
            let config = Config::new_internal(
                bearer_token,
                mcp_svc_secret,
                cli.toolsets.unwrap_or_default(),
                cli.enable_modules.unwrap_or_default(),
                cli.enable_license,
            );

            run_internal_server(config).await
        }
    }
}

fn init_tracing(debug: bool, log_file: Option<&str>) -> Result<()> {
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

    let filter = if debug {
        EnvFilter::new("debug")
    } else {
        EnvFilter::from_default_env().add_directive("harness_mcp_server=info".parse()?)
    };

    let subscriber = tracing_subscriber::registry().with(filter);

    if let Some(log_file) = log_file {
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
            .with_writer(io::stdout);
        
        subscriber.with(stdout_layer).init();
    }

    Ok(())
}

fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        anyhow::bail!("Invalid API key format");
    }
    Ok(parts[1].to_string())
}

async fn run_stdio_server(config: Config) -> Result<()> {
    info!("Starting stdio server with base URL: {}", config.base_url().unwrap_or("N/A"));
    
    let server = HarnessServer::new(config).await?;
    
    // Set up graceful shutdown
    let shutdown = async {
        signal::ctrl_c().await.expect("Failed to install CTRL+C signal handler");
        info!("Received shutdown signal");
    };

    tokio::select! {
        result = server.run_stdio() => {
            if let Err(e) = result {
                error!("Server error: {}", e);
                return Err(e);
            }
        }
        _ = shutdown => {
            info!("Shutting down server...");
        }
    }

    Ok(())
}

async fn run_http_server(config: Config) -> Result<()> {
    info!("Starting HTTP server on port {}", config.http_port().unwrap_or(8080));
    
    let server = HarnessServer::new(config).await?;
    
    // Set up graceful shutdown
    let shutdown = async {
        signal::ctrl_c().await.expect("Failed to install CTRL+C signal handler");
        info!("Received shutdown signal");
    };

    tokio::select! {
        result = server.run_http() => {
            if let Err(e) = result {
                error!("Server error: {}", e);
                return Err(e);
            }
        }
        _ = shutdown => {
            info!("Shutting down server...");
        }
    }

    Ok(())
}

async fn run_internal_server(config: Config) -> Result<()> {
    info!("Starting internal server");
    
    let server = HarnessServer::new(config).await?;
    
    // Set up graceful shutdown
    let shutdown = async {
        signal::ctrl_c().await.expect("Failed to install CTRL+C signal handler");
        info!("Received shutdown signal");
    };

    tokio::select! {
        result = server.run_stdio() => {
            if let Err(e) = result {
                error!("Server error: {}", e);
                return Err(e);
            }
        }
        _ = shutdown => {
            info!("Shutting down server...");
        }
    }

    Ok(())
}