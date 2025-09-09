use crate::{connector::ConnectorTools, pipeline::PipelineTools};
use harness_mcp_auth::AuthProvider;
use harness_mcp_client::HarnessClient;
use harness_mcp_config::Config;
use serde_json::Value;
use std::collections::HashMap;
use thiserror::Error;
use tracing::{debug, error, info, warn};

pub type Result<T> = std::result::Result<T, ToolError>;

#[derive(Error, Debug)]
pub enum ToolError {
    #[error("Tool not found: {0}")]
    NotFound(String),

    #[error("Invalid tool parameters: {0}")]
    InvalidParameters(String),

    #[error("Tool execution failed: {0}")]
    ExecutionFailed(String),

    #[error("Client error: {0}")]
    Client(#[from] harness_mcp_client::Error),

    #[error("Configuration error: {0}")]
    Config(#[from] harness_mcp_config::ConfigError),

    #[error("Authentication error: {0}")]
    Auth(#[from] harness_mcp_auth::AuthError),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Tool '{tool}' failed with parameters {params}: {reason}")]
    ToolExecutionFailed {
        tool: String,
        params: String,
        reason: String,
    },
}

#[derive(Clone)]
pub struct ToolRegistry {
    tools: HashMap<String, ToolDefinition>,
    pipeline_tools: PipelineTools,
    connector_tools: ConnectorTools,
}

#[derive(Clone)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Value,
    // Handler function would be stored here in a real implementation
}

impl ToolRegistry {
    pub async fn new(config: &Config, auth_provider: &AuthProvider) -> Result<Self> {
        info!("Initializing tool registry");

        // Create Harness client
        let client = HarnessClient::new(config, auth_provider.clone()).map_err(|e| {
            error!("Failed to create Harness client: {}", e);
            ToolError::ExecutionFailed(format!("Failed to create client: {}", e))
        })?;

        let mut registry = Self {
            tools: HashMap::new(),
            pipeline_tools: PipelineTools::new(client.clone()),
            connector_tools: ConnectorTools::new(client),
        };

        // Register tools based on enabled toolsets
        debug!("Registering default tools");
        registry
            .register_default_tools(config, auth_provider)
            .await?;

        info!(
            "Tool registry initialized with {} tools",
            registry.tools.len()
        );
        Ok(registry)
    }

    pub async fn list_tools(&self) -> Result<Vec<Value>> {
        let tools: Vec<Value> = self
            .tools
            .values()
            .map(|tool| {
                serde_json::json!({
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": tool.parameters
                })
            })
            .collect();

        Ok(tools)
    }

    pub async fn call_tool(&self, request: Value) -> Result<Value> {
        let tool_name = request["name"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing tool name".to_string()))?;

        debug!("Calling tool: {} with request: {}", tool_name, request);

        let _tool = self.tools.get(tool_name).ok_or_else(|| {
            warn!("Tool not found: {}", tool_name);
            ToolError::NotFound(tool_name.to_string())
        })?;

        let arguments = request["arguments"].clone();
        info!("Executing tool: {}", tool_name);

        // Route to appropriate tool handler
        match tool_name {
            "get_pipeline" => self.pipeline_tools.get_pipeline(arguments).await,
            "list_pipelines" => self.pipeline_tools.list_pipelines(arguments).await,
            "get_pipeline_executions" => {
                self.pipeline_tools.get_pipeline_executions(arguments).await
            }
            "get_connector" => self.connector_tools.get_connector(arguments).await,
            "list_connectors" => self.connector_tools.list_connectors(arguments).await,
            "list_connector_catalogue" => {
                self.connector_tools
                    .list_connector_catalogue(arguments)
                    .await
            }
            _ => Ok(serde_json::json!({
                "content": [{
                    "type": "text",
                    "text": format!("Tool {} is not yet implemented", tool_name)
                }]
            })),
        }
    }

    async fn register_default_tools(
        &mut self,
        _config: &Config,
        _auth_provider: &AuthProvider,
    ) -> Result<()> {
        // Register pipeline tools
        self.tools.insert(
            "get_pipeline".to_string(),
            ToolDefinition {
                name: "get_pipeline".to_string(),
                description: "Get details of a specific pipeline".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "pipeline_id": {
                            "type": "string",
                            "description": "The ID of the pipeline"
                        },
                        "org_id": {
                            "type": "string",
                            "description": "Organization ID"
                        },
                        "project_id": {
                            "type": "string",
                            "description": "Project ID"
                        }
                    },
                    "required": ["pipeline_id", "org_id", "project_id"]
                }),
            },
        );

        self.tools.insert(
            "list_pipelines".to_string(),
            ToolDefinition {
                name: "list_pipelines".to_string(),
                description: "List pipelines in a project".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "org_id": {
                            "type": "string",
                            "description": "Organization ID"
                        },
                        "project_id": {
                            "type": "string",
                            "description": "Project ID"
                        },
                        "page": {
                            "type": "integer",
                            "description": "Page number (optional)"
                        },
                        "size": {
                            "type": "integer",
                            "description": "Page size (optional)"
                        },
                        "search_term": {
                            "type": "string",
                            "description": "Search term to filter pipelines (optional)"
                        }
                    },
                    "required": ["org_id", "project_id"]
                }),
            },
        );

        self.tools.insert(
            "get_pipeline_executions".to_string(),
            ToolDefinition {
                name: "get_pipeline_executions".to_string(),
                description: "Get recent executions for a pipeline".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "pipeline_id": {
                            "type": "string",
                            "description": "The ID of the pipeline"
                        },
                        "org_id": {
                            "type": "string",
                            "description": "Organization ID"
                        },
                        "project_id": {
                            "type": "string",
                            "description": "Project ID"
                        }
                    },
                    "required": ["pipeline_id", "org_id", "project_id"]
                }),
            },
        );

        // Register connector tools
        self.tools.insert(
            "get_connector".to_string(),
            ToolDefinition {
                name: "get_connector".to_string(),
                description: "Get details of a specific connector".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "connector_id": {
                            "type": "string",
                            "description": "The ID of the connector"
                        },
                        "org_id": {
                            "type": "string",
                            "description": "Organization ID"
                        },
                        "project_id": {
                            "type": "string",
                            "description": "Project ID"
                        }
                    },
                    "required": ["connector_id", "org_id", "project_id"]
                }),
            },
        );

        self.tools.insert(
            "list_connectors".to_string(),
            ToolDefinition {
                name: "list_connectors".to_string(),
                description: "List connectors in a project".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "org_id": {
                            "type": "string",
                            "description": "Organization ID"
                        },
                        "project_id": {
                            "type": "string",
                            "description": "Project ID"
                        },
                        "page": {
                            "type": "integer",
                            "description": "Page number (optional)"
                        },
                        "size": {
                            "type": "integer",
                            "description": "Page size (optional)"
                        }
                    },
                    "required": ["org_id", "project_id"]
                }),
            },
        );

        self.tools.insert(
            "list_connector_catalogue".to_string(),
            ToolDefinition {
                name: "list_connector_catalogue".to_string(),
                description: "List available connector types from the catalogue".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {},
                    "required": []
                }),
            },
        );

        // Add more tools as needed...

        Ok(())
    }
}
