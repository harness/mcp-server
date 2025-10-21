use clap::ValueEnum;
use serde::{Deserialize, Serialize};
use anyhow::Result;

pub mod cli;
pub use cli::{Cli, Commands};

#[derive(Clone, Debug, ValueEnum, Serialize, Deserialize)]
pub enum LogFormat {
    Text,
    Json,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum TransportType {
    Stdio,
    Http,
    Internal,
}

#[derive(Clone, Debug)]
pub struct Config {
    pub version: String,
    pub debug: bool,
    pub log_format: LogFormat,
    pub transport: TransportType,
    pub toolsets: Vec<String>,
    pub enable_modules: Vec<String>,
    pub read_only: bool,
    pub output_dir: Option<String>,
    
    // Transport-specific config
    pub stdio_config: Option<StdioConfig>,
    pub http_config: Option<HttpConfig>,
}

#[derive(Clone, Debug)]
pub struct StdioConfig {
    pub base_url: String,
    pub api_key: String,
    pub account_id: String,
    pub default_org_id: Option<String>,
    pub default_project_id: Option<String>,
}

#[derive(Clone, Debug)]
pub struct HttpConfig {
    pub port: u16,
    pub path: String,
    pub mcp_svc_secret: String,
    pub pipeline_svc_base_url: Option<String>,
    pub pipeline_svc_secret: Option<String>,
    pub ng_manager_base_url: Option<String>,
    pub ng_manager_secret: Option<String>,
}

impl Config {
    pub fn from_cli(cli: &Cli) -> Result<Self> {
        let version = env!("CARGO_PKG_VERSION").to_string();
        
        let (transport, stdio_config, http_config, debug, toolsets, enable_modules, read_only, output_dir) = match &cli.command {
            Commands::Stdio { 
                base_url, 
                api_key, 
                account_id,
                default_org_id, 
                default_project_id,
                debug,
                toolsets,
                enable_modules,
                read_only,
                output_dir,
            } => {
                let stdio_config = StdioConfig {
                    base_url: base_url.clone(),
                    api_key: api_key.clone(),
                    account_id: account_id.clone(),
                    default_org_id: default_org_id.clone(),
                    default_project_id: default_project_id.clone(),
                };
                (
                    TransportType::Stdio, 
                    Some(stdio_config), 
                    None,
                    *debug,
                    toolsets.clone(),
                    enable_modules.clone(),
                    *read_only,
                    output_dir.clone(),
                )
            }
            Commands::HttpServer { 
                http_port, 
                http_path, 
                mcp_svc_secret,
                pipeline_svc_base_url,
                pipeline_svc_secret,
                ng_manager_base_url,
                ng_manager_secret,
                debug,
                toolsets,
                enable_modules,
                read_only,
                output_dir,
            } => {
                let http_config = HttpConfig {
                    port: *http_port,
                    path: http_path.clone(),
                    mcp_svc_secret: mcp_svc_secret.clone(),
                    pipeline_svc_base_url: pipeline_svc_base_url.clone(),
                    pipeline_svc_secret: pipeline_svc_secret.clone(),
                    ng_manager_base_url: ng_manager_base_url.clone(),
                    ng_manager_secret: ng_manager_secret.clone(),
                };
                (
                    TransportType::Http, 
                    None, 
                    Some(http_config),
                    *debug,
                    toolsets.clone(),
                    enable_modules.clone(),
                    *read_only,
                    output_dir.clone(),
                )
            }
            Commands::Internal { 
                http_port, 
                http_path, 
                debug,
                toolsets,
                enable_modules,
                read_only,
                output_dir,
            } => {
                let http_config = HttpConfig {
                    port: *http_port,
                    path: http_path.clone(),
                    mcp_svc_secret: String::new(), // Internal mode doesn't need auth
                    pipeline_svc_base_url: None,
                    pipeline_svc_secret: None,
                    ng_manager_base_url: None,
                    ng_manager_secret: None,
                };
                (
                    TransportType::Internal, 
                    None, 
                    Some(http_config),
                    *debug,
                    toolsets.clone(),
                    enable_modules.clone(),
                    *read_only,
                    output_dir.clone(),
                )
            }
        };
        
        Ok(Config {
            version,
            debug,
            log_format: LogFormat::Text, // Default for now, can be made configurable
            transport,
            toolsets: if toolsets.is_empty() { 
                vec!["default".to_string()] 
            } else { 
                toolsets 
            },
            enable_modules,
            read_only,
            output_dir,
            stdio_config,
            http_config,
        })
    }
}