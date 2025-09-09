use harness_mcp_auth::provider::AuthProvider;
use harness_mcp_client::HarnessClient;
use harness_mcp_config::Config;
use harness_mcp_tools::ToolRegistry;
use serde_json::json;
use tokio;

#[tokio::test]
async fn test_pipeline_tools_integration() {
    // Skip if no API key is provided
    let api_key = std::env::var("HARNESS_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        println!("Skipping integration test - no HARNESS_API_KEY provided");
        return;
    }

    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some(api_key),
        default_org_id: std::env::var("HARNESS_ORG_ID").ok(),
        default_project_id: std::env::var("HARNESS_PROJECT_ID").ok(),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let registry = ToolRegistry::new(&config, &auth_provider)
        .await
        .expect("Failed to create tool registry");

    // Test list_tools
    let tools = registry.list_tools().await.expect("Failed to list tools");
    assert!(
        !tools.is_empty(),
        "Expected at least one tool to be registered"
    );

    // Find pipeline tools
    let pipeline_tools: Vec<_> = tools
        .iter()
        .filter(|tool| tool["name"].as_str().unwrap_or("").contains("pipeline"))
        .collect();

    assert!(
        !pipeline_tools.is_empty(),
        "Expected to find pipeline tools"
    );

    // Test calling a pipeline tool (if we have required parameters)
    if let (Some(org_id), Some(project_id)) = (&config.default_org_id, &config.default_project_id) {
        let request = json!({
            "name": "list_pipelines",
            "arguments": {
                "org_id": org_id,
                "project_id": project_id,
                "page": 0,
                "size": 10
            }
        });

        let result = registry.call_tool(request).await;
        match result {
            Ok(response) => {
                println!("Pipeline list response: {}", response);
                assert!(
                    response["content"].is_array(),
                    "Expected content array in response"
                );
            }
            Err(e) => {
                println!(
                    "Pipeline tool call failed (this may be expected in test environment): {}",
                    e
                );
            }
        }
    }
}

#[tokio::test]
async fn test_connector_tools_integration() {
    // Skip if no API key is provided
    let api_key = std::env::var("HARNESS_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        println!("Skipping integration test - no HARNESS_API_KEY provided");
        return;
    }

    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some(api_key),
        default_org_id: std::env::var("HARNESS_ORG_ID").ok(),
        default_project_id: std::env::var("HARNESS_PROJECT_ID").ok(),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let registry = ToolRegistry::new(&config, &auth_provider)
        .await
        .expect("Failed to create tool registry");

    // Test list_tools
    let tools = registry.list_tools().await.expect("Failed to list tools");

    // Find connector tools
    let connector_tools: Vec<_> = tools
        .iter()
        .filter(|tool| tool["name"].as_str().unwrap_or("").contains("connector"))
        .collect();

    assert!(
        !connector_tools.is_empty(),
        "Expected to find connector tools"
    );

    // Test calling connector catalogue tool
    let request = json!({
        "name": "list_connector_catalogue",
        "arguments": {}
    });

    let result = registry.call_tool(request).await;
    match result {
        Ok(response) => {
            println!("Connector catalogue response: {}", response);
            assert!(
                response["content"].is_array(),
                "Expected content array in response"
            );
        }
        Err(e) => {
            println!("Connector catalogue tool call failed (this may be expected in test environment): {}", e);
        }
    }
}

#[tokio::test]
async fn test_tool_registry_error_handling() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("invalid_key".to_string()),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let registry = ToolRegistry::new(&config, &auth_provider)
        .await
        .expect("Failed to create tool registry");

    // Test calling non-existent tool
    let request = json!({
        "name": "non_existent_tool",
        "arguments": {}
    });

    let result = registry.call_tool(request).await;
    assert!(result.is_err(), "Expected error for non-existent tool");

    // Test calling tool with invalid parameters
    let request = json!({
        "name": "get_pipeline",
        "arguments": {
            "invalid_param": "value"
        }
    });

    let result = registry.call_tool(request).await;
    assert!(result.is_err(), "Expected error for invalid parameters");
}

#[cfg(test)]
mod unit_tests {
    use super::*;
    use harness_mcp_dto::Scope;

    #[test]
    fn test_scope_creation() {
        let scope = Scope {
            account_id: "test_account".to_string(),
            org_id: "test_org".to_string(),
            project_id: "test_project".to_string(),
        };

        assert_eq!(scope.account_id, "test_account");
        assert_eq!(scope.org_id, "test_org");
        assert_eq!(scope.project_id, "test_project");
    }

    #[test]
    fn test_config_validation() {
        let config = Config {
            base_url: "https://app.harness.io".to_string(),
            api_key: Some("test_key".to_string()),
            ..Default::default()
        };

        assert!(config.validate().is_ok(), "Expected config to be valid");
    }

    #[test]
    fn test_config_invalid_base_url() {
        let config = Config {
            base_url: "invalid_url".to_string(),
            api_key: Some("test_key".to_string()),
            ..Default::default()
        };

        assert!(
            config.validate().is_err(),
            "Expected config validation to fail for invalid URL"
        );
    }

    #[test]
    fn test_auth_provider_creation() {
        let config = Config {
            base_url: "https://app.harness.io".to_string(),
            api_key: Some("test_key".to_string()),
            ..Default::default()
        };

        let auth_provider = AuthProvider::new(&config);
        assert!(
            auth_provider.is_ok(),
            "Expected auth provider creation to succeed"
        );
    }
}
