use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing::{info, warn};

mod config;
mod server;
mod tools;
mod client;
mod dto;
mod auth;
mod error;
mod mcp;

use config::Config;
use server::{http_server, stdio_server};

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - A Model Context Protocol server for Harness APIs")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
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
        
        /// Comma-separated list of toolsets to enable
        #[arg(long, env = "HARNESS_TOOLSETS", default_value = "all")]
        toolsets: String,
        
        /// Run in read-only mode
        #[arg(long, env = "HARNESS_READ_ONLY")]
        read_only: bool,
        
        /// Path to log file
        #[arg(long, env = "HARNESS_LOG_FILE")]
        log_file: Option<String>,
        
        /// Enable debug logging
        #[arg(long, env = "HARNESS_DEBUG")]
        debug: bool,
        
        /// Directory where the tool writes output files
        #[arg(long, env = "HARNESS_OUTPUT_DIR")]
        output_dir: Option<String>,
    },
    
    /// Start HTTP server
    HttpServer {
        /// HTTP server port
        #[arg(long, default_value = "8080")]
        port: u16,
        
        /// HTTP server path
        #[arg(long, default_value = "/mcp")]
        path: String,
        
        /// Enable internal mode
        #[arg(long)]
        internal: bool,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    match cli.command {
        Commands::Stdio {
            base_url,
            api_key,
            default_org_id,
            default_project_id,
            toolsets,
            read_only,
            log_file,
            debug,
            output_dir,
        } => {
            // Initialize logging
            init_logging(log_file.as_deref(), debug)?;
            
            // Extract account ID from API key
            let account_id = extract_account_id_from_api_key(&api_key)?;
            
            let config = Config {
                version: env!("CARGO_PKG_VERSION").to_string(),
                base_url,
                account_id,
                default_org_id,
                default_project_id,
                api_key,
                read_only,
                toolsets: parse_toolsets(&toolsets),
                debug,
                output_dir,
                ..Default::default()
            };
            
            info!("Starting Harness MCP Server on stdio");
            stdio_server::run(config).await
        }
        
        Commands::HttpServer { port, path, internal } => {
            // Initialize logging
            init_logging(None, false)?;
            
            let config = Config {
                version: env!("CARGO_PKG_VERSION").to_string(),
                http_port: port,
                http_path: path,
                internal,
                ..Default::default()
            };
            
            info!("Starting Harness MCP Server on HTTP port {}", port);
            http_server::run(config).await
        }
    }
}

fn init_logging(log_file: Option<&str>, debug: bool) -> Result<()> {
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
    
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
            .append(true)
            .open(log_file)?;
        
        subscriber
            .with(tracing_subscriber::fmt::layer().with_writer(file))
            .init();
    } else {
        subscriber
            .with(tracing_subscriber::fmt::layer())
            .init();
    }
    
    Ok(())
}

fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    // API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        anyhow::bail!("Invalid API key format");
    }
    Ok(parts[1].to_string())
}

fn parse_toolsets(toolsets: &str) -> Vec<String> {
    if toolsets == "all" {
        vec!["all".to_string()]
    } else {
        toolsets
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    }
}