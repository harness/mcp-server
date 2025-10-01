use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing::{info, warn};

mod auth;
mod client;
mod config;
mod error;
mod mcp;
mod middleware;
mod server;
mod tools;
mod transport;

use config::Config;
use server::HarnessServer;

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP (Model Context Protocol) Server")]
#[command(version = env!("CARGO_PKG_VERSION"))]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run MCP server in stdio mode (standard MCP transport)
    Stdio {
        /// Harness API key for authentication
        #[arg(long, env = "HARNESS_API_KEY")]
        api_key: Option<String>,
        
        /// Harness account ID
        #[arg(long, env = "HARNESS_ACCOUNT_ID")]
        account_id: Option<String>,
        
        /// Harness base URL
        #[arg(long, env = "HARNESS_BASE_URL", default_value = "https://app.harness.io")]
        base_url: String,
        
        /// Enable debug logging
        #[arg(long, env = "HARNESS_DEBUG")]
        debug: bool,
        
        /// Enable read-only mode
        #[arg(long, env = "HARNESS_READ_ONLY")]
        read_only: bool,
        
        /// Comma-separated list of toolsets to enable
        #[arg(long, env = "HARNESS_TOOLSETS", default_value = "default")]
        toolsets: String,
        
        /// Comma-separated list of modules to enable
        #[arg(long, env = "HARNESS_ENABLE_MODULES", default_value = "core")]
        enable_modules: String,
    },
    
    /// Run MCP server in HTTP mode
    HttpServer {
        /// HTTP server port
        #[arg(long, env = "MCP_HTTP_PORT", default_value = "8080")]
        port: u16,
        
        /// HTTP endpoint path
        #[arg(long, env = "MCP_HTTP_PATH", default_value = "/mcp")]
        path: String,
        
        /// Harness API key for authentication
        #[arg(long, env = "HARNESS_API_KEY")]
        api_key: Option<String>,
        
        /// Harness account ID
        #[arg(long, env = "HARNESS_ACCOUNT_ID")]
        account_id: Option<String>,
        
        /// Harness base URL
        #[arg(long, env = "HARNESS_BASE_URL", default_value = "https://app.harness.io")]
        base_url: String,
        
        /// Enable debug logging
        #[arg(long, env = "HARNESS_DEBUG")]
        debug: bool,
        
        /// Enable read-only mode
        #[arg(long, env = "HARNESS_READ_ONLY")]
        read_only: bool,
        
        /// Comma-separated list of toolsets to enable
        #[arg(long, env = "HARNESS_TOOLSETS", default_value = "default")]
        toolsets: String,
        
        /// Comma-separated list of modules to enable
        #[arg(long, env = "HARNESS_ENABLE_MODULES", default_value = "core")]
        enable_modules: String,
    },
    
    /// Run MCP server in internal mode (for Harness internal services)
    Internal {
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: Option<String>,
        
        /// MCP service secret
        #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
        mcp_svc_secret: Option<String>,
        
        /// HTTP server port
        #[arg(long, env = "MCP_HTTP_PORT", default_value = "8080")]
        port: u16,
        
        /// HTTP endpoint path
        #[arg(long, env = "MCP_HTTP_PATH", default_value = "/mcp")]
        path: String,
        
        /// Enable debug logging
        #[arg(long, env = "HARNESS_DEBUG")]
        debug: bool,
        
        /// Enable read-only mode
        #[arg(long, env = "HARNESS_READ_ONLY")]
        read_only: bool,
        
        /// Comma-separated list of toolsets to enable
        #[arg(long, env = "HARNESS_TOOLSETS", default_value = "default")]
        toolsets: String,
        
        /// Comma-separated list of modules to enable
        #[arg(long, env = "HARNESS_ENABLE_MODULES", default_value = "core")]
        enable_modules: String,
        
        // Service URLs and secrets for internal mode
        #[arg(long, env = "HARNESS_PIPELINE_SERVICE_BASE_URL")]
        pipeline_service_base_url: Option<String>,
        
        #[arg(long, env = "HARNESS_PIPELINE_SERVICE_SECRET")]
        pipeline_service_secret: Option<String>,
        
        #[arg(long, env = "HARNESS_NG_MANAGER_BASE_URL")]
        ng_manager_base_url: Option<String>,
        
        #[arg(long, env = "HARNESS_NG_MANAGER_SECRET")]
        ng_manager_secret: Option<String>,
        
        // Add more service configurations as needed...
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    // Initialize tracing based on debug flag
    let debug = match &cli.command {
        Commands::Stdio { debug, .. } => *debug,
        Commands::HttpServer { debug, .. } => *debug,
        Commands::Internal { debug, .. } => *debug,
    };
    
    init_tracing(debug)?;
    
    info!("Starting Harness MCP Server v{}", env!("CARGO_PKG_VERSION"));
    
    match cli.command {
        Commands::Stdio {
            api_key,
            account_id,
            base_url,
            debug,
            read_only,
            toolsets,
            enable_modules,
        } => {
            let config = Config::new_stdio(
                api_key,
                account_id,
                base_url,
                debug,
                read_only,
                toolsets,
                enable_modules,
            )?;
            
            let server = HarnessServer::new(config).await?;
            server.run_stdio().await?;
        }
        
        Commands::HttpServer {
            port,
            path,
            api_key,
            account_id,
            base_url,
            debug,
            read_only,
            toolsets,
            enable_modules,
        } => {
            let config = Config::new_http(
                port,
                path,
                api_key,
                account_id,
                base_url,
                debug,
                read_only,
                toolsets,
                enable_modules,
            )?;
            
            let server = HarnessServer::new(config).await?;
            server.run_http().await?;
        }
        
        Commands::Internal {
            bearer_token,
            mcp_svc_secret,
            port,
            path,
            debug,
            read_only,
            toolsets,
            enable_modules,
            pipeline_service_base_url,
            pipeline_service_secret,
            ng_manager_base_url,
            ng_manager_secret,
        } => {
            let config = Config::new_internal(
                bearer_token,
                mcp_svc_secret,
                port,
                path,
                debug,
                read_only,
                toolsets,
                enable_modules,
                pipeline_service_base_url,
                pipeline_service_secret,
                ng_manager_base_url,
                ng_manager_secret,
            )?;
            
            let server = HarnessServer::new(config).await?;
            server.run_http().await?;
        }
    }
    
    Ok(())
}

fn init_tracing(debug: bool) -> Result<()> {
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
    
    let filter = if debug {
        EnvFilter::new("debug")
    } else {
        EnvFilter::new("info")
    };
    
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().with_target(false))
        .init();
    
    Ok(())
}