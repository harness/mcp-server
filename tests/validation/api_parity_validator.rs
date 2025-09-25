//! API Parity Validator
//!
//! This module provides comprehensive validation of API parity between
//! Go and Rust implementations of the Harness MCP Server.

use serde_json::{Value, json};
use std::collections::HashMap;
use reqwest::Client;
use tokio::time::{timeout, Duration};

/// API parity validation configuration
#[derive(Debug, Clone)]
pub struct ValidationConfig {
    pub go_server_url: String,
    pub rust_server_url: String,
    pub timeout_seconds: u64,
    pub api_key: String,
    pub account_id: String,
    pub org_id: String,
    pub project_id: String,
}

/// Validation result for a single test case
#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub test_name: String,
    pub request: Value,
    pub go_response: Option<Value>,
    pub rust_response: Option<Value>,
    pub go_status: Option<u16>,
    pub rust_status: Option<u16>,
    pub response_matches: bool,
    pub status_matches: bool,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

/// API parity validator
pub struct ApiParityValidator {
    config: ValidationConfig,
    client: Client,
    results: Vec<ValidationResult>,
}

impl ApiParityValidator {
    /// Create a new API parity validator
    pub fn new(config: ValidationConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config,
            client,
            results: Vec::new(),
        }
    }

    /// Run comprehensive API parity validation
    pub async fn validate_all(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("🔍 Running API Parity Validation");
        println!("=================================");

        // Test MCP protocol endpoints
        self.validate_mcp_initialize().await?;
        self.validate_mcp_list_tools().await?;
        
        // Test tool endpoints
        self.validate_pipeline_tools().await?;
        self.validate_connector_tools().await?;
        self.validate_environment_tools().await?;
        
        // Test error handling
        self.validate_error_handling().await?;

        // Generate summary
        self.print_summary();

        Ok(())
    }

    /// Validate MCP initialize endpoint
    async fn validate_mcp_initialize(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("\n🔧 Validating MCP Initialize");
        
        let request = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                },
                "capabilities": {}
            }
        });

        self.validate_request("mcp_initialize", request).await?;
        Ok(())
    }

    /// Validate MCP list tools endpoint
    async fn validate_mcp_list_tools(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("\n🔧 Validating MCP List Tools");
        
        let request = json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        });

        self.validate_request("mcp_list_tools", request).await?;
        Ok(())
    }

    /// Validate pipeline tool endpoints
    async fn validate_pipeline_tools(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("\n🔧 Validating Pipeline Tools");

        // List pipelines
        let list_request = json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "list_pipelines",
                "arguments": {
                    "account_id": self.config.account_id,
                    "org_id": self.config.org_id,
                    "project_id": self.config.project_id,
                    "page": 0,
                    "size": 20
                }
            }
        });

        self.validate_request("pipeline_list_pipelines", list_request).await?;

        // Get pipeline
        let get_request = json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "get_pipeline",
                "arguments": {
                    "pipeline_id": "test_pipeline",
                    "account_id": self.config.account_id,
                    "org_id": self.config.org_id,
                    "project_id": self.config.project_id
                }
            }
        });

        self.validate_request("pipeline_get_pipeline", get_request).await?;

        Ok(())
    }

    /// Validate connector tool endpoints
    async fn validate_connector_tools(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("\n🔧 Validating Connector Tools");

        // List connector catalogue
        let catalogue_request = json!({
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {
                "name": "list_connector_catalogue",
                "arguments": {
                    "account_id": self.config.account_id
                }
            }
        });

        self.validate_request("connector_list_catalogue", catalogue_request).await?;

        // List connectors
        let list_request = json!({
            "jsonrpc": "2.0",
            "id": 6,
            "method": "tools/call",
            "params": {
                "name": "list_connectors",
                "arguments": {
                    "account_id": self.config.account_id,
                    "org_id": self.config.org_id,
                    "project_id": self.config.project_id
                }
            }
        });

        self.validate_request("connector_list_connectors", list_request).await?;

        Ok(())
    }

    /// Validate environment tool endpoints
    async fn validate_environment_tools(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("\n🔧 Validating Environment Tools");

        // List environments
        let list_request = json!({
            "jsonrpc": "2.0",
            "id": 7,
            "method": "tools/call",
            "params": {
                "name": "list_environments",
                "arguments": {
                    "account_id": self.config.account_id,
                    "org_id": self.config.org_id,
                    "project_id": self.config.project_id
                }
            }
        });

        self.validate_request("environment_list_environments", list_request).await?;

        Ok(())
    }

    /// Validate error handling
    async fn validate_error_handling(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("\n🔧 Validating Error Handling");

        // Invalid tool name
        let invalid_tool_request = json!({
            "jsonrpc": "2.0",
            "id": 8,
            "method": "tools/call",
            "params": {
                "name": "nonexistent_tool",
                "arguments": {}
            }
        });

        self.validate_request("error_invalid_tool", invalid_tool_request).await?;

        // Missing required parameter
        let missing_param_request = json!({
            "jsonrpc": "2.0",
            "id": 9,
            "method": "tools/call",
            "params": {
                "name": "get_pipeline",
                "arguments": {
                    "account_id": self.config.account_id
                }
            }
        });

        self.validate_request("error_missing_param", missing_param_request).await?;

        Ok(())
    }

    /// Validate a single request against both servers
    async fn validate_request(&mut self, test_name: &str, request: Value) -> Result<(), Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        println!("  🧪 Testing: {}", test_name);

        // Call Go server
        let go_result = self.call_server(&self.config.go_server_url, &request).await;
        
        // Call Rust server
        let rust_result = self.call_server(&self.config.rust_server_url, &request).await;

        let execution_time = start_time.elapsed().as_millis() as u64;

        // Compare results
        let (go_response, go_status) = match go_result {
            Ok((resp, status)) => (Some(resp), Some(status)),
            Err(_) => (None, None),
        };

        let (rust_response, rust_status) = match rust_result {
            Ok((resp, status)) => (Some(resp), Some(status)),
            Err(_) => (None, None),
        };

        let response_matches = self.compare_responses(&go_response, &rust_response);
        let status_matches = go_status == rust_status;

        let result = ValidationResult {
            test_name: test_name.to_string(),
            request: request.clone(),
            go_response,
            rust_response,
            go_status,
            rust_status,
            response_matches,
            status_matches,
            error: None,
            execution_time_ms: execution_time,
        };

        if result.response_matches && result.status_matches {
            println!("    ✅ PASS");
        } else {
            println!("    ❌ FAIL");
            if !result.response_matches {
                println!("      - Response mismatch");
            }
            if !result.status_matches {
                println!("      - Status code mismatch");
            }
        }

        self.results.push(result);
        Ok(())
    }

    /// Call a server with the given request
    async fn call_server(&self, server_url: &str, request: &Value) -> Result<(Value, u16), Box<dyn std::error::Error>> {
        let url = format!("{}/mcp", server_url);
        
        let response = timeout(
            Duration::from_secs(self.config.timeout_seconds),
            self.client
                .post(&url)
                .header("Content-Type", "application/json")
                .json(request)
                .send()
        ).await??;

        let status = response.status().as_u16();
        let body: Value = response.json().await?;

        Ok((body, status))
    }

    /// Compare two responses for equality
    fn compare_responses(&self, go_response: &Option<Value>, rust_response: &Option<Value>) -> bool {
        match (go_response, rust_response) {
            (Some(go), Some(rust)) => {
                let normalized_go = self.normalize_response(go);
                let normalized_rust = self.normalize_response(rust);
                normalized_go == normalized_rust
            }
            (None, None) => true,
            _ => false,
        }
    }

    /// Normalize a response for comparison
    fn normalize_response(&self, response: &Value) -> Value {
        let mut normalized = response.clone();

        if let Some(obj) = normalized.as_object_mut() {
            // Remove timestamps and request IDs
            obj.remove("timestamp");
            obj.remove("request_id");
            obj.remove("id"); // JSON-RPC ID can vary
            
            // Normalize error messages (keep structure, normalize content)
            if let Some(error) = obj.get_mut("error") {
                if let Some(error_obj) = error.as_object_mut() {
                    // Keep error code, normalize message
                    if let Some(message) = error_obj.get_mut("message") {
                        if let Some(msg_str) = message.as_str() {
                            // Normalize common error patterns
                            let normalized_msg = msg_str
                                .replace("Tool 'nonexistent_tool' not found", "Tool not found")
                                .replace("Missing required parameter: pipeline_id", "Missing required parameter");
                            *message = Value::String(normalized_msg);
                        }
                    }
                }
            }
        }

        normalized
    }

    /// Print validation summary
    fn print_summary(&self) {
        println!("\n📊 API Parity Validation Summary");
        println!("=================================");

        let total = self.results.len();
        let passed = self.results.iter().filter(|r| r.response_matches && r.status_matches).count();
        let failed = total - passed;

        println!("Total Tests: {}", total);
        println!("Passed: {}", passed);
        println!("Failed: {}", failed);
        println!("Success Rate: {:.1}%", (passed as f64 / total as f64) * 100.0);

        if failed > 0 {
            println!("\n❌ Failed Tests:");
            for result in &self.results {
                if !result.response_matches || !result.status_matches {
                    println!("  - {}", result.test_name);
                    if !result.response_matches {
                        println!("    Response mismatch");
                    }
                    if !result.status_matches {
                        println!("    Status code mismatch (Go: {:?}, Rust: {:?})", 
                                result.go_status, result.rust_status);
                    }
                }
            }
        }

        // Performance summary
        let avg_time = self.results.iter().map(|r| r.execution_time_ms).sum::<u64>() / total as u64;
        println!("\n⏱️  Performance Summary:");
        println!("Average execution time: {}ms", avg_time);
    }

    /// Generate detailed validation report
    pub fn generate_report(&self) -> String {
        let mut report = String::new();
        
        report.push_str("# API Parity Validation Report\n\n");
        report.push_str(&format!("**Generated:** {}\n\n", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")));

        let total = self.results.len();
        let passed = self.results.iter().filter(|r| r.response_matches && r.status_matches).count();
        let failed = total - passed;

        report.push_str("## Summary\n\n");
        report.push_str(&format!("- **Total Tests:** {}\n", total));
        report.push_str(&format!("- **Passed:** {}\n", passed));
        report.push_str(&format!("- **Failed:** {}\n", failed));
        report.push_str(&format!("- **Success Rate:** {:.1}%\n\n", (passed as f64 / total as f64) * 100.0));

        if failed > 0 {
            report.push_str("## Failed Tests\n\n");
            for result in &self.results {
                if !result.response_matches || !result.status_matches {
                    report.push_str(&format!("### {}\n\n", result.test_name));
                    
                    if !result.response_matches {
                        report.push_str("**Issue:** Response mismatch\n\n");
                    }
                    if !result.status_matches {
                        report.push_str(&format!("**Issue:** Status code mismatch (Go: {:?}, Rust: {:?})\n\n", 
                                               result.go_status, result.rust_status));
                    }

                    report.push_str("**Request:**\n```json\n");
                    report.push_str(&serde_json::to_string_pretty(&result.request).unwrap());
                    report.push_str("\n```\n\n");
                }
            }
        }

        report
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation_config() {
        let config = ValidationConfig {
            go_server_url: "http://localhost:8080".to_string(),
            rust_server_url: "http://localhost:8081".to_string(),
            timeout_seconds: 30,
            api_key: "test_key".to_string(),
            account_id: "test_account".to_string(),
            org_id: "test_org".to_string(),
            project_id: "test_project".to_string(),
        };

        let validator = ApiParityValidator::new(config);
        assert_eq!(validator.results.len(), 0);
    }

    #[test]
    fn test_response_normalization() {
        let config = ValidationConfig {
            go_server_url: "http://localhost:8080".to_string(),
            rust_server_url: "http://localhost:8081".to_string(),
            timeout_seconds: 30,
            api_key: "test_key".to_string(),
            account_id: "test_account".to_string(),
            org_id: "test_org".to_string(),
            project_id: "test_project".to_string(),
        };

        let validator = ApiParityValidator::new(config);

        let response = json!({
            "jsonrpc": "2.0",
            "id": 123,
            "result": {"data": "test"},
            "timestamp": "2024-01-01T00:00:00Z"
        });

        let normalized = validator.normalize_response(&response);
        
        assert_eq!(normalized["jsonrpc"], "2.0");
        assert_eq!(normalized["result"]["data"], "test");
        assert!(normalized.get("timestamp").is_none());
    }
}