use anyhow::Result;
use clap::{Parser, Subcommand};
use harness_mcp::{VERSION, COMMIT, BUILD_DATE};
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server")]
#[command(version = format!("Version: {}\nCommit: {}\nBuild Date: {}", VERSION, COMMIT, BUILD_DATE))]
struct Cli {
    #[command(subcommand)]
    command: Commands,
    
    /// Enable debug logging
    #[arg(long, global = true)]
    debug: bool,
    
    /// Log file path
    #[arg(long, global = true)]
    log_file: Option<String>,
    
    /// Restrict to read-only operations
    #[arg(long, global = true)]
    read_only: bool,
    
    /// Comma separated list of toolsets to enable
    #[arg(long, global = true, value_delimiter = ',')]
    toolsets: Vec<String>,
    
    /// Comma separated list of modules to enable
    #[arg(long, global = true, value_delimiter = ',')]
    enable_modules: Vec<String>,
    
    /// Enable license validation
    #[arg(long, global = true)]
    enable_license: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Start MCP as a standalone server with HTTP transport
    HttpServer {
        /// HTTP server port
        #[arg(long, default_value = "8080")]
        http_port: u16,
        
        /// HTTP server path
        #[arg(long, default_value = "/mcp")]
        http_path: String,
    },
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
        
        // Add other internal service configuration as needed
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    // Initialize tracing
    init_tracing(cli.debug, cli.log_file.as_deref())?;
    
    info!("Starting Harness MCP Server");
    info!("Version: {}, Commit: {}, Build Date: {}", VERSION, COMMIT, BUILD_DATE);
    
    match cli.command {
        Commands::HttpServer { http_port, http_path } => {
            info!("Starting HTTP server on port {} at path {}", http_port, http_path);
            run_http_server(http_port, http_path, &cli).await
        }
        Commands::Stdio { 
            base_url, 
            api_key, 
            default_org_id, 
            default_project_id 
        } => {
            info!("Starting stdio server");
            run_stdio_server(base_url, api_key, default_org_id, default_project_id, &cli).await
        }
        Commands::Internal { 
            bearer_token, 
            mcp_svc_secret 
        } => {
            info!("Starting internal stdio server");
            run_internal_server(bearer_token, mcp_svc_secret, &cli).await
        }
    }
}

fn init_tracing(debug: bool, log_file: Option<&str>) -> Result<()> {
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
        
        let file_layer = tracing_subscriber::fmt::layer()
            .with_writer(file)
            .with_ansi(false);
            
        subscriber.with(file_layer).init();
    } else {
        let stdout_layer = tracing_subscriber::fmt::layer()
            .with_writer(std::io::stdout);
            
        subscriber.with(stdout_layer).init();
    }
    
    Ok(())
}

async fn run_http_server(port: u16, path: String, _cli: &Cli) -> Result<()> {
    // TODO: Implement HTTP server
    error!("HTTP server not yet implemented");
    Ok(())
}

async fn run_stdio_server(
    _base_url: String,
    _api_key: String,
    _default_org_id: Option<String>,
    _default_project_id: Option<String>,
    _cli: &Cli,
) -> Result<()> {
    // TODO: Implement stdio server
    error!("Stdio server not yet implemented");
    Ok(())
}

async fn run_internal_server(
    _bearer_token: String,
    _mcp_svc_secret: String,
    _cli: &Cli,
) -> Result<()> {
    // TODO: Implement internal server
    error!("Internal server not yet implemented");
    Ok(())
}