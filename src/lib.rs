// Harness MCP Server Library

pub mod config;
pub mod harness;
pub mod modules;
pub mod toolsets;
pub mod types;
pub mod utils;

pub use config::Config;

// Re-export commonly used types
pub use types::{McpRequest, McpResponse, McpError, TransportType};
pub use harness::client::HarnessClient;
pub use harness::dto::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_library_exports() {
        // Basic smoke test to ensure exports work
        let _config = Config {
            base_url: "https://app.harness.io".to_string(),
            api_key: "pat.test.token.xyz".to_string(),
            account_id: "test".to_string(),
            org_id: None,
            project_id: None,
            toolsets: std::collections::HashSet::new(),
            read_only: false,
        };
    }
}