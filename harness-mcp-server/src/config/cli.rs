use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(name = "harness-mcp-server")]
#[command(about = "Harness MCP Server - Model Context Protocol server for Harness platform")]
#[command(version)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Run in stdio mode for direct MCP communication
    Stdio {
        /// Harness base URL
        #[arg(long, env = "HARNESS_BASE_URL", default_value = "https://app.harness.io")]
        base_url: String,

        /// Harness API key
        #[arg(long, env = "HARNESS_API_KEY")]
        api_key: String,

        /// Harness account ID
        #[arg(long, env = "HARNESS_ACCOUNT_ID")]
        account_id: String,

        /// Default organization ID
        #[arg(long, env = "HARNESS_DEFAULT_ORG_ID")]
        default_org_id: Option<String>,

        /// Default project ID
        #[arg(long, env = "HARNESS_DEFAULT_PROJECT_ID")]
        default_project_id: Option<String>,

        /// Enable debug logging
        #[arg(long, env = "HARNESS_DEBUG")]
        debug: bool,

        /// Toolsets to enable (comma-separated)
        #[arg(long, env = "HARNESS_TOOLSETS", value_delimiter = ',')]
        toolsets: Vec<String>,

        /// Modules to enable (comma-separated)
        #[arg(long, env = "HARNESS_ENABLE_MODULES", value_delimiter = ',')]
        enable_modules: Vec<String>,

        /// Enable read-only mode
        #[arg(long, env = "HARNESS_READ_ONLY")]
        read_only: bool,

        /// Output directory for generated files
        #[arg(long, env = "HARNESS_OUTPUT_DIR")]
        output_dir: Option<String>,
    },

    /// Run HTTP server mode
    HttpServer {
        /// HTTP server port
        #[arg(long, env = "HARNESS_HTTP_PORT", default_value = "8080")]
        http_port: u16,

        /// HTTP server path
        #[arg(long, env = "HARNESS_HTTP_PATH", default_value = "/mcp")]
        http_path: String,

        /// MCP service secret for authentication
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

        /// Enable debug logging
        #[arg(long, env = "HARNESS_DEBUG")]
        debug: bool,

        /// Toolsets to enable (comma-separated)
        #[arg(long, env = "HARNESS_TOOLSETS", value_delimiter = ',')]
        toolsets: Vec<String>,

        /// Modules to enable (comma-separated)
        #[arg(long, env = "HARNESS_ENABLE_MODULES", value_delimiter = ',')]
        enable_modules: Vec<String>,

        /// Enable read-only mode
        #[arg(long, env = "HARNESS_READ_ONLY")]
        read_only: bool,

        /// Output directory for generated files
        #[arg(long, env = "HARNESS_OUTPUT_DIR")]
        output_dir: Option<String>,
    },

    /// Run in internal mode (for Harness internal use)
    Internal {
        /// HTTP server port
        #[arg(long, env = "HARNESS_HTTP_PORT", default_value = "8080")]
        http_port: u16,

        /// HTTP server path
        #[arg(long, env = "HARNESS_HTTP_PATH", default_value = "/mcp")]
        http_path: String,

        /// Enable debug logging
        #[arg(long, env = "HARNESS_DEBUG")]
        debug: bool,

        /// Toolsets to enable (comma-separated)
        #[arg(long, env = "HARNESS_TOOLSETS", value_delimiter = ',')]
        toolsets: Vec<String>,

        /// Modules to enable (comma-separated)
        #[arg(long, env = "HARNESS_ENABLE_MODULES", value_delimiter = ',')]
        enable_modules: Vec<String>,

        /// Enable read-only mode
        #[arg(long, env = "HARNESS_READ_ONLY")]
        read_only: bool,

        /// Output directory for generated files
        #[arg(long, env = "HARNESS_OUTPUT_DIR")]
        output_dir: Option<String>,
    },
}

impl Cli {
    pub fn parse_args() -> Self {
        Self::parse()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_parsing() {
        // Test stdio command
        let cli = Cli::try_parse_from([
            "harness-mcp-server",
            "stdio",
            "--api-key", "test-key",
            "--account-id", "test-account",
        ]);
        assert!(cli.is_ok());

        // Test http-server command
        let cli = Cli::try_parse_from([
            "harness-mcp-server", 
            "http-server",
            "--mcp-svc-secret", "test-secret",
        ]);
        assert!(cli.is_ok());

        // Test internal command
        let cli = Cli::try_parse_from([
            "harness-mcp-server",
            "internal",
        ]);
        assert!(cli.is_ok());
    }
}