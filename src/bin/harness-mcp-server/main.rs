//! Harness MCP Server Binary
//! 
//! Main entry point for the Harness Model Context Protocol server.

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use harness_mcp_server::{config::Config, prelude::*};
use std::io::{self, BufRead, BufReader, Write};
use tokio::signal;
use tracing::{info, Level};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Harness MCP Server
#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "A Harness MCP server that handles various tools and resources")]
#[command(version = harness_mcp_server::VERSION)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Comma-separated list of tool groups to enable
    #[arg(long, value_delimiter = ',')]
    toolsets: Option<Vec<String>>,

    /// Enable license validation and module-based toolset management
    #[arg(long)]
    enable_license: bool,

    /// Comma-separated list of modules to enable
    #[arg(long, value_delimiter = ',')]
    enable_modules: Option<Vec<String>>,

    /// Run the server in read-only mode
    #[arg(long)]
    read_only: bool,

    /// Path to log file for debugging
    #[arg(long)]
    log_file: Option<String>,

    /// Set the logging level
    #[arg(long, default_value = "info")]
    log_level: String,

    /// Base URL for Harness
    #[arg(long, default_value = "https://app.harness.io")]
    base_url: String,
}

#[derive(Subcommand)]
enum Commands {
    /// Start stdio server
    Stdio {
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

        // Additional internal service configurations would go here
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    init_logging(&cli.log_level, cli.log_file.as_deref())?;

    // Extract account ID from API key if needed
    let account_id = match &cli.command {
        Commands::Stdio { api_key, .. } => extract_account_id_from_api_key(api_key)?,
        Commands::Internal { .. } => {
            // For internal mode, account ID would come from session authentication
            String::new()
        }
    };

    // Build configuration
    let config = Config {
        version: harness_mcp_server::VERSION.to_string(),
        base_url: cli.base_url,
        account_id,
        default_org_id: match &cli.command {
            Commands::Stdio { default_org_id, .. } => default_org_id.clone(),
            Commands::Internal { .. } => None,
        },
        default_project_id: match &cli.command {
            Commands::Stdio { default_project_id, .. } => default_project_id.clone(),
            Commands::Internal { .. } => None,
        },
        api_key: match &cli.command {
            Commands::Stdio { api_key, .. } => Some(api_key.clone()),
            Commands::Internal { .. } => None,
        },
        bearer_token: match &cli.command {
            Commands::Internal { bearer_token, .. } => Some(bearer_token.clone()),
            Commands::Stdio { .. } => None,
        },
        read_only: cli.read_only,
        toolsets: cli.toolsets.unwrap_or_default(),
        enable_license: cli.enable_license,
        enable_modules: cli.enable_modules.unwrap_or_default(),
        internal: matches!(cli.command, Commands::Internal { .. }),
    };

    // Run the appropriate server mode
    match cli.command {
        Commands::Stdio { .. } => run_stdio_server(config).await,
        Commands::Internal { .. } => run_internal_server(config).await,
    }
}

/// Initialize logging based on configuration
fn init_logging(level: &str, log_file: Option<&str>) -> Result<()> {
    let level = match level.to_lowercase().as_str() {
        "trace" => Level::TRACE,
        "debug" => Level::DEBUG,
        "info" => Level::INFO,
        "warn" => Level::WARN,
        "error" => Level::ERROR,
        _ => Level::INFO,
    };

    let filter = EnvFilter::from_default_env()
        .add_directive(level.into())
        .add_directive("harness_mcp_server=debug".parse()?);

    let subscriber = tracing_subscriber::registry().with(filter);

    if let Some(log_file) = log_file {
        let file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_file)
            .context("Failed to open log file")?;
        
        subscriber
            .with(fmt::layer().with_writer(file))
            .init();
    } else {
        subscriber
            .with(fmt::layer().with_writer(std::io::stderr))
            .init();
    }

    Ok(())
}

/// Extract account ID from Harness API key
/// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        anyhow::bail!("Invalid API key format");
    }
    Ok(parts[1].to_string())
}

/// Run the stdio server
async fn run_stdio_server(config: Config) -> Result<()> {
    info!("Starting Harness MCP Server on stdio");
    info!("Version: {}", config.version);
    info!("Base URL: {}", config.base_url);

    // TODO: Initialize MCP server and toolsets
    // TODO: Set up stdio communication
    // TODO: Handle graceful shutdown

    // For now, just wait for shutdown signal
    signal::ctrl_c().await.context("Failed to listen for ctrl+c")?;
    info!("Shutting down server...");

    Ok(())
}

/// Run the internal server
async fn run_internal_server(config: Config) -> Result<()> {
    info!("Starting Harness MCP Server in internal mode");
    info!("Version: {}", config.version);

    // TODO: Authenticate session using bearer token
    // TODO: Initialize internal toolsets
    // TODO: Set up stdio communication with internal credentials

    // For now, just wait for shutdown signal
    signal::ctrl_c().await.context("Failed to listen for ctrl+c")?;
    info!("Shutting down internal server...");

    Ok(())
}