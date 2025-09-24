//! Server implementations for different transport modes

use anyhow::Result;
use harness_mcp_core::config::Config;
use harness_mcp_core::server::McpServer;
use tokio::signal;
use tracing::{error, info};

use crate::cli::{HttpServerArgs, InternalArgs, StdioArgs};

/// Run the MCP server in stdio mode
pub async fn run_stdio_server(args: StdioArgs) -> Result<()> {
    info!("Starting MCP server in stdio mode");

    // Extract account ID from API key
    let account_id = extract_account_id_from_api_key(&args.api_key)?;

    let config = Config {
        version: env!("CARGO_PKG_VERSION").to_string(),
        base_url: Some(args.base_url),
        account_id: Some(account_id),
        default_org_id: args.default_org_id,
        default_project_id: args.default_project_id,
        api_key: Some(args.api_key),
        read_only: args.read_only,
        toolsets: args.toolsets,
        enable_modules: args.enable_modules,
        enable_license: args.enable_license,
        log_file_path: args.log_file,
        debug: args.debug,
        output_dir: args.output_dir,
        internal: false,
        ..Default::default()
    };

    // Create and run the MCP server
    let server = McpServer::new(config).await?;

    // Set up signal handling
    let ctrl_c = signal::ctrl_c();
    tokio::pin!(ctrl_c);

    // Run the stdio server
    tokio::select! {
        result = server.run_stdio(tokio::io::stdin(), tokio::io::stdout()) => {
            match result {
                Ok(_) => info!("Stdio server completed successfully"),
                Err(e) => error!("Stdio server error: {:#}", e),
            }
        }
        _ = &mut ctrl_c => {
            info!("Received shutdown signal");
        }
    }

    Ok(())
}

/// Run the MCP server in HTTP mode
pub async fn run_http_server(args: HttpServerArgs) -> Result<()> {
    info!("Starting MCP server in HTTP mode on port {}", args.port);

    let config = Config {
        version: env!("CARGO_PKG_VERSION").to_string(),
        read_only: args.read_only,
        toolsets: args.toolsets,
        enable_modules: args.enable_modules,
        enable_license: args.enable_license,
        log_file_path: args.log_file,
        debug: args.debug,
        output_dir: args.output_dir,
        internal: true,
        http_port: args.port,
        http_path: args.path,
        pipeline_svc_base_url: args.pipeline_svc_base_url,
        pipeline_svc_secret: args.pipeline_svc_secret,
        ng_manager_base_url: args.ng_manager_base_url,
        ng_manager_secret: args.ng_manager_secret,
        ..Default::default()
    };

    // Create and run the HTTP server
    let server = McpServer::new(config).await?;

    // Set up signal handling
    let ctrl_c = signal::ctrl_c();
    tokio::pin!(ctrl_c);

    // Run the HTTP server
    tokio::select! {
        result = server.run_http() => {
            match result {
                Ok(_) => info!("HTTP server completed successfully"),
                Err(e) => error!("HTTP server error: {:#}", e),
            }
        }
        _ = &mut ctrl_c => {
            info!("Received shutdown signal");
        }
    }

    Ok(())
}

/// Run the MCP server in internal mode
pub async fn run_internal_server(args: InternalArgs) -> Result<()> {
    info!("Starting MCP server in internal mode");

    // TODO: Authenticate session using bearer token and MCP secret
    // let session = authenticate_session(&args.bearer_token, &args.mcp_svc_secret).await?;

    let config = Config {
        version: env!("CARGO_PKG_VERSION").to_string(),
        read_only: true, // Internal mode is read-only for now
        toolsets: args.toolsets,
        enable_modules: args.enable_modules,
        enable_license: args.enable_license,
        log_file_path: args.log_file,
        debug: args.debug,
        output_dir: args.output_dir,
        internal: true,
        bearer_token: Some(args.bearer_token),
        mcp_svc_secret: Some(args.mcp_svc_secret),
        pipeline_svc_base_url: args.pipeline_svc_base_url,
        pipeline_svc_secret: args.pipeline_svc_secret,
        ..Default::default()
    };

    // Create and run the internal server
    let server = McpServer::new(config).await?;

    // Set up signal handling
    let ctrl_c = signal::ctrl_c();
    tokio::pin!(ctrl_c);

    // Run the stdio server (internal mode uses stdio transport)
    tokio::select! {
        result = server.run_stdio(tokio::io::stdin(), tokio::io::stdout()) => {
            match result {
                Ok(_) => info!("Internal server completed successfully"),
                Err(e) => error!("Internal server error: {:#}", e),
            }
        }
        _ = &mut ctrl_c => {
            info!("Received shutdown signal");
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
