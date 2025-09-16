use anyhow::Result;
use clap::{Parser, Subcommand};
use harness_mcp_config::Config;
use harness_mcp_core::server::McpServer;
use std::io;
use tracing::{info, Level};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - A Model Context Protocol server for Harness APIs")]
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

    /// Output directory for files
    #[arg(long, global = true)]
    output_dir: Option<String>,
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
        #[arg(long, value_delimiter = ',')]
        toolsets: Option<Vec<String>>,

        /// Run in read-only mode
        #[arg(long)]
        read_only: bool,
    },

    /// Start HTTP server
    HttpServer {
        /// HTTP server port
        #[arg(long, default_value = "8080")]
        port: u16,

        /// HTTP server path
        #[arg(long, default_value = "/mcp")]
        path: String,

        /// Comma-separated list of toolsets to enable
        #[arg(long, value_delimiter = ',')]
        toolsets: Option<Vec<String>>,

        /// Run in read-only mode
        #[arg(long)]
        read_only: bool,
    },

    /// Start internal server (for Harness internal use)
    Internal {
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: String,

        /// MCP service secret
        #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
        mcp_svc_secret: String,

        /// Comma-separated list of toolsets to enable
        #[arg(long, value_delimiter = ',')]
        toolsets: Option<Vec<String>>,

        /// Run in read-only mode (default for internal mode)
        #[arg(long, default_value = "true")]
        read_only: bool,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    init_logging(cli.debug, cli.log_file.as_deref())?;

    info!("Starting Harness MCP Server");

    // Build configuration based on command
    let config = match &cli.command {
        Commands::Stdio {
            base_url,
            api_key,
            default_org_id,
            default_project_id,
            toolsets,
            read_only,
        } => {
            let account_id = extract_account_id_from_api_key(api_key)?;
            Config::stdio(
                base_url.clone(),
                account_id,
                api_key.clone(),
                default_org_id.clone(),
                default_project_id.clone(),
                toolsets.clone().unwrap_or_default(),
                *read_only,
                cli.output_dir.clone(),
            )
        }
        Commands::HttpServer {
            port,
            path,
            toolsets,
            read_only,
        } => Config::http_server(
            *port,
            path.clone(),
            toolsets.clone().unwrap_or_default(),
            *read_only,
            cli.output_dir.clone(),
        ),
        Commands::Internal {
            bearer_token,
            mcp_svc_secret,
            toolsets,
            read_only,
        } => Config::internal(
            bearer_token.clone(),
            mcp_svc_secret.clone(),
            toolsets.clone().unwrap_or_default(),
            *read_only,
            cli.output_dir.clone(),
        ),
    };

    // Create and run the MCP server
    let server = McpServer::new(config).await?;

    match &cli.command {
        Commands::Stdio { .. } => {
            info!("Starting stdio server");
            server.run_stdio(io::stdin(), io::stdout()).await?;
        }
        Commands::HttpServer { port, path, .. } => {
            info!("Starting HTTP server on port {} at path {}", port, path);
            server.run_http(*port, path).await?;
        }
        Commands::Internal { .. } => {
            info!("Starting internal stdio server");
            server.run_stdio(io::stdin(), io::stdout()).await?;
        }
    }

    Ok(())
}

fn init_logging(debug: bool, log_file: Option<&str>) -> Result<()> {
    let level = if debug { Level::DEBUG } else { Level::INFO };

    let env_filter = EnvFilter::from_default_env()
        .add_directive(level.into())
        .add_directive("harness_mcp=debug".parse()?);

    let subscriber = tracing_subscriber::registry().with(env_filter);

    match log_file {
        Some(file_path) => {
            let file = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(file_path)?;
            
            subscriber
                .with(fmt::layer().with_writer(file).with_ansi(false))
                .init();
        }
        None => {
            subscriber.with(fmt::layer()).init();
        }
    }

    Ok(())
}

/// Extract account ID from Harness API key
/// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        anyhow::bail!("Invalid API key format");
    }
    Ok(parts[1].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_account_id_from_api_key() {
        let api_key = "pat.account123.token456.signature789";
        let account_id = extract_account_id_from_api_key(api_key).unwrap();
        assert_eq!(account_id, "account123");
    }

    #[test]
    fn test_extract_account_id_invalid_format() {
        let api_key = "invalid_key";
        let result = extract_account_id_from_api_key(api_key);
        assert!(result.is_err());
    }
}