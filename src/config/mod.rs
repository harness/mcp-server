use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - A Model Context Protocol server for Harness APIs")]
#[command(version)]
pub struct Config {
    #[command(subcommand)]
    pub command: Commands,

    /// Enable debug logging
    #[arg(long, global = true)]
    pub debug: bool,

    /// Path to log file
    #[arg(long, global = true)]
    pub log_file: Option<PathBuf>,

    /// Directory where the tool writes output files
    #[arg(long, global = true)]
    pub output_dir: Option<PathBuf>,

    /// Comma-separated list of toolsets to enable
    #[arg(long, global = true, value_delimiter = ',')]
    pub toolsets: Vec<String>,

    /// Enable license validation
    #[arg(long, global = true)]
    pub enable_license: bool,

    /// Comma-separated list of modules to enable
    #[arg(long, global = true, value_delimiter = ',')]
    pub enable_modules: Vec<String>,

    /// Run in read-only mode
    #[arg(long, global = true)]
    pub read_only: bool,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Start stdio server
    Stdio(StdioConfig),
    /// Start HTTP server
    Http(HttpConfig),
    /// Start internal server
    Internal(InternalConfig),
}

#[derive(Parser, Debug, Clone)]
pub struct StdioConfig {
    /// Base URL for Harness
    #[arg(long, env = "HARNESS_BASE_URL", default_value = "https://app.harness.io")]
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

#[derive(Parser, Debug, Clone)]
pub struct HttpConfig {
    /// HTTP server port
    #[arg(long, default_value = "8080")]
    pub port: u16,

    /// HTTP server path
    #[arg(long, default_value = "/mcp")]
    pub path: String,
}

#[derive(Parser, Debug, Clone)]
pub struct InternalConfig {
    /// Bearer token for authentication
    #[arg(long, env = "HARNESS_BEARER_TOKEN")]
    pub bearer_token: String,

    /// MCP service secret
    #[arg(long, env = "HARNESS_MCP_SVC_SECRET")]
    pub mcp_svc_secret: String,

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

    // Add other service configurations as needed
}

impl StdioConfig {
    /// Extract account ID from API key
    pub fn account_id(&self) -> anyhow::Result<String> {
        let parts: Vec<&str> = self.api_key.split('.').collect();
        if parts.len() < 2 {
            anyhow::bail!("Invalid API key format");
        }
        Ok(parts[1].to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub base_url: String,
    pub secret: Option<String>,
    pub timeout_seconds: Option<u64>,
}

impl Default for ServiceConfig {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            secret: None,
            timeout_seconds: Some(30),
        }
    }
}