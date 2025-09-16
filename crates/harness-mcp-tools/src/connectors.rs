use crate::error::{ParameterValidator, Result, ToolError};
use crate::mcp::{Tool, ToolContent, ToolInputSchema, ToolProperty, ToolResult};
use crate::toolset::{ToolHandler, ToolDefinition};
use async_trait::async_trait;
use harness_mcp_client::{services::ConnectorService, Client, PaginationOptions, Scope};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error};

/// Create connector toolset with all connector-related tools
pub fn create_connector_toolset(client: Client) -> Vec<ToolDefinition> {
    let connector_service = Arc::new(ConnectorService::new(client));

    vec![
        create_list_connectors_tool(connector_service.clone()),
        create_get_connector_tool(connector_service.clone()),
    ]
}

/// Create the list connectors tool
fn create_list_connectors_tool(service: Arc<ConnectorService>) -> ToolDefinition {
    let tool = Tool {
        name: "list_connectors".to_string(),
        description: "List connectors in a Harness account, organization, or project".to_string(),
        input_schema: ToolInputSchema {
            schema_type: "object".to_string(),
            properties: {
                let mut props = HashMap::new();
                props.insert(
                    "account_id".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Harness account ID".to_string()),
                        enum_values: None,
                    },
                );
                props.insert(
                    "org_id".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Organization ID (optional)".to_string()),
                        enum_values: None,
                    },
                );
                props.insert(
                    "project_id".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Project ID (optional)".to_string()),
                        enum_values: None,
                    },
                );
                props.insert(
                    "page".to_string(),
                    ToolProperty {
                        property_type: "integer".to_string(),
                        description: Some("Page number (default: 0)".to_string()),
                        enum_values: None,
                    },
                );
                props.insert(
                    "size".to_string(),
                    ToolProperty {
                        property_type: "integer".to_string(),
                        description: Some("Page size (default: 20)".to_string()),
                        enum_values: None,
                    },
                );
                props
            },
            required: Some(vec!["account_id".to_string()]),
        },
    };

    ToolDefinition {
        tool,
        handler: Arc::new(ListConnectorsHandler { service }),
    }
}

/// Create the get connector tool
fn create_get_connector_tool(service: Arc<ConnectorService>) -> ToolDefinition {
    let tool = Tool {
        name: "get_connector".to_string(),
        description: "Get details of a specific connector".to_string(),
        input_schema: ToolInputSchema {
            schema_type: "object".to_string(),
            properties: {
                let mut props = HashMap::new();
                props.insert(
                    "account_id".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Harness account ID".to_string()),
                        enum_values: None,
                    },
                );
                props.insert(
                    "org_id".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Organization ID (optional)".to_string()),
                        enum_values: None,
                    },
                );
                props.insert(
                    "project_id".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Project ID (optional)".to_string()),
                        enum_values: None,
                    },
                );
                props.insert(
                    "connector_id".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Connector identifier".to_string()),
                        enum_values: None,
                    },
                );
                props
            },
            required: Some(vec!["account_id".to_string(), "connector_id".to_string()]),
        },
    };

    ToolDefinition {
        tool,
        handler: Arc::new(GetConnectorHandler { service }),
    }
}

/// Handler for listing connectors
struct ListConnectorsHandler {
    service: Arc<ConnectorService>,
}

#[async_trait]
impl ToolHandler for ListConnectorsHandler {
    async fn execute(&self, arguments: HashMap<String, serde_json::Value>) -> Result<ToolResult> {
        debug!("Executing list_connectors tool with arguments: {:?}", arguments);

        // Validate and extract parameters
        let account_id = ParameterValidator::require_string(&arguments, "account_id")?;
        let org_id = ParameterValidator::optional_string(&arguments, "org_id")?;
        let project_id = ParameterValidator::optional_string(&arguments, "project_id")?;
        let page = ParameterValidator::optional_integer(&arguments, "page")?.unwrap_or(0) as i32;
        let size = ParameterValidator::optional_integer(&arguments, "size")?.unwrap_or(20) as i32;

        // Create scope
        let scope = Scope::new(account_id, org_id, project_id);

        // Create pagination options
        let options = PaginationOptions {
            page: Some(page),
            size: Some(size),
        };

        // Call the service
        match self.service.list_connectors(&scope, &options).await {
            Ok(response) => {
                let connectors_json = serde_json::to_string_pretty(&response)
                    .map_err(|e| ToolError::Serialization(e))?;

                Ok(ToolResult {
                    content: vec![ToolContent::Text {
                        text: format!("Connectors:\n{}", connectors_json),
                    }],
                    is_error: Some(false),
                })
            }
            Err(e) => {
                error!("Failed to list connectors: {}", e);
                Ok(ToolError::execution_failed(format!("Failed to list connectors: {}", e))
                    .to_tool_result())
            }
        }
    }
}

/// Handler for getting connector details
struct GetConnectorHandler {
    service: Arc<ConnectorService>,
}

#[async_trait]
impl ToolHandler for GetConnectorHandler {
    async fn execute(&self, arguments: HashMap<String, serde_json::Value>) -> Result<ToolResult> {
        debug!("Executing get_connector tool with arguments: {:?}", arguments);

        // Validate and extract parameters
        let account_id = ParameterValidator::require_string(&arguments, "account_id")?;
        let org_id = ParameterValidator::optional_string(&arguments, "org_id")?;
        let project_id = ParameterValidator::optional_string(&arguments, "project_id")?;
        let connector_id = ParameterValidator::require_string(&arguments, "connector_id")?;

        // Create scope
        let scope = Scope::new(account_id, org_id, project_id);

        // Call the service
        match self.service.get_connector(&scope, &connector_id).await {
            Ok(response) => {
                let connector_json = serde_json::to_string_pretty(&response)
                    .map_err(|e| ToolError::Serialization(e))?;

                Ok(ToolResult {
                    content: vec![ToolContent::Text {
                        text: format!("Connector Details:\n{}", connector_json),
                    }],
                    is_error: Some(false),
                })
            }
            Err(e) => {
                error!("Failed to get connector {}: {}", connector_id, e);
                Ok(ToolError::execution_failed(format!(
                    "Failed to get connector {}: {}",
                    connector_id, e
                ))
                .to_tool_result())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use harness_mcp_auth::ApiKeyProvider;
    use harness_mcp_client::ClientBuilder;
    use url::Url;

    #[tokio::test]
    async fn test_create_connector_toolset() {
        let auth_provider = Box::new(ApiKeyProvider::new("pat.test.key.sig".to_string()));
        let client = ClientBuilder::new()
            .base_url(Url::parse("https://app.harness.io").unwrap())
            .auth_provider(auth_provider)
            .build()
            .unwrap();

        let tools = create_connector_toolset(client);
        assert_eq!(tools.len(), 2);

        let tool_names: Vec<&str> = tools.iter().map(|t| t.tool.name.as_str()).collect();
        assert!(tool_names.contains(&"list_connectors"));
        assert!(tool_names.contains(&"get_connector"));
    }

    #[test]
    fn test_connector_tool_schemas() {
        let auth_provider = Box::new(ApiKeyProvider::new("pat.test.key.sig".to_string()));
        let client = ClientBuilder::new()
            .base_url(Url::parse("https://app.harness.io").unwrap())
            .auth_provider(auth_provider)
            .build()
            .unwrap();

        let tools = create_connector_toolset(client);
        
        // Test list connectors tool schema
        let list_tool = &tools[0];
        assert_eq!(list_tool.tool.name, "list_connectors");
        assert!(list_tool.tool.input_schema.properties.contains_key("account_id"));
        assert!(list_tool.tool.input_schema.properties.contains_key("org_id"));
        assert!(list_tool.tool.input_schema.properties.contains_key("project_id"));
        assert!(list_tool.tool.input_schema.properties.contains_key("page"));
        assert!(list_tool.tool.input_schema.properties.contains_key("size"));
        
        // Test get connector tool schema
        let get_tool = &tools[1];
        assert_eq!(get_tool.tool.name, "get_connector");
        assert!(get_tool.tool.input_schema.properties.contains_key("account_id"));
        assert!(get_tool.tool.input_schema.properties.contains_key("connector_id"));
    }
}