use anyhow::Result;
use clap::{Parser, Subcommand};
use harness_config::Config;
use harness_core::server::Server;
use signal_hook::consts::SIGTERM;
use signal_hook_tokio::{Signals, SignalsInfo};
use std::io;
use tokio::signal;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// Harness MCP Server
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

    /// Comma-separated list of tool groups to enable
    #[arg(long, global = true, value_delimiter = ',')]
    toolsets: Option<Vec<String>>,

    /// Enable license validation
    #[arg(long, global = true)]
    enable_license: bool,

    /// Comma-separated list of modules to enable
    #[arg(long, global = true, value_delimiter = ',')]
    enable_modules: Option<Vec<String>>,

    /// Run the server in read-only mode
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

        /// Secret for MCP service
        #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
        mcp_svc_secret: String,

        /// Base URL for pipeline service
        #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
        pipeline_svc_base_url: Option<String>,

        /// Secret for pipeline service
        #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
        pipeline_svc_secret: Option<String>,

        /// Base URL for NG manager
        #[arg(long, env = "HARNESS_NG_MANAGER_BASE_URL")]
        ng_manager_base_url: Option<String>,

        /// Secret for NG manager
        #[arg(long, env = "HARNESS_NG_MANAGER_SECRET")]
        ng_manager_secret: Option<String>,

        // Additional service configurations can be added here
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    init_logging(cli.debug, cli.log_file.as_deref())?;

    // Extract account ID from API key if in stdio mode
    let account_id = match &cli.command {
        Commands::Stdio { api_key, .. } => extract_account_id_from_api_key(api_key)?,
        Commands::Internal { .. } => {
            // For internal mode, account ID will be extracted from bearer token
            String::new()
        }
    };

    // Build configuration
    let config = build_config(&cli, &account_id)?;

    info!("Starting Harness MCP Server v{}", env!("CARGO_PKG_VERSION"));
    info!("Configuration: base_url={}", config.base_url);

    // Setup signal handling
    let mut signals = Signals::new(&[SIGTERM])?;
    let signals_handle = signals.handle();

    // Create and start the server
    let server = Server::new(config).await?;

    // Run the server with graceful shutdown
    tokio::select! {
        result = server.run() => {
            if let Err(e) = result {
                error!("Server error: {}", e);
                return Err(e);
            }
        }
        _ = signal::ctrl_c() => {
            info!("Received Ctrl+C, shutting down...");
        }
        _ = handle_signals(&mut signals) => {
            info!("Received termination signal, shutting down...");
        }
    }

    // Cleanup
    signals_handle.close();
    info!("Server shutdown complete");
    Ok(())
}

/// Initialize logging based on configuration
fn init_logging(debug: bool, log_file: Option<&str>) -> Result<()> {
    let env_filter = if debug {
        "debug"
    } else {
        "info"
    };

    let subscriber = tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(env_filter));

    match log_file {
        Some(path) => {
            let file = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)?;
            
            let file_layer = tracing_subscriber::fmt::layer()
                .with_writer(file)
                .with_ansi(false);
            
            subscriber.with(file_layer).init();
        }
        None => {
            let stdout_layer = tracing_subscriber::fmt::layer()
                .with_writer(io::stderr);
            
            subscriber.with(stdout_layer).init();
        }
    }

    Ok(())
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

/// Build configuration from CLI arguments
fn build_config(cli: &Cli, account_id: &str) -> Result<Config> {
    let mut config = Config::default();

    // Set common configuration
    config.debug = cli.debug;
    config.log_file_path = cli.log_file.clone();
    config.toolsets = cli.toolsets.clone().unwrap_or_default();
    config.enable_license = cli.enable_license;
    config.enable_modules = cli.enable_modules.clone().unwrap_or_default();
    config.read_only = cli.read_only;
    config.account_id = account_id.to_string();

    // Set command-specific configuration
    match &cli.command {
        Commands::Stdio {
            base_url,
            api_key,
            default_org_id,
            default_project_id,
        } => {
            config.base_url = base_url.clone();
            config.api_key = Some(api_key.clone());
            config.default_org_id = default_org_id.clone();
            config.default_project_id = default_project_id.clone();
            config.internal = false;
        }
        Commands::Internal {
            bearer_token,
            mcp_svc_secret,
            pipeline_svc_base_url,
            pipeline_svc_secret,
            ng_manager_base_url,
            ng_manager_secret,
        } => {
            config.bearer_token = Some(bearer_token.clone());
            config.mcp_svc_secret = Some(mcp_svc_secret.clone());
            config.pipeline_svc_base_url = pipeline_svc_base_url.clone();
            config.pipeline_svc_secret = pipeline_svc_secret.clone();
            config.ng_manager_base_url = ng_manager_base_url.clone();
            config.ng_manager_secret = ng_manager_secret.clone();
            config.internal = true;
            config.read_only = true; // Internal mode is read-only for now
        }
    }

    Ok(config)
}

/// Handle system signals
async fn handle_signals(signals: &mut SignalsInfo) {
    while let Some(signal) = signals.next().await {
        match signal {
            SIGTERM => {
                info!("Received SIGTERM");
                break;
            }
            _ => {}
        }
    }
}