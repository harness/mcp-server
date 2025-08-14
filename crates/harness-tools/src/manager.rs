use crate::{ToolError, ToolsetGroup, Tool, ToolResult, params::ToolRequest};
use harness_config::Config;
use harness_client::HarnessClient;
use std::sync::Arc;
use std::collections::HashMap;
use tracing::{info, debug, error};
use serde_json::Value;

/// Toolset manager
/// Migrated from Go toolset management logic
pub struct ToolsetManager {
    config: Arc<Config>,
    toolsets: ToolsetGroup,
    clients: HashMap<String, Arc<HarnessClient>>,
}

impl ToolsetManager {
    /// Create a new toolset manager
    pub async fn new(config: Arc<Config>) -> Result<Self, ToolError> {
        info!("Initializing toolset manager");
        
        let mut toolsets = ToolsetGroup::new();
        let mut clients = HashMap::new();
        
        // Initialize clients for different services
        let base_client = Arc::new(
            HarnessClient::new(config.clone())
                .map_err(|e| ToolError::ExecutionFailed {
                    message: format!("Failed to create base client: {}", e),
                })?
        );
        clients.insert("base".to_string(), base_client);
        
        // Initialize toolsets based on configuration
        Self::init_toolsets(&config, &mut toolsets, &clients).await?;
        
        Ok(Self { config, toolsets, clients })
    }
    
    /// Initialize toolsets based on configuration
    async fn init_toolsets(
        config: &Config,
        toolsets: &mut ToolsetGroup,
        clients: &HashMap<String, Arc<HarnessClient>>,
    ) -> Result<(), ToolError> {
        if config.enable_license {
            // TODO: Implement license-based toolset initialization
            info!("License-based toolset initialization not yet implemented");
        } else {
            // Legacy toolset initialization
            Self::init_legacy_toolsets(config, toolsets, clients).await?;
        }
        
        Ok(())
    }
    
    /// Initialize legacy toolsets (migrated from Go initLegacyToolsets)
    async fn init_legacy_toolsets(
        config: &Config,
        toolsets: &mut ToolsetGroup,
        clients: &HashMap<String, Arc<HarnessClient>>,
    ) -> Result<(), ToolError> {
        if config.toolsets.is_empty() {
            // Only register default toolset
            Self::register_default_toolset(config, toolsets, clients).await?;
        } else {
            let all_toolsets = config.toolsets.contains(&"all".to_string());
            
            if all_toolsets {
                // Register all available toolsets
                Self::register_all_toolsets(config, toolsets, clients).await?;
            } else {
                // Register specified toolsets
                for toolset_name in &config.toolsets {
                    Self::register_toolset_by_name(toolset_name, config, toolsets, clients).await?;
                }
            }
        }
        
        Ok(())
    }
    
    /// Register default toolset
    async fn register_default_toolset(
        config: &Config,
        toolsets: &mut ToolsetGroup,
        clients: &HashMap<String, Arc<HarnessClient>>,
    ) -> Result<(), ToolError> {
        info!("Registering default toolset");
        
        // Create default toolset with essential tools
        let mut default_toolset = crate::toolset::Toolset {
            name: "default".to_string(),
            description: "Default essential Harness tools".to_string(),
            tools: vec![],
        };
        
        // Add connector tools
        default_toolset.tools.push(Tool {
            name: "get_connector_details".to_string(),
            description: "Get details of a specific connector".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "connector_id": {"type": "string"},
                    "org_id": {"type": "string"},
                    "project_id": {"type": "string"}
                },
                "required": ["connector_id"]
            }),
        });
        
        default_toolset.tools.push(Tool {
            name: "list_connector_catalogue".to_string(),
            description: "List the Harness connector catalogue".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        });
        
        // Add pipeline tools
        default_toolset.tools.push(Tool {
            name: "list_pipelines".to_string(),
            description: "List pipelines in a repository".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "org_id": {"type": "string"},
                    "project_id": {"type": "string"},
                    "page": {"type": "integer"},
                    "size": {"type": "integer"}
                },
                "required": []
            }),
        });
        
        default_toolset.tools.push(Tool {
            name: "get_pipeline".to_string(),
            description: "Get details of a specific pipeline".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "pipeline_id": {"type": "string"},
                    "org_id": {"type": "string"},
                    "project_id": {"type": "string"}
                },
                "required": ["pipeline_id", "org_id", "project_id"]
            }),
        });
        
        toolsets.add_toolset(default_toolset);
        Ok(())
    }
    
    /// Register all available toolsets
    async fn register_all_toolsets(
        _config: &Config,
        _toolsets: &mut ToolsetGroup,
        _clients: &HashMap<String, Arc<HarnessClient>>,
    ) -> Result<(), ToolError> {
        info!("Registering all toolsets");
        // TODO: Implement registration of all toolsets
        Ok(())
    }
    
    /// Register toolset by name
    async fn register_toolset_by_name(
        toolset_name: &str,
        config: &Config,
        toolsets: &mut ToolsetGroup,
        clients: &HashMap<String, Arc<HarnessClient>>,
    ) -> Result<(), ToolError> {
        debug!("Registering toolset: {}", toolset_name);
        
        match toolset_name {
            "default" => Self::register_default_toolset(config, toolsets, clients).await?,
            "pipelines" => {
                // TODO: Register pipeline toolset
                info!("Pipeline toolset registration not yet implemented");
            }
            "connectors" => {
                // TODO: Register connector toolset
                info!("Connector toolset registration not yet implemented");
            }
            _ => {
                info!("Unknown toolset: {}", toolset_name);
            }
        }
        
        Ok(())
    }
    
    /// List all available tools
    pub async fn list_tools(&self) -> Result<Vec<Value>, ToolError> {
        let mut tools = Vec::new();
        
        for tool in self.toolsets.list_all_tools() {
            tools.push(serde_json::json!({
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.input_schema
            }));
        }
        
        Ok(tools)
    }
    
    /// Call a specific tool
    pub async fn call_tool(
        &self,
        tool_name: &str,
        arguments: &Value,
    ) -> Result<Value, ToolError> {
        debug!("Calling tool: {} with arguments: {}", tool_name, arguments);
        
        // Find the tool
        let tool = self.toolsets.list_all_tools()
            .iter()
            .find(|t| t.name == tool_name)
            .ok_or_else(|| ToolError::NotFound {
                name: tool_name.to_string(),
            })?;
        
        // Create tool request
        let args = arguments.as_object()
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "Arguments must be an object".to_string(),
            })?
            .clone();
        
        let request = ToolRequest::new(args);
        
        // Execute tool based on name
        let result = match tool_name {
            "get_connector_details" => self.execute_get_connector_details(&request).await?,
            "list_connector_catalogue" => self.execute_list_connector_catalogue(&request).await?,
            "list_pipelines" => self.execute_list_pipelines(&request).await?,
            "get_pipeline" => self.execute_get_pipeline(&request).await?,
            _ => {
                return Err(ToolError::ExecutionFailed {
                    message: format!("Tool execution not implemented: {}", tool_name),
                });
            }
        };
        
        Ok(result)
    }
    
    /// Execute get_connector_details tool
    async fn execute_get_connector_details(&self, request: &ToolRequest) -> Result<Value, ToolError> {
        use crate::params::{required_param, optional_param};
        
        let connector_id: String = required_param(request, "connector_id")?;
        let org_id: Option<String> = optional_param(request, "org_id")?;
        let project_id: Option<String> = optional_param(request, "project_id")?;
        
        // TODO: Implement actual connector details retrieval
        Ok(serde_json::json!({
            "connector_id": connector_id,
            "org_id": org_id,
            "project_id": project_id,
            "status": "Tool execution placeholder"
        }))
    }
    
    /// Execute list_connector_catalogue tool
    async fn execute_list_connector_catalogue(&self, _request: &ToolRequest) -> Result<Value, ToolError> {
        // TODO: Implement actual connector catalogue listing
        Ok(serde_json::json!({
            "catalogue": [],
            "status": "Tool execution placeholder"
        }))
    }
    
    /// Execute list_pipelines tool
    async fn execute_list_pipelines(&self, request: &ToolRequest) -> Result<Value, ToolError> {
        use crate::params::{optional_param, optional_int_param};
        
        let org_id: Option<String> = optional_param(request, "org_id")?;
        let project_id: Option<String> = optional_param(request, "project_id")?;
        let page: Option<i32> = optional_int_param(request, "page")?;
        let size: Option<i32> = optional_int_param(request, "size")?;
        
        // TODO: Implement actual pipeline listing
        Ok(serde_json::json!({
            "pipelines": [],
            "org_id": org_id,
            "project_id": project_id,
            "page": page,
            "size": size,
            "status": "Tool execution placeholder"
        }))
    }
    
    /// Execute get_pipeline tool
    async fn execute_get_pipeline(&self, request: &ToolRequest) -> Result<Value, ToolError> {
        use crate::params::required_param;
        
        let pipeline_id: String = required_param(request, "pipeline_id")?;
        let org_id: String = required_param(request, "org_id")?;
        let project_id: String = required_param(request, "project_id")?;
        
        // TODO: Implement actual pipeline retrieval
        Ok(serde_json::json!({
            "pipeline_id": pipeline_id,
            "org_id": org_id,
            "project_id": project_id,
            "status": "Tool execution placeholder"
        }))
    }
}