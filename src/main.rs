use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::{info, Level};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod error;
mod server;
mod auth;
mod tools;
mod modules;
mod types;
mod utils;

use crate::config::Config;
use crate::server::{run_http_server, run_stdio_server};
use crate::types::TransportType;

/// Harness MCP Server - Rust implementation
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
    #[arg(long, global = true)]
    log_file: Option<PathBuf>,

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
    output_dir: Option<PathBuf>,
}

#[derive(Subcommand)]
enum Commands {
    /// Start HTTP server
    HttpServer {
        /// HTTP server port
        #[arg(long, default_value = "8080")]
        http_port: u16,

        /// HTTP server path
        #[arg(long, default_value = "/mcp")]
        http_path: String,

        // Internal service configurations
        #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
        pipeline_svc_base_url: Option<String>,

        #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
        pipeline_svc_secret: Option<String>,

        #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
        mcp_svc_secret: Option<String>,

        #[arg(long, env = "HARNESS_NG_MANAGER_BASE_URL")]
        ng_manager_base_url: Option<String>,

        #[arg(long, env = "HARNESS_NG_MANAGER_SECRET")]
        ng_manager_secret: Option<String>,
    },

    /// Start stdio server
    Stdio {
        /// Base URL for Harness
        #[arg(long, default_value = "https://app.harness.io", env = "HARNESS_BASE_URL")]
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

        // Internal service configurations
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

fn init_tracing(debug: bool, log_file: Option<PathBuf>) -> Result<()> {
    let level = if debug { Level::DEBUG } else { Level::INFO };

    let subscriber = tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env().add_directive(level.into()));

    if let Some(log_file) = log_file {
        let file_appender = tracing_appender::rolling::daily(
            log_file.parent().unwrap_or_else(|| std::path::Path::new(".")),
            log_file.file_name().unwrap_or_else(|| std::ffi::OsStr::new("harness-mcp.log")),
        );
        let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
        subscriber
            .with(tracing_subscriber::fmt::layer().with_writer(non_blocking))
            .init();
    } else {
        subscriber
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

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables from .env file if present
    let _ = dotenvy::dotenv();

    let cli = Cli::parse();

    // Initialize tracing
    init_tracing(cli.debug, cli.log_file)?;

    info!("Starting Harness MCP Server");

    let result = match cli.command {
        Commands::HttpServer {
            http_port,
            http_path,
            pipeline_svc_base_url,
            pipeline_svc_secret,
            mcp_svc_secret,
            ng_manager_base_url,
            ng_manager_secret,
        } => {
            let config = Config {
                version: env!("CARGO_PKG_VERSION").to_string(),
                transport: TransportType::Http,
                http_port,
                http_path,
                read_only: cli.read_only,
                toolsets: cli.toolsets.unwrap_or_else(|| vec!["default".to_string()]),
                enable_modules: cli.enable_modules.unwrap_or_default(),
                enable_license: cli.enable_license,
                output_dir: cli.output_dir,
                internal: true,
                
                // Internal service configurations
                pipeline_svc_base_url,
                pipeline_svc_secret,
                mcp_svc_secret,
                ng_manager_base_url,
                ng_manager_secret,
                
                // External mode fields (not used in HTTP mode)
                base_url: None,
                account_id: None,
                default_org_id: None,
                default_project_id: None,
                api_key: None,
                bearer_token: None,
            };

            run_http_server(config).await
        }

        Commands::Stdio {
            base_url,
            api_key,
            default_org_id,
            default_project_id,
        } => {
            let account_id = extract_account_id_from_api_key(&api_key)?;

            let config = Config {
                version: env!("CARGO_PKG_VERSION").to_string(),
                transport: TransportType::Stdio,
                http_port: 0,
                http_path: String::new(),
                read_only: cli.read_only,
                toolsets: cli.toolsets.unwrap_or_else(|| vec!["default".to_string()]),
                enable_modules: cli.enable_modules.unwrap_or_default(),
                enable_license: cli.enable_license,
                output_dir: cli.output_dir,
                internal: false,
                
                // External mode configurations
                base_url: Some(base_url),
                account_id: Some(account_id),
                default_org_id,
                default_project_id,
                api_key: Some(api_key),
                
                // Internal service fields (not used in stdio mode)
                bearer_token: None,
                pipeline_svc_base_url: None,
                pipeline_svc_secret: None,
                mcp_svc_secret: None,
                ng_manager_base_url: None,
                ng_manager_secret: None,
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
            // TODO: Extract account ID from bearer token
            let config = Config {
                version: env!("CARGO_PKG_VERSION").to_string(),
                transport: TransportType::Stdio,
                http_port: 0,
                http_path: String::new(),
                read_only: true, // Internal mode is read-only for now
                toolsets: cli.toolsets.unwrap_or_else(|| vec!["all".to_string()]),
                enable_modules: cli.enable_modules.unwrap_or_else(|| vec!["all".to_string()]),
                enable_license: cli.enable_license,
                output_dir: cli.output_dir,
                internal: true,
                
                // Internal mode configurations
                bearer_token: Some(bearer_token),
                mcp_svc_secret: Some(mcp_svc_secret),
                pipeline_svc_base_url,
                pipeline_svc_secret,
                ng_manager_base_url,
                ng_manager_secret,
                
                // External mode fields (not used in internal mode)
                base_url: None,
                account_id: None, // TODO: Extract from bearer token
                default_org_id: None,
                default_project_id: None,
                api_key: None,
            };

            run_stdio_server(config).await
        }
    };

    result.map_err(|e| anyhow::anyhow!(e))
}