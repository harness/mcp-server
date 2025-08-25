use anyhow::Result;
use clap::{Parser, Subcommand};
use harness_mcp_core::{
    config::Config,
    server::McpServer,
    modules::ModuleRegistry,
};
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "A Harness MCP server that handles various tools and resources")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
    
    /// Comma-separated list of tool groups to enable
    #[arg(long, value_delimiter = ',')]
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
    /// Start stdio server for external mode
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
        
        #[command(subcommand)]
        internal: Option<InternalCommands>,
    },
}

#[derive(Subcommand)]
enum InternalCommands {
    /// Start stdio server in internal mode
    Internal {
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: String,
        
        /// Pipeline service base URL
        #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
        pipeline_svc_base_url: Option<String>,
        
        /// Pipeline service secret
        #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
        pipeline_svc_secret: Option<String>,
        
        // Add more internal service configurations as needed
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    // Initialize tracing
    init_tracing(&cli)?;
    
    info!("Starting Harness MCP Server");
    
    match cli.command {
        Commands::Stdio { 
            base_url, 
            api_key, 
            default_org_id, 
            default_project_id, 
            internal 
        } => {
            let config = Config::builder()
                .base_url(base_url)
                .api_key(api_key)
                .default_org_id(default_org_id)
                .default_project_id(default_project_id)
                .toolsets(cli.toolsets)
                .enable_modules(cli.enable_modules)
                .enable_license(cli.enable_license)
                .read_only(cli.read_only)
                .debug(cli.debug)
                .internal_mode(internal.is_some())
                .build()?;
                
            run_stdio_server(config).await?;
        }
    }
    
    Ok(())
}

fn init_tracing(cli: &Cli) -> Result<()> {
    let filter = if cli.debug {
        "debug"
    } else {
        "info"
    };
    
    let subscriber = tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| filter.into())
        )
        .with(tracing_subscriber::fmt::layer());
    
    subscriber.init();
    
    Ok(())
}

async fn run_stdio_server(config: Config) -> Result<()> {
    info!("Starting stdio server with config: {:?}", config);
    
    // Create MCP server
    let mut server = McpServer::new(config.clone()).await?;
    
    // Initialize module registry and register tools
    let module_registry = ModuleRegistry::new(&config).await?;
    module_registry.register_tools(&mut server).await?;
    
    // Set up shutdown signal
    let shutdown = tokio::signal::ctrl_c();
    
    // Run server until shutdown
    tokio::select! {
        result = server.run() => {
            if let Err(e) = result {
                error!("Server error: {}", e);
                return Err(e);
            }
        }
        _ = shutdown => {
            info!("Received shutdown signal, stopping server...");
        }
    }
    
    info!("Server stopped");
    Ok(())
}