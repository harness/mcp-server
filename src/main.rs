use anyhow::Result;
use clap::{Parser, Subcommand};
use std::io;
use tokio::signal;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod harness;
mod modules;
mod toolsets;
mod utils;

use config::Config;
use harness::server::HarnessServer;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "A Harness MCP server that handles various tools and resources")]
#[command(version = VERSION)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Comma-separated list of tool groups to enable
    #[arg(long, value_delimiter = ',', default_values_t = vec!["default".to_string()])]
    toolsets: Vec<String>,

    /// Comma-separated list of modules to enable
    #[arg(long, value_delimiter = ',')]
    enable_modules: Vec<String>,

    /// Enable license validation
    #[arg(long)]
    enable_license: bool,

    /// Restrict the server to read-only operations
    #[arg(long)]
    read_only: bool,

    /// Path to log file
    #[arg(long)]
    log_file: Option<String>,

    /// Enable debug logging
    #[arg(long)]
    debug: bool,
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

        /// Default org ID to use
        #[arg(long, env = "HARNESS_DEFAULT_ORG_ID")]
        default_org_id: Option<String>,

        /// Default project ID to use
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
        // Following the same pattern as the Go version
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    init_logging(cli.log_file.as_deref(), cli.debug)?;

    info!("Starting Harness MCP Server v{}", VERSION);

    match cli.command {
        Commands::Stdio {
            base_url,
            api_key,
            default_org_id,
            default_project_id,
        } => {
            let account_id = extract_account_id_from_api_key(&api_key)?;
            
            let config = Config {
                version: VERSION.to_string(),
                base_url,
                account_id,
                default_org_id,
                default_project_id,
                api_key,
                read_only: cli.read_only,
                toolsets: cli.toolsets,
                enable_modules: cli.enable_modules,
                enable_license: cli.enable_license,
                debug: cli.debug,
                internal: false,
                ..Default::default()
            };

            run_stdio_server(config).await?;
        }
        Commands::Internal {
            bearer_token,
            mcp_svc_secret,
        } => {
            // TODO: Implement session authentication similar to Go version
            let config = Config {
                version: VERSION.to_string(),
                read_only: true, // Keep read-only for now
                toolsets: cli.toolsets,
                enable_modules: cli.enable_modules,
                enable_license: cli.enable_license,
                debug: cli.debug,
                internal: true,
                bearer_token: Some(bearer_token),
                mcp_svc_secret: Some(mcp_svc_secret),
                ..Default::default()
            };

            run_stdio_server(config).await?;
        }
    }

    Ok(())
}

fn init_logging(log_file: Option<&str>, debug: bool) -> Result<()> {
    let filter = if debug {
        "debug"
    } else {
        "info"
    };

    let subscriber = tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(filter));

    if let Some(log_file) = log_file {
        let file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
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
    info!("Starting server with base URL: {}", config.base_url);
    
    // Create the Harness server
    let server = HarnessServer::new(config).await?;
    
    // Setup signal handling for graceful shutdown
    let shutdown = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C signal handler");
        info!("Shutdown signal received");
    };

    // Run the server
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