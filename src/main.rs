use anyhow::Result;
use clap::{Parser, Subcommand};
use std::process;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod harness;
mod modules;
mod toolsets;
mod types;
mod utils;

use config::Config;

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "A Harness MCP server that handles various tools and resources")]
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
    toolsets: Vec<String>,

    /// Comma-separated list of modules to enable
    #[arg(long, global = true, value_delimiter = ',')]
    enable_modules: Vec<String>,

    /// Enable license validation
    #[arg(long, global = true)]
    enable_license: bool,

    /// Restrict the server to read-only operations
    #[arg(long, global = true)]
    read_only: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Start stdio server
    Stdio {
        /// Base URL for Harness
        #[arg(long, env = "HARNESS_BASE_URL", default_value = "https://app.harness.io")]
        base_url: String,

        /// API key for authentication
        #[arg(long, env = "HARNESS_API_KEY")]
        api_key: String,

        /// Default org ID to use
        #[arg(long, env = "HARNESS_DEFAULT_ORG_ID")]
        default_org_id: Option<String>,

        /// Default project ID to use
        #[arg(long, env = "HARNESS_DEFAULT_PROJECT_ID")]
        default_project_id: Option<String>,
    },
    /// Start MCP as a standalone server with HTTP transport
    HttpServer {
        /// HTTP server port
        #[arg(long, default_value = "8080")]
        http_port: u16,

        /// HTTP server path
        #[arg(long, default_value = "/mcp")]
        http_path: String,
    },
    /// Start stdio server in internal mode
    Internal {
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: String,

        /// Secret for MCP service
        #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
        mcp_svc_secret: String,

        // Additional internal service configurations would go here
        // Following the pattern from the Go version
    },
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    // Initialize logging
    init_logging(cli.debug, cli.log_file.as_deref());

    // Build configuration
    let config = match build_config(&cli).await {
        Ok(config) => config,
        Err(e) => {
            error!("Failed to build configuration: {}", e);
            process::exit(1);
        }
    };

    // Run the appropriate command
    if let Err(e) = run_command(cli.command, config).await {
        error!("Application error: {}", e);
        process::exit(1);
    }
}

fn init_logging(debug: bool, log_file: Option<&str>) {
    let filter = if debug {
        "debug"
    } else {
        "info"
    };

    let subscriber = tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(filter));

    if let Some(log_file) = log_file {
        // TODO: Add file logging support
        info!("Log file specified: {}, but file logging not yet implemented", log_file);
    }

    subscriber
        .with(tracing_subscriber::fmt::layer())
        .init();
}

async fn build_config(cli: &Cli) -> Result<Config> {
    // TODO: Implement configuration building logic
    // This would extract account ID from API key, validate settings, etc.
    Ok(Config::default())
}

async fn run_command(command: Commands, config: Config) -> Result<()> {
    match command {
        Commands::Stdio { 
            base_url, 
            api_key, 
            default_org_id, 
            default_project_id 
        } => {
            info!("Starting stdio server");
            info!("Base URL: {}", base_url);
            
            // Extract account ID from API key
            let account_id = extract_account_id_from_api_key(&api_key)?;
            info!("Account ID: {}", account_id);
            
            // TODO: Initialize and run stdio server
            run_stdio_server(config, base_url, api_key, account_id, default_org_id, default_project_id).await
        }
        Commands::HttpServer { http_port, http_path } => {
            info!("Starting HTTP server on port {} at path {}", http_port, http_path);
            // TODO: Initialize and run HTTP server
            run_http_server(config, http_port, http_path).await
        }
        Commands::Internal { bearer_token, mcp_svc_secret } => {
            info!("Starting internal stdio server");
            // TODO: Initialize and run internal server
            run_internal_server(config, bearer_token, mcp_svc_secret).await
        }
    }
}

/// Extract account ID from Harness API key
/// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(anyhow::anyhow!("Invalid API key format"));
    }
    Ok(parts[1].to_string())
}

async fn run_stdio_server(
    _config: Config,
    _base_url: String,
    _api_key: String,
    _account_id: String,
    _default_org_id: Option<String>,
    _default_project_id: Option<String>,
) -> Result<()> {
    // TODO: Implement stdio server
    info!("Stdio server would start here");
    Ok(())
}

async fn run_http_server(
    _config: Config,
    _port: u16,
    _path: String,
) -> Result<()> {
    // TODO: Implement HTTP server
    info!("HTTP server would start here");
    Ok(())
}

async fn run_internal_server(
    _config: Config,
    _bearer_token: String,
    _mcp_svc_secret: String,
) -> Result<()> {
    // TODO: Implement internal server
    info!("Internal server would start here");
    Ok(())
}