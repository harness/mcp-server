use harness_mcp_auth::provider::AuthProvider;
use harness_mcp_config::Config;
use harness_mcp_tools::{ToolError, ToolRegistry};
use serde_json::json;
use tokio;

#[tokio::test]
async fn test_tool_registry_creation() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        account_id: "test_account".to_string(),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let registry = ToolRegistry::new(&config, &auth_provider).await;

    assert!(
        registry.is_ok(),
        "Expected tool registry creation to succeed"
    );
}

#[tokio::test]
async fn test_list_tools() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        account_id: "test_account".to_string(),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let registry = ToolRegistry::new(&config, &auth_provider)
        .await
        .expect("Failed to create tool registry");

    let tools = registry.list_tools().await.expect("Failed to list tools");

    assert!(
        !tools.is_empty(),
        "Expected at least one tool to be registered"
    );

    // Check that we have pipeline tools
    let pipeline_tools: Vec<_> = tools
        .iter()
        .filter(|tool| {
            let name = tool["name"].as_str().unwrap_or("");
            name.contains("pipeline") || name == "get_pipeline" || name == "list_pipelines"
        })
        .collect();

    assert!(
        !pipeline_tools.is_empty(),
        "Expected to find pipeline tools"
    );

    // Check that we have connector tools
    let connector_tools: Vec<_> = tools
        .iter()
        .filter(|tool| {
            let name = tool["name"].as_str().unwrap_or("");
            name.contains("connector") || name == "get_connector" || name == "list_connectors"
        })
        .collect();

    assert!(
        !connector_tools.is_empty(),
        "Expected to find connector tools"
    );
}

#[tokio::test]
async fn test_call_nonexistent_tool() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        account_id: "test_account".to_string(),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let registry = ToolRegistry::new(&config, &auth_provider)
        .await
        .expect("Failed to create tool registry");

    let request = json!({
        "name": "nonexistent_tool",
        "arguments": {}
    });

    let result = registry.call_tool(request).await;

    assert!(result.is_err(), "Expected error for nonexistent tool");

    match result.unwrap_err() {
        ToolError::NotFound(name) => {
            assert_eq!(name, "nonexistent_tool");
        }
        other => {
            panic!("Expected NotFound error, got: {:?}", other);
        }
    }
}

#[tokio::test]
async fn test_call_tool_with_invalid_request() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        account_id: "test_account".to_string(),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let registry = ToolRegistry::new(&config, &auth_provider)
        .await
        .expect("Failed to create tool registry");

    // Request without name
    let request = json!({
        "arguments": {}
    });

    let result = registry.call_tool(request).await;

    assert!(result.is_err(), "Expected error for request without name");

    match result.unwrap_err() {
        ToolError::InvalidParameters(_) => {
            // Expected
        }
        other => {
            panic!("Expected InvalidParameters error, got: {:?}", other);
        }
    }
}

#[tokio::test]
async fn test_call_pipeline_tool_with_missing_params() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        account_id: "test_account".to_string(),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let registry = ToolRegistry::new(&config, &auth_provider)
        .await
        .expect("Failed to create tool registry");

    let request = json!({
        "name": "get_pipeline",
        "arguments": {
            // Missing required parameters
        }
    });

    let result = registry.call_tool(request).await;

    assert!(result.is_err(), "Expected error for missing parameters");

    match result.unwrap_err() {
        ToolError::InvalidParameters(_) => {
            // Expected
        }
        other => {
            panic!("Expected InvalidParameters error, got: {:?}", other);
        }
    }
}

#[tokio::test]
async fn test_call_connector_tool_with_missing_params() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        account_id: "test_account".to_string(),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let registry = ToolRegistry::new(&config, &auth_provider)
        .await
        .expect("Failed to create tool registry");

    let request = json!({
        "name": "get_connector",
        "arguments": {
            // Missing required parameters
        }
    });

    let result = registry.call_tool(request).await;

    assert!(result.is_err(), "Expected error for missing parameters");

    match result.unwrap_err() {
        ToolError::InvalidParameters(_) => {
            // Expected
        }
        other => {
            panic!("Expected InvalidParameters error, got: {:?}", other);
        }
    }
}

#[tokio::test]
async fn test_tool_error_types() {
    // Test different error types
    let invalid_params_error = ToolError::InvalidParameters("Missing parameter".to_string());
    let error_string = format!("{}", invalid_params_error);
    assert!(error_string.contains("Missing parameter"));

    let not_found_error = ToolError::NotFound("tool_name".to_string());
    let error_string = format!("{}", not_found_error);
    assert!(error_string.contains("tool_name"));

    let execution_failed_error = ToolError::ExecutionFailed("Execution failed".to_string());
    let error_string = format!("{}", execution_failed_error);
    assert!(error_string.contains("Execution failed"));

    let tool_execution_failed_error = ToolError::ToolExecutionFailed {
        tool: "test_tool".to_string(),
        params: "test_params".to_string(),
        reason: "test_reason".to_string(),
    };
    let error_string = format!("{}", tool_execution_failed_error);
    assert!(error_string.contains("test_tool"));
    assert!(error_string.contains("test_params"));
    assert!(error_string.contains("test_reason"));
}

#[cfg(test)]
mod unit_tests {
    use super::*;
    use harness_mcp_tools::connector::ConnectorTools;
    use harness_mcp_tools::pipeline::PipelineTools;

    #[test]
    fn test_tool_error_display() {
        let error = ToolError::InvalidParameters("Test parameter error".to_string());
        let display = format!("{}", error);
        assert!(display.contains("Test parameter error"));
    }

    #[test]
    fn test_tool_error_debug() {
        let error = ToolError::NotFound("test_tool".to_string());
        let debug = format!("{:?}", error);
        assert!(debug.contains("NotFound"));
        assert!(debug.contains("test_tool"));
    }
}
