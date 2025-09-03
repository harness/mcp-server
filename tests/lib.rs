// Test library for Harness MCP Server
// This provides common test utilities and imports for both unit and integration tests

// Re-export the main library
pub use harness_mcp_server::*;

// Test modules
pub mod unit;
pub mod e2e;

// Common test utilities
pub mod common {
    use crate::config::Config;
    use crate::types::{HarnessError, Scope};
    use std::collections::HashMap;

    /// Create a test configuration
    pub fn create_test_config() -> Config {
        Config {
            harness_platform_api_key: Some("test-api-key".to_string()),
            harness_platform_account_id: Some("test-account".to_string()),
            harness_platform_organization_id: Some("test-org".to_string()),
            harness_platform_project_id: Some("test-project".to_string()),
            internal: false,
            ..Default::default()
        }
    }

    /// Create a test scope
    pub fn create_test_scope() -> Scope {
        Scope {
            account_id: "test-account".to_string(),
            org_id: Some("test-org".to_string()),
            project_id: Some("test-project".to_string()),
        }
    }

    /// Create a test scope without project
    pub fn create_test_scope_no_project() -> Scope {
        Scope {
            account_id: "test-account".to_string(),
            org_id: Some("test-org".to_string()),
            project_id: None,
        }
    }

    /// Create a test scope with only account
    pub fn create_test_scope_account_only() -> Scope {
        Scope {
            account_id: "test-account".to_string(),
            org_id: None,
            project_id: None,
        }
    }

    /// Mock HTTP response builder
    pub struct MockResponse {
        pub status: u16,
        pub body: String,
        pub headers: HashMap<String, String>,
    }

    impl MockResponse {
        pub fn new(status: u16) -> Self {
            Self {
                status,
                body: String::new(),
                headers: HashMap::new(),
            }
        }

        pub fn with_body(mut self, body: &str) -> Self {
            self.body = body.to_string();
            self
        }

        pub fn with_json<T: serde::Serialize>(mut self, data: &T) -> Self {
            self.body = serde_json::to_string(data).unwrap();
            self.headers.insert("content-type".to_string(), "application/json".to_string());
            self
        }

        pub fn with_header(mut self, key: &str, value: &str) -> Self {
            self.headers.insert(key.to_string(), value.to_string());
            self
        }
    }

    /// Test assertion helpers
    pub fn assert_harness_error(result: Result<(), HarnessError>, expected_error_type: &str) {
        match result {
            Err(error) => {
                let error_string = error.to_string();
                assert!(
                    error_string.contains(expected_error_type),
                    "Expected error containing '{}', got: {}",
                    expected_error_type,
                    error_string
                );
            }
            Ok(_) => panic!("Expected error, but got Ok"),
        }
    }

    /// Test data generators
    pub mod generators {
        use crate::types::dto::*;
        use std::collections::HashMap;

        pub fn create_test_connector() -> Connector {
            let mut tags = HashMap::new();
            tags.insert("env".to_string(), "test".to_string());

            Connector {
                name: "test-connector".to_string(),
                identifier: "test_connector".to_string(),
                description: Some("Test connector".to_string()),
                org_identifier: Some("test_org".to_string()),
                project_identifier: Some("test_project".to_string()),
                tags: Some(tags),
                connector_type: "Git".to_string(),
                spec: serde_json::json!({"url": "https://github.com/test/repo"}),
            }
        }

        pub fn create_test_pipeline() -> Pipeline {
            let mut tags = HashMap::new();
            tags.insert("team".to_string(), "platform".to_string());

            Pipeline {
                identifier: "test_pipeline".to_string(),
                name: "Test Pipeline".to_string(),
                description: Some("Test pipeline description".to_string()),
                tags: Some(tags),
                version: Some(1),
                yaml: Some("pipeline:\n  name: Test Pipeline".to_string()),
            }
        }

        pub fn create_test_service() -> Service {
            Service {
                identifier: "test_service".to_string(),
                name: "Test Service".to_string(),
                description: Some("Test service description".to_string()),
                tags: None,
                version: Some(1),
            }
        }

        pub fn create_test_environment() -> Environment {
            Environment {
                identifier: "test_env".to_string(),
                name: "Test Environment".to_string(),
                description: Some("Test environment description".to_string()),
                tags: None,
                environment_type: "Production".to_string(),
                version: Some(1),
            }
        }
    }
}

// Test macros
#[macro_export]
macro_rules! assert_json_eq {
    ($left:expr, $right:expr) => {
        let left_json: serde_json::Value = serde_json::from_str($left).expect("Invalid JSON in left");
        let right_json: serde_json::Value = serde_json::from_str($right).expect("Invalid JSON in right");
        assert_eq!(left_json, right_json);
    };
}

#[macro_export]
macro_rules! skip_if_no_env {
    ($env_var:expr) => {
        if std::env::var($env_var).is_err() {
            eprintln!("Skipping test: {} environment variable not set", $env_var);
            return;
        }
    };
}

#[macro_export]
macro_rules! async_test {
    ($test_name:ident, $test_body:block) => {
        #[tokio::test]
        async fn $test_name() {
            $test_body
        }
    };
}

// Re-export common testing utilities
pub use common::*;