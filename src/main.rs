use anyhow::Result;
use clap::{Parser, Subcommand};
use log::{error, info};
use std::process;
use tokio::signal;

mod config;
mod server;
mod auth;
mod tools;
mod modules;
mod common;

use crate::config::Config;
use crate::server::McpServer;

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - Rust implementation")]
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
    /// Start stdio server in internal mode
    Internal {
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: String,

        /// MCP service secret
        #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
        mcp_svc_secret: String,

        // Add other internal service URLs and secrets as needed
        /// Pipeline service base URL
        #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
        pipeline_svc_base_url: Option<String>,

        /// Pipeline service secret
        #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
        pipeline_svc_secret: Option<String>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    init_logging(cli.debug, cli.log_file.as_deref())?;

    // Handle shutdown signals
    let shutdown = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C signal handler");
        info!("Shutdown signal received");
    };

    // Run the appropriate command
    let result = match cli.command {
        Commands::Stdio {
            base_url,
            api_key,
            default_org_id,
            default_project_id,
        } => {
            let config = Config::new_stdio(
                base_url,
                api_key,
                default_org_id,
                default_project_id,
                cli.toolsets.unwrap_or_default(),
                cli.enable_modules.unwrap_or_default(),
                cli.read_only,
                cli.enable_license,
            )?;

            run_stdio_server(config, shutdown).await
        }
        Commands::Internal {
            bearer_token,
            mcp_svc_secret,
            pipeline_svc_base_url,
            pipeline_svc_secret,
        } => {
            let config = Config::new_internal(
                bearer_token,
                mcp_svc_secret,
                pipeline_svc_base_url,
                pipeline_svc_secret,
                cli.toolsets.unwrap_or_default(),
                cli.enable_modules.unwrap_or_default(),
                cli.read_only,
                cli.enable_license,
            )?;

            run_stdio_server(config, shutdown).await
        }
    };

    if let Err(e) = result {
        error!("Server error: {}", e);
        process::exit(1);
    }

    Ok(())
}

fn init_logging(debug: bool, log_file: Option<&str>) -> Result<()> {
    let mut builder = env_logger::Builder::new();
    
    if debug {
        builder.filter_level(log::LevelFilter::Debug);
    } else {
        builder.filter_level(log::LevelFilter::Info);
    }

    if let Some(file_path) = log_file {
        use std::fs::OpenOptions;
        use std::io::Write;
        
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(file_path)?;
        
        builder.target(env_logger::Target::Pipe(Box::new(file)));
    }

    builder.init();
    Ok(())
}

async fn run_stdio_server<F>(config: Config, shutdown: F) -> Result<()>
where
    F: std::future::Future<Output = ()>,
{
    info!("Starting Harness MCP Server");
    info!("Configuration: {:?}", config);

    let server = McpServer::new(config).await?;
    
    tokio::select! {
        result = server.run_stdio() => {
            result?;
        }
        _ = shutdown => {
            info!("Shutting down server...");
        }
    }

    Ok(())
}