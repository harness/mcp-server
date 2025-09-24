//! Command line interface for Harness MCP Server

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server")]
#[command(version)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Start stdio server
    Stdio(StdioArgs),
    /// Start HTTP server
    HttpServer(HttpServerArgs),
    /// Start internal server
    Internal(InternalArgs),
}

#[derive(Parser)]
pub struct StdioArgs {
    /// Base URL for Harness
    #[arg(
        long,
        default_value = "https://app.harness.io",
        env = "HARNESS_BASE_URL"
    )]
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

    /// Comma-separated list of toolsets to enable
    #[arg(long, value_delimiter = ',', env = "HARNESS_TOOLSETS")]
    pub toolsets: Vec<String>,

    /// Comma-separated list of modules to enable
    #[arg(long, value_delimiter = ',', env = "HARNESS_ENABLE_MODULES")]
    pub enable_modules: Vec<String>,

    /// Enable license validation
    #[arg(long, env = "HARNESS_ENABLE_LICENSE")]
    pub enable_license: bool,

    /// Run in read-only mode
    #[arg(long, env = "HARNESS_READ_ONLY")]
    pub read_only: bool,

    /// Path to log file
    #[arg(long, env = "HARNESS_LOG_FILE")]
    pub log_file: Option<String>,

    /// Enable debug logging
    #[arg(long, env = "HARNESS_DEBUG")]
    pub debug: bool,

    /// Output directory for files
    #[arg(long, env = "HARNESS_OUTPUT_DIR")]
    pub output_dir: Option<String>,
}

#[derive(Parser)]
pub struct HttpServerArgs {
    /// HTTP server port
    #[arg(long, default_value = "8080", env = "HARNESS_HTTP_PORT")]
    pub port: u16,

    /// HTTP server path
    #[arg(long, default_value = "/mcp", env = "HARNESS_HTTP_PATH")]
    pub path: String,

    /// Comma-separated list of toolsets to enable
    #[arg(long, value_delimiter = ',', env = "HARNESS_TOOLSETS")]
    pub toolsets: Vec<String>,

    /// Comma-separated list of modules to enable
    #[arg(long, value_delimiter = ',', env = "HARNESS_ENABLE_MODULES")]
    pub enable_modules: Vec<String>,

    /// Enable license validation
    #[arg(long, env = "HARNESS_ENABLE_LICENSE")]
    pub enable_license: bool,

    /// Run in read-only mode
    #[arg(long, env = "HARNESS_READ_ONLY")]
    pub read_only: bool,

    /// Path to log file
    #[arg(long, env = "HARNESS_LOG_FILE")]
    pub log_file: Option<String>,

    /// Enable debug logging
    #[arg(long, env = "HARNESS_DEBUG")]
    pub debug: bool,

    /// Output directory for files
    #[arg(long, env = "HARNESS_OUTPUT_DIR")]
    pub output_dir: Option<String>,

    // Service configuration
    /// Pipeline service base URL
    #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
    pub pipeline_svc_base_url: Option<String>,

    /// Pipeline service secret
    #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
    pub pipeline_svc_secret: Option<String>,

    /// NG Manager base URL
    #[arg(long, env = "HARNESS_NG_MANAGER_BASE_URL")]
    pub ng_manager_base_url: Option<String>,

    /// NG Manager secret
    #[arg(long, env = "HARNESS_NG_MANAGER_SECRET")]
    pub ng_manager_secret: Option<String>,
    // Add other service configurations as needed...
}

#[derive(Parser)]
pub struct InternalArgs {
    /// Bearer token for authentication
    #[arg(long, env = "HARNESS_BEARER_TOKEN")]
    pub bearer_token: String,

    /// MCP service secret
    #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
    pub mcp_svc_secret: String,

    /// Comma-separated list of toolsets to enable
    #[arg(long, value_delimiter = ',', env = "HARNESS_TOOLSETS")]
    pub toolsets: Vec<String>,

    /// Comma-separated list of modules to enable
    #[arg(long, value_delimiter = ',', env = "HARNESS_ENABLE_MODULES")]
    pub enable_modules: Vec<String>,

    /// Enable license validation
    #[arg(long, env = "HARNESS_ENABLE_LICENSE")]
    pub enable_license: bool,

    /// Path to log file
    #[arg(long, env = "HARNESS_LOG_FILE")]
    pub log_file: Option<String>,

    /// Enable debug logging
    #[arg(long, env = "HARNESS_DEBUG")]
    pub debug: bool,

    /// Output directory for files
    #[arg(long, env = "HARNESS_OUTPUT_DIR")]
    pub output_dir: Option<String>,

    // Service configurations for internal mode
    /// Pipeline service base URL
    #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
    pub pipeline_svc_base_url: Option<String>,

    /// Pipeline service secret
    #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
    pub pipeline_svc_secret: Option<String>,
    // Add other internal service configurations...
}
