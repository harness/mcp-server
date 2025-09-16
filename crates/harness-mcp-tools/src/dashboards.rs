use crate::error::{ParameterValidator, Result, ToolError};
use crate::mcp::{Tool, ToolContent, ToolInputSchema, ToolProperty, ToolResult};
use crate::toolset::{ToolHandler, ToolDefinition};
use async_trait::async_trait;
use harness_mcp_client::{services::DashboardService, Client, Scope};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error};

/// Create dashboard toolset with all dashboard-related tools
pub fn create_dashboard_toolset(client: Client) -> Vec<ToolDefinition> {
    let dashboard_service = Arc::new(DashboardService::new(client));

    vec![
        create_list_dashboards_tool(dashboard_service.clone()),
        create_get_dashboard_tool(dashboard_service.clone()),
    ]
}

/// Create the list dashboards tool
fn create_list_dashboards_tool(service: Arc<DashboardService>) -> ToolDefinition {
    let tool = Tool {
        name: "list_dashboards".to_string(),
        description: "List dashboards in a Harness account".to_string(),
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
                props
            },
            required: Some(vec!["account_id".to_string()]),
        },
    };

    ToolDefinition {
        tool,
        handler: Arc::new(ListDashboardsHandler { service }),
    }
}

/// Create the get dashboard tool
fn create_get_dashboard_tool(service: Arc<DashboardService>) -> ToolDefinition {
    let tool = Tool {
        name: "get_dashboard".to_string(),
        description: "Get details of a specific dashboard".to_string(),
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
                    "dashboard_id".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Dashboard identifier".to_string()),
                        enum_values: None,
                    },
                );
                props
            },
            required: Some(vec!["account_id".to_string(), "dashboard_id".to_string()]),
        },
    };

    ToolDefinition {
        tool,
        handler: Arc::new(GetDashboardHandler { service }),
    }
}

/// Handler for listing dashboards
struct ListDashboardsHandler {
    service: Arc<DashboardService>,
}

#[async_trait]
impl ToolHandler for ListDashboardsHandler {
    async fn execute(&self, arguments: HashMap<String, serde_json::Value>) -> Result<ToolResult> {
        debug!("Executing list_dashboards tool with arguments: {:?}", arguments);

        // Validate and extract parameters
        let account_id = ParameterValidator::require_string(&arguments, "account_id")?;

        // Create scope (dashboards are account-level)
        let scope = Scope::account(account_id);

        // Call the service
        match self.service.list_dashboards(&scope).await {
            Ok(response) => {
                let dashboards_json = serde_json::to_string_pretty(&response)
                    .map_err(|e| ToolError::Serialization(e))?;

                Ok(ToolResult {
                    content: vec![ToolContent::Text {
                        text: format!("Dashboards:\n{}", dashboards_json),
                    }],
                    is_error: Some(false),
                })
            }
            Err(e) => {
                error!("Failed to list dashboards: {}", e);
                Ok(ToolError::execution_failed(format!("Failed to list dashboards: {}", e))
                    .to_tool_result())
            }
        }
    }
}

/// Handler for getting dashboard details
struct GetDashboardHandler {
    service: Arc<DashboardService>,
}

#[async_trait]
impl ToolHandler for GetDashboardHandler {
    async fn execute(&self, arguments: HashMap<String, serde_json::Value>) -> Result<ToolResult> {
        debug!("Executing get_dashboard tool with arguments: {:?}", arguments);

        // Validate and extract parameters
        let account_id = ParameterValidator::require_string(&arguments, "account_id")?;
        let dashboard_id = ParameterValidator::require_string(&arguments, "dashboard_id")?;

        // Create scope (dashboards are account-level)
        let scope = Scope::account(account_id);

        // Call the service
        match self.service.get_dashboard_data(&scope, &dashboard_id).await {
            Ok(response) => {
                let dashboard_json = serde_json::to_string_pretty(&response)
                    .map_err(|e| ToolError::Serialization(e))?;

                Ok(ToolResult {
                    content: vec![ToolContent::Text {
                        text: format!("Dashboard Details:\n{}", dashboard_json),
                    }],
                    is_error: Some(false),
                })
            }
            Err(e) => {
                error!("Failed to get dashboard {}: {}", dashboard_id, e);
                Ok(ToolError::execution_failed(format!(
                    "Failed to get dashboard {}: {}",
                    dashboard_id, e
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
    async fn test_create_dashboard_toolset() {
        let auth_provider = Box::new(ApiKeyProvider::new("pat.test.key.sig".to_string()));
        let client = ClientBuilder::new()
            .base_url(Url::parse("https://app.harness.io").unwrap())
            .auth_provider(auth_provider)
            .build()
            .unwrap();

        let tools = create_dashboard_toolset(client);
        assert_eq!(tools.len(), 2);

        let tool_names: Vec<&str> = tools.iter().map(|t| t.tool.name.as_str()).collect();
        assert!(tool_names.contains(&"list_dashboards"));
        assert!(tool_names.contains(&"get_dashboard"));
    }
}