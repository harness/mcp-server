//! Command-line interface for Harness MCP Server

use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - Model Context Protocol server for Harness APIs")]
#[command(version)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Enable debug logging
    #[arg(long, global = true)]
    pub debug: bool,

    /// Path to log file
    #[arg(long, global = true)]
    pub log_file: Option<PathBuf>,

    /// Run in read-only mode
    #[arg(long, global = true)]
    pub read_only: bool,

    /// Comma-separated list of toolsets to enable
    #[arg(long, global = true, value_delimiter = ',')]
    pub toolsets: Option<Vec<String>>,

    /// Enable license validation
    #[arg(long, global = true)]
    pub enable_license: bool,

    /// Comma-separated list of modules to enable
    #[arg(long, global = true, value_delimiter = ',')]
    pub enable_modules: Option<Vec<String>>,

    /// Directory for output files
    #[arg(long, global = true)]
    pub output_dir: Option<PathBuf>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Start stdio server
    Stdio(StdioArgs),
    /// Start HTTP server
    Http(HttpArgs),
    /// Start internal server
    Internal(InternalArgs),
}

#[derive(Parser)]
pub struct StdioArgs {
    /// Base URL for Harness
    #[arg(long, default_value = "https://app.harness.io")]
    pub base_url: String,

    /// API key for authentication
    #[arg(long, env = "HARNESS_API_KEY")]
    pub api_key: String,

    /// Default organization ID
    #[arg(long, env = "HARNESS_DEFAULT_ORG_ID")]
    pub default_org_id: Option<String>,

    /// Default project ID
    #[arg(long, env = "HARNESS_DEFAULT_PROJECT_ID")]
    pub default_project_id: Option<String>,
}

#[derive(Parser)]
pub struct HttpArgs {
    /// HTTP server port
    #[arg(long, default_value = "8080")]
    pub port: u16,

    /// HTTP server path
    #[arg(long, default_value = "/mcp")]
    pub path: String,

    // Internal service configurations
    #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
    pub pipeline_svc_base_url: Option<String>,

    #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
    pub pipeline_svc_secret: Option<String>,

    #[arg(long, env = "HARNESS_NG_MANAGER_BASE_URL")]
    pub ng_manager_base_url: Option<String>,

    #[arg(long, env = "HARNESS_NG_MANAGER_SECRET")]
    pub ng_manager_secret: Option<String>,

    // Add other service configurations as needed
}

#[derive(Parser)]
pub struct InternalArgs {
    /// Bearer token for authentication
    #[arg(long, env = "HARNESS_BEARER_TOKEN")]
    pub bearer_token: String,

    /// MCP service secret
    #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
    pub mcp_svc_secret: String,

    // Internal service configurations (same as HttpArgs)
    #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
    pub pipeline_svc_base_url: Option<String>,

    #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
    pub pipeline_svc_secret: Option<String>,

    #[arg(long, env = "HARNESS_NG_MANAGER_BASE_URL")]
    pub ng_manager_base_url: Option<String>,

    #[arg(long, env = "HARNESS_NG_MANAGER_SECRET")]
    pub ng_manager_secret: Option<String>,

    // Add other service configurations as needed
}