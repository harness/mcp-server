use anyhow::Result;
use clap::{Parser, Subcommand};
use std::process;
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
use types::{LogFormatType, TransportType};

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

    /// Path to log file
    #[arg(long, global = true, default_value = "harness-mcp.log")]
    log_file: String,

    /// Log format (text or json)
    #[arg(long, global = true, default_value = "text")]
    log_format: String,

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

    /// Directory where the tool writes output files
    #[arg(long, global = true)]
    output_dir: Option<String>,

    /// API key for authentication
    #[arg(long, global = true, env = "HARNESS_API_KEY")]
    api_key: Option<String>,

    /// Base URL for Harness
    #[arg(long, global = true, env = "HARNESS_BASE_URL", default_value = "https://app.harness.io")]
    base_url: String,
}

#[derive(Subcommand)]
enum Commands {
    /// Start stdio server
    Stdio {
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

        /// Metrics server port
        #[arg(long, default_value = "8889")]
        metrics_port: u16,
    },
    /// Start stdio server in internal mode
    Internal {
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: Option<String>,
    },
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    // Build configuration first
    let config = match build_config(&cli).await {
        Ok(config) => config,
        Err(e) => {
            eprintln!("Failed to build configuration: {}", e);
            process::exit(1);
        }
    };

    // Initialize logging
    if let Err(e) = init_logging(&cli, &config) {
        eprintln!("Failed to initialize logging: {}", e);
        process::exit(1);
    }


    // Run the appropriate server mode
    let result = match cli.command {
        Commands::Stdio { default_org_id, default_project_id } => {
            run_stdio_server(config, default_org_id, default_project_id).await
        }
        Commands::HttpServer { http_port, http_path, metrics_port } => {
            run_http_server(config, http_port, http_path, metrics_port).await
        }
        Commands::Internal { bearer_token } => {
            run_internal_server(config, bearer_token).await
        }
    };

    if let Err(e) = result {
        error!("Server error: {}", e);
        process::exit(1);
    }
}

fn init_logging(cli: &Cli, config: &Config) -> Result<()> {
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

    let level = if cli.debug {
        tracing::Level::DEBUG
    } else {
        tracing::Level::INFO
    };

    let subscriber = tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env().add_directive(level.into()));

    match config.log_format {
        LogFormatType::Json => {
            subscriber
                .with(tracing_subscriber::fmt::layer().json())
                .init();
        }
        LogFormatType::Text => {
            subscriber
                .with(tracing_subscriber::fmt::layer())
                .init();
        }
    }

    Ok(())
}

async fn build_config(cli: &Cli) -> Result<Config> {
    let mut config = Config::default();
    
    config.debug = cli.debug;
    config.log_file_path = cli.log_file.clone();
    config.log_format = LogFormatType::from(cli.log_format.as_str());
    config.toolsets = cli.toolsets.clone().unwrap_or_else(|| vec!["default".to_string()]);
    config.enable_license = cli.enable_license;
    config.enable_modules = cli.enable_modules.clone().unwrap_or_default();
    config.read_only = cli.read_only;
    config.output_dir = cli.output_dir.clone();
    config.api_key = cli.api_key.clone();
    config.base_url = cli.base_url.clone();

    // Extract account ID from API key if provided
    if let Some(ref api_key) = config.api_key {
        config.account_id = extract_account_id_from_api_key(api_key)?;
    }

    Ok(config)
}

fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        anyhow::bail!("Invalid API key format");
    }
    Ok(parts[1].to_string())
}

async fn run_stdio_server(
    config: Config,
    default_org_id: Option<String>,
    default_project_id: Option<String>,
) -> Result<()> {
    info!("Starting stdio server");
    
    if config.api_key.is_none() {
        anyhow::bail!("API key not provided");
    }

    let mut server_config = config;
    server_config.default_org_id = default_org_id;
    server_config.default_project_id = default_project_id;

    let server = HarnessServer::new(server_config).await?;
    server.run_stdio().await
}

async fn run_http_server(
    config: Config,
    http_port: u16,
    http_path: String,
    metrics_port: u16,
) -> Result<()> {
    info!("Starting HTTP server on port {}", http_port);
    
    let mut server_config = config;
    server_config.http_port = http_port;
    server_config.http_path = http_path;
    server_config.metrics_port = metrics_port;

    let server = HarnessServer::new(server_config).await?;
    server.run_http().await
}

async fn run_internal_server(
    config: Config,
    bearer_token: Option<String>,
) -> Result<()> {
    info!("Starting internal server");
    
    if bearer_token.is_none() {
        anyhow::bail!("Bearer token not provided");
    }

    let mut server_config = config;
    server_config.bearer_token = bearer_token;
    server_config.internal = true;
    server_config.read_only = true; // Internal mode is read-only for now

    let server = HarnessServer::new(server_config).await?;
    server.run_stdio().await
}