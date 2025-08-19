use anyhow::Result;
use clap::{Parser, Subcommand};
use std::io;
use tokio::signal;
use tracing::{info, error};

mod config;
mod harness;
mod modules;
mod toolsets;
mod utils;

use config::Config;
use harness::server::HarnessServer;

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "A Harness MCP server that handles various tools and resources")]
#[command(version = env!("CARGO_PKG_VERSION"))]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Comma-separated list of tool groups to enable
    #[arg(long, value_delimiter = ',')]
    toolsets: Option<Vec<String>>,

    /// Comma-separated list of modules to enable
    #[arg(long, value_delimiter = ',')]
    enable_modules: Option<Vec<String>>,

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

        // Add other internal service URLs and secrets as needed
        #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
        pipeline_svc_base_url: Option<String>,

        #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
        pipeline_svc_secret: Option<String>,

        #[arg(long, env = "HARNESS_NG_MANAGER_BASE_URL")]
        ng_manager_base_url: Option<String>,

        #[arg(long, env = "HARNESS_NG_MANAGER_SECRET")]
        ng_manager_secret: Option<String>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    init_logging(cli.log_file.as_deref(), cli.debug)?;

    match cli.command {
        Commands::Stdio {
            base_url,
            api_key,
            default_org_id,
            default_project_id,
        } => {
            let account_id = extract_account_id_from_api_key(&api_key)?;
            
            let config = Config {
                version: env!("CARGO_PKG_VERSION").to_string(),
                base_url,
                account_id,
                default_org_id,
                default_project_id,
                api_key,
                read_only: cli.read_only,
                toolsets: cli.toolsets.unwrap_or_default(),
                enable_modules: cli.enable_modules.unwrap_or_default(),
                enable_license: cli.enable_license,
                debug: cli.debug,
                internal: false,
                ..Default::default()
            };

            run_stdio_server(config).await
        }
        Commands::Internal {
            bearer_token,
            mcp_svc_secret,
            pipeline_svc_base_url,
            pipeline_svc_secret,
            ng_manager_base_url,
            ng_manager_secret,
        } => {
            // TODO: Implement session authentication for internal mode
            let config = Config {
                version: env!("CARGO_PKG_VERSION").to_string(),
                read_only: true, // Internal mode is read-only for now
                toolsets: cli.toolsets.unwrap_or_default(),
                enable_modules: cli.enable_modules.unwrap_or_default(),
                enable_license: cli.enable_license,
                debug: cli.debug,
                internal: true,
                bearer_token: Some(bearer_token),
                mcp_svc_secret: Some(mcp_svc_secret),
                pipeline_svc_base_url,
                pipeline_svc_secret,
                ng_manager_base_url,
                ng_manager_secret,
                ..Default::default()
            };

            run_stdio_server(config).await
        }
    }
}

fn init_logging(log_file: Option<&str>, debug: bool) -> Result<()> {
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

    let filter = if debug {
        EnvFilter::new("debug")
    } else {
        EnvFilter::new("info")
    };

    if let Some(log_file) = log_file {
        let file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .append(true)
            .open(log_file)?;

        tracing_subscriber::registry()
            .with(filter)
            .with(tracing_subscriber::fmt::layer().with_writer(file))
            .init();
    } else {
        tracing_subscriber::registry()
            .with(filter)
            .with(tracing_subscriber::fmt::layer())
            .init();
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
    info!("Starting Harness MCP Server on stdio");
    info!("Version: {}", config.version);
    info!("Base URL: {}", config.base_url);

    // Create the Harness server
    let server = HarnessServer::new(config).await?;

    // Set up signal handling for graceful shutdown
    let shutdown = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C signal handler");
        info!("Shutdown signal received");
    };

    // Run the server
    tokio::select! {
        result = server.run_stdio(io::stdin(), io::stdout()) => {
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