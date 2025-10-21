use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - A Model Context Protocol server for Harness APIs")]
#[command(version = env!("CARGO_PKG_VERSION"))]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
    
    /// Comma-separated list of tool groups to enable
    #[arg(long, value_delimiter = ',', global = true)]
    pub toolsets: Option<Vec<String>>,
    
    /// Comma-separated list of modules to enable
    #[arg(long, value_delimiter = ',', global = true)]
    pub enable_modules: Option<Vec<String>>,
    
    /// Enable license validation
    #[arg(long, global = true)]
    pub enable_license: bool,
    
    /// Restrict the server to read-only operations
    #[arg(long, global = true)]
    pub read_only: bool,
    
    /// Path to log file
    #[arg(long, global = true)]
    pub log_file: Option<PathBuf>,
    
    /// Enable debug logging
    #[arg(long, global = true)]
    pub debug: bool,
    
    /// Directory where the tool writes output files
    #[arg(long, global = true)]
    pub output_dir: Option<PathBuf>,
    
    /// Log format (text or json)
    #[arg(long, default_value = "text", global = true)]
    pub log_format: String,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Start stdio server
    Stdio {
        /// Base URL for Harness
        #[arg(long, default_value = "https://app.harness.io", env = "HARNESS_BASE_URL")]
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
    
    /// Start MCP as a standalone server with HTTP transport
    HttpServer {
        /// HTTP server port
        #[arg(long, default_value = "8080")]
        http_port: u16,
        
        /// HTTP server path
        #[arg(long, default_value = "/mcp")]
        http_path: String,
        
        // Internal service configurations
        #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
        pipeline_svc_base_url: Option<String>,
        
        #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
        pipeline_svc_secret: Option<String>,
        
        #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
        mcp_svc_secret: Option<String>,
        
        // Add other service configurations as needed
    },
    
    /// Start stdio server in internal mode
    Internal {
        /// Bearer token for authentication
        #[arg(long, env = "HARNESS_BEARER_TOKEN")]
        bearer_token: String,
        
        /// MCP service secret
        #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
        mcp_svc_secret: String,
        
        // Internal service configurations
        #[arg(long, env = "HARNESS_PIPELINE_SVC_BASE_URL")]
        pipeline_svc_base_url: Option<String>,
        
        #[arg(long, env = "HARNESS_PIPELINE_SVC_SECRET")]
        pipeline_svc_secret: Option<String>,
        
        // Add other internal service configurations
    },
}