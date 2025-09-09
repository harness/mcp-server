use anyhow::Result;
use clap::{Parser, Subcommand};
use harness_mcp_config::Config;
use harness_mcp_core::server::McpServer;
use std::io;
use tokio::signal;
use tracing::{error, info};

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - Rust implementation")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable debug logging
    #[arg(long, global = true)]
    debug: bool,

    /// Log file path
    #[arg(long, global = true)]
    log_file: Option<String>,

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

    /// Configuration file path
    #[arg(long, short = 'c', global = true)]
    config: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// Start stdio server
    Stdio {
        /// Base URL for Harness API
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
    },
    /// Start HTTP server
    HttpServer {
        /// HTTP server port
        #[arg(long, default_value = "8080")]
        port: u16,

        /// HTTP server path
        #[arg(long, default_value = "/mcp")]
        path: String,
    },
    /// Start internal mode server
    Internal {
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: String,

        /// MCP service secret
        #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
        mcp_svc_secret: String,
        // Additional internal service configurations would go here
        // Following the pattern from the Go implementation
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize tracing
    init_tracing(cli.debug, cli.log_file.as_deref())?;

    info!("Starting Harness MCP Server (Rust)");

    // Build configuration from CLI args
    let config = build_config(&cli)?;

    // Handle shutdown gracefully
    let shutdown = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C signal handler");
        info!("Shutdown signal received");
    };

    // Run the appropriate server based on command
    match cli.command {
        Commands::Stdio {
            base_url,
            api_key,
            default_org_id,
            default_project_id,
        } => {
            let mut server_config = config;
            server_config.base_url = base_url;
            server_config.api_key = Some(api_key);
            server_config.default_org_id = default_org_id;
            server_config.default_project_id = default_project_id;

            // Validate configuration
            server_config
                .validate()
                .map_err(|e| anyhow::anyhow!("Configuration validation failed: {}", e))?;

            let server = McpServer::new(server_config).await?;

            tokio::select! {
                result = server.run_stdio(io::stdin(), io::stdout()) => {
                    if let Err(e) = result {
                        error!("Stdio server error: {}", e);
                        return Err(e);
                    }
                }
                _ = shutdown => {
                    info!("Shutting down stdio server");
                }
            }
        }
        Commands::HttpServer { port, path } => {
            let mut server_config = config;
            server_config.http_port = port;
            server_config.http_path = path;

            // Validate configuration
            server_config
                .validate()
                .map_err(|e| anyhow::anyhow!("Configuration validation failed: {}", e))?;

            let server = McpServer::new(server_config).await?;

            tokio::select! {
                result = server.run_http() => {
                    if let Err(e) = result {
                        error!("HTTP server error: {}", e);
                        return Err(e);
                    }
                }
                _ = shutdown => {
                    info!("Shutting down HTTP server");
                }
            }
        }
        Commands::Internal {
            bearer_token,
            mcp_svc_secret,
        } => {
            let mut server_config = config;
            server_config.internal = true;
            server_config.bearer_token = Some(bearer_token);
            server_config.mcp_svc_secret = Some(mcp_svc_secret);

            // Validate configuration
            server_config
                .validate()
                .map_err(|e| anyhow::anyhow!("Configuration validation failed: {}", e))?;

            let server = McpServer::new(server_config).await?;

            tokio::select! {
                result = server.run_stdio(io::stdin(), io::stdout()) => {
                    if let Err(e) = result {
                        error!("Internal server error: {}", e);
                        return Err(e);
                    }
                }
                _ = shutdown => {
                    info!("Shutting down internal server");
                }
            }
        }
    }

    Ok(())
}

fn init_tracing(debug: bool, log_file: Option<&str>) -> Result<()> {
    use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

    let filter = if debug {
        EnvFilter::new("debug")
    } else {
        EnvFilter::from_default_env()
            .add_directive("harness_mcp=info".parse()?)
            .add_directive("harness_mcp_core=info".parse()?)
            .add_directive("harness_mcp_client=info".parse()?)
            .add_directive("harness_mcp_tools=info".parse()?)
            .add_directive("harness_mcp_auth=info".parse()?)
    };

    let subscriber = tracing_subscriber::registry().with(filter);

    match log_file {
        Some(path) => {
            let file = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)?;

            let file_layer = fmt::layer()
                .with_writer(file)
                .with_ansi(false)
                .with_target(true)
                .with_thread_ids(true)
                .with_level(true);

            subscriber.with(file_layer).init();
        }
        None => {
            let stdout_layer = fmt::layer()
                .with_writer(io::stderr)
                .with_target(true)
                .with_thread_ids(debug)
                .with_level(true)
                .compact();

            subscriber.with(stdout_layer).init();
        }
    }

    Ok(())
}

fn build_config(cli: &Cli) -> Result<Config> {
    // Load configuration with precedence: custom file -> default files -> env -> defaults
    let mut config = if let Some(config_path) = &cli.config {
        Config::from_file(config_path)
            .map_err(|e| anyhow::anyhow!("Failed to load config from {}: {}", config_path, e))?
    } else {
        Config::load().unwrap_or_else(|e| {
            info!("Failed to load config: {}, using defaults", e);
            Config::default()
        })
    };

    // Override with CLI arguments (highest precedence)
    if cli.debug {
        config.debug = true;
    }

    config.read_only = cli.read_only;
    config.enable_license = cli.enable_license;

    if let Some(toolsets) = &cli.toolsets {
        config.toolsets = toolsets.clone();
    }

    if let Some(modules) = &cli.enable_modules {
        config.enable_modules = modules.clone();
    }

    if let Some(log_file) = &cli.log_file {
        config.log_file = Some(log_file.clone());
    }

    info!("Configuration loaded successfully");
    if config.debug {
        info!("Debug mode enabled");
    }
    if config.internal {
        info!("Running in internal mode");
    }

    Ok(config)
}
