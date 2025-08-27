use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - Rust implementation")]
#[command(version = env!("CARGO_PKG_VERSION"))]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Enable debug logging
    #[arg(long, global = true)]
    pub debug: bool,

    /// Path to log file
    #[arg(long, global = true)]
    pub log_file: Option<String>,

    /// Run in read-only mode
    #[arg(long, global = true)]
    pub read_only: bool,

    /// Comma-separated list of toolsets to enable
    #[arg(long, global = true, value_delimiter = ',')]
    pub toolsets: Vec<String>,

    /// Enable license validation
    #[arg(long, global = true)]
    pub enable_license: bool,

    /// Comma-separated list of modules to enable
    #[arg(long, global = true, value_delimiter = ',')]
    pub enable_modules: Vec<String>,
}

#[derive(Subcommand)]
pub enum Commands {
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
    },
    /// Start internal server mode
    Internal {
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: String,

        /// MCP service secret
        #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
        mcp_svc_secret: String,

        /// Pipeline service base URL
        #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
        pipeline_svc_base_url: Option<String>,

        /// Pipeline service secret
        #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
        pipeline_svc_secret: Option<String>,

        /// NG Manager base URL
        #[arg(long, env = "HARNESS_NG_MANAGER_BASE_URL")]
        ng_manager_base_url: Option<String>,

        /// NG Manager secret
        #[arg(long, env = "HARNESS_NG_MANAGER_SECRET")]
        ng_manager_secret: Option<String>,

        // Add other internal service configurations as needed
    },
}