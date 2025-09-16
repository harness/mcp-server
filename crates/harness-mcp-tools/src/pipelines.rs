use crate::error::{ParameterValidator, Result, ToolError};
use crate::mcp::{Tool, ToolContent, ToolInputSchema, ToolProperty, ToolResult};
use crate::toolset::{ToolHandler, ToolDefinition};
use async_trait::async_trait;
use harness_mcp_client::{
    services::PipelineService, Client, PaginationOptions, PipelineExecutionOptions,
    PipelineListOptions, Scope,
};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error};

/// Create pipeline toolset with all pipeline-related tools
pub fn create_pipeline_toolset(client: Client) -> Vec<ToolDefinition> {
    let pipeline_service = Arc::new(PipelineService::new(client));

    vec![
        create_list_pipelines_tool(pipeline_service.clone()),
        create_get_pipeline_tool(pipeline_service.clone()),
        create_list_executions_tool(pipeline_service.clone()),
        create_get_execution_tool(pipeline_service.clone()),
    ]
}

/// Create the list pipelines tool
fn create_list_pipelines_tool(service: Arc<PipelineService>) -> ToolDefinition {
    let tool = Tool {
        name: "list_pipelines".to_string(),
        description: "List pipelines in a Harness project".to_string(),
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
                    "search_term".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Search term to filter pipelines (optional)".to_string()),
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
        handler: Arc::new(ListPipelinesHandler { service }),
    }
}

/// Create the get pipeline tool
fn create_get_pipeline_tool(service: Arc<PipelineService>) -> ToolDefinition {
    let tool = Tool {
        name: "get_pipeline".to_string(),
        description: "Get details of a specific pipeline".to_string(),
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
                    "pipeline_id".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Pipeline identifier".to_string()),
                        enum_values: None,
                    },
                );
                props
            },
            required: Some(vec!["account_id".to_string(), "pipeline_id".to_string()]),
        },
    };

    ToolDefinition {
        tool,
        handler: Arc::new(GetPipelineHandler { service }),
    }
}

/// Create the list executions tool
fn create_list_executions_tool(service: Arc<PipelineService>) -> ToolDefinition {
    let tool = Tool {
        name: "list_pipeline_executions".to_string(),
        description: "List pipeline executions".to_string(),
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
                    "pipeline_id".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Pipeline identifier (optional)".to_string()),
                        enum_values: None,
                    },
                );
                props.insert(
                    "status".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Execution status filter (optional)".to_string()),
                        enum_values: Some(vec![
                            "Success".to_string(),
                            "Failed".to_string(),
                            "Running".to_string(),
                            "Aborted".to_string(),
                        ]),
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
        handler: Arc::new(ListExecutionsHandler { service }),
    }
}

/// Create the get execution tool
fn create_get_execution_tool(service: Arc<PipelineService>) -> ToolDefinition {
    let tool = Tool {
        name: "get_pipeline_execution".to_string(),
        description: "Get details of a specific pipeline execution".to_string(),
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
                    "execution_id".to_string(),
                    ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Pipeline execution ID".to_string()),
                        enum_values: None,
                    },
                );
                props
            },
            required: Some(vec!["account_id".to_string(), "execution_id".to_string()]),
        },
    };

    ToolDefinition {
        tool,
        handler: Arc::new(GetExecutionHandler { service }),
    }
}

/// Handler for listing pipelines
struct ListPipelinesHandler {
    service: Arc<PipelineService>,
}

#[async_trait]
impl ToolHandler for ListPipelinesHandler {
    async fn execute(&self, arguments: HashMap<String, serde_json::Value>) -> Result<ToolResult> {
        debug!("Executing list_pipelines tool with arguments: {:?}", arguments);

        // Validate and extract parameters
        let account_id = ParameterValidator::require_string(&arguments, "account_id")?;
        let org_id = ParameterValidator::optional_string(&arguments, "org_id")?;
        let project_id = ParameterValidator::optional_string(&arguments, "project_id")?;
        let search_term = ParameterValidator::optional_string(&arguments, "search_term")?;
        let page = ParameterValidator::optional_integer(&arguments, "page")?.unwrap_or(0) as i32;
        let size = ParameterValidator::optional_integer(&arguments, "size")?.unwrap_or(20) as i32;

        // Create scope
        let scope = Scope::new(account_id, org_id, project_id);

        // Create list options
        let options = PipelineListOptions {
            pagination: PaginationOptions {
                page: Some(page),
                size: Some(size),
            },
            search_term,
        };

        // Call the service
        match self.service.list_pipelines(&scope, &options).await {
            Ok(response) => {
                let pipelines_json = serde_json::to_string_pretty(&response)
                    .map_err(|e| ToolError::Serialization(e))?;

                Ok(ToolResult {
                    content: vec![ToolContent::Text {
                        text: format!("Pipelines:\n{}", pipelines_json),
                    }],
                    is_error: Some(false),
                })
            }
            Err(e) => {
                error!("Failed to list pipelines: {}", e);
                Ok(ToolError::execution_failed(format!("Failed to list pipelines: {}", e))
                    .to_tool_result())
            }
        }
    }
}

/// Handler for getting pipeline details
struct GetPipelineHandler {
    service: Arc<PipelineService>,
}

#[async_trait]
impl ToolHandler for GetPipelineHandler {
    async fn execute(&self, arguments: HashMap<String, serde_json::Value>) -> Result<ToolResult> {
        debug!("Executing get_pipeline tool with arguments: {:?}", arguments);

        // Validate and extract parameters
        let account_id = ParameterValidator::require_string(&arguments, "account_id")?;
        let org_id = ParameterValidator::optional_string(&arguments, "org_id")?;
        let project_id = ParameterValidator::optional_string(&arguments, "project_id")?;
        let pipeline_id = ParameterValidator::require_string(&arguments, "pipeline_id")?;

        // Create scope
        let scope = Scope::new(account_id, org_id, project_id);

        // Call the service
        match self.service.get_pipeline(&scope, &pipeline_id).await {
            Ok(response) => {
                let pipeline_json = serde_json::to_string_pretty(&response)
                    .map_err(|e| ToolError::Serialization(e))?;

                Ok(ToolResult {
                    content: vec![ToolContent::Text {
                        text: format!("Pipeline Details:\n{}", pipeline_json),
                    }],
                    is_error: Some(false),
                })
            }
            Err(e) => {
                error!("Failed to get pipeline {}: {}", pipeline_id, e);
                Ok(ToolError::execution_failed(format!(
                    "Failed to get pipeline {}: {}",
                    pipeline_id, e
                ))
                .to_tool_result())
            }
        }
    }
}

/// Handler for listing pipeline executions
struct ListExecutionsHandler {
    service: Arc<PipelineService>,
}

#[async_trait]
impl ToolHandler for ListExecutionsHandler {
    async fn execute(&self, arguments: HashMap<String, serde_json::Value>) -> Result<ToolResult> {
        debug!(
            "Executing list_pipeline_executions tool with arguments: {:?}",
            arguments
        );

        // Validate and extract parameters
        let account_id = ParameterValidator::require_string(&arguments, "account_id")?;
        let org_id = ParameterValidator::optional_string(&arguments, "org_id")?;
        let project_id = ParameterValidator::optional_string(&arguments, "project_id")?;
        let pipeline_id = ParameterValidator::optional_string(&arguments, "pipeline_id")?;
        let status = ParameterValidator::optional_string(&arguments, "status")?;
        let page = ParameterValidator::optional_integer(&arguments, "page")?.unwrap_or(0) as i32;
        let size = ParameterValidator::optional_integer(&arguments, "size")?.unwrap_or(20) as i32;

        // Create scope
        let scope = Scope::new(account_id, org_id, project_id);

        // Create execution options
        let options = PipelineExecutionOptions {
            pagination: PaginationOptions {
                page: Some(page),
                size: Some(size),
            },
            status,
            pipeline_identifier: pipeline_id,
            my_deployments: None,
            branch: None,
            search_term: None,
            pipeline_tags: None,
        };

        // Call the service
        match self.service.list_executions(&scope, &options).await {
            Ok(response) => {
                let executions_json = serde_json::to_string_pretty(&response)
                    .map_err(|e| ToolError::Serialization(e))?;

                Ok(ToolResult {
                    content: vec![ToolContent::Text {
                        text: format!("Pipeline Executions:\n{}", executions_json),
                    }],
                    is_error: Some(false),
                })
            }
            Err(e) => {
                error!("Failed to list pipeline executions: {}", e);
                Ok(ToolError::execution_failed(format!(
                    "Failed to list pipeline executions: {}",
                    e
                ))
                .to_tool_result())
            }
        }
    }
}

/// Handler for getting pipeline execution details
struct GetExecutionHandler {
    service: Arc<PipelineService>,
}

#[async_trait]
impl ToolHandler for GetExecutionHandler {
    async fn execute(&self, arguments: HashMap<String, serde_json::Value>) -> Result<ToolResult> {
        debug!(
            "Executing get_pipeline_execution tool with arguments: {:?}",
            arguments
        );

        // Validate and extract parameters
        let account_id = ParameterValidator::require_string(&arguments, "account_id")?;
        let org_id = ParameterValidator::optional_string(&arguments, "org_id")?;
        let project_id = ParameterValidator::optional_string(&arguments, "project_id")?;
        let execution_id = ParameterValidator::require_string(&arguments, "execution_id")?;

        // Create scope
        let scope = Scope::new(account_id, org_id, project_id);

        // Call the service
        match self.service.get_execution(&scope, &execution_id).await {
            Ok(response) => {
                let execution_json = serde_json::to_string_pretty(&response)
                    .map_err(|e| ToolError::Serialization(e))?;

                Ok(ToolResult {
                    content: vec![ToolContent::Text {
                        text: format!("Pipeline Execution Details:\n{}", execution_json),
                    }],
                    is_error: Some(false),
                })
            }
            Err(e) => {
                error!("Failed to get pipeline execution {}: {}", execution_id, e);
                Ok(ToolError::execution_failed(format!(
                    "Failed to get pipeline execution {}: {}",
                    execution_id, e
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
    async fn test_create_pipeline_toolset() {
        let auth_provider = Box::new(ApiKeyProvider::new("pat.test.key.sig".to_string()));
        let client = ClientBuilder::new()
            .base_url(Url::parse("https://app.harness.io").unwrap())
            .auth_provider(auth_provider)
            .build()
            .unwrap();

        let tools = create_pipeline_toolset(client);
        assert_eq!(tools.len(), 4);

        let tool_names: Vec<&str> = tools.iter().map(|t| t.tool.name.as_str()).collect();
        assert!(tool_names.contains(&"list_pipelines"));
        assert!(tool_names.contains(&"get_pipeline"));
        assert!(tool_names.contains(&"list_pipeline_executions"));
        assert!(tool_names.contains(&"get_pipeline_execution"));
    }

    #[test]
    fn test_parameter_validation() {
        let mut params = HashMap::new();
        params.insert(
            "account_id".to_string(),
            serde_json::Value::String("test_account".to_string()),
        );
        params.insert(
            "page".to_string(),
            serde_json::Value::Number(serde_json::Number::from(1)),
        );

        let account_id = ParameterValidator::require_string(&params, "account_id").unwrap();
        assert_eq!(account_id, "test_account");

        let page = ParameterValidator::optional_integer(&params, "page").unwrap();
        assert_eq!(page, Some(1));

        let missing = ParameterValidator::optional_string(&params, "missing").unwrap();
        assert_eq!(missing, None);
    }
}