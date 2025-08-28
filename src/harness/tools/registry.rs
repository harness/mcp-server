use anyhow::Result;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, debug};

use crate::config::Config;
use super::{Tool, ToolDefinition};

pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn Tool>>,
    config: Config,
}

impl ToolRegistry {
    pub async fn new(config: &Config) -> Result<Self> {
        let mut registry = Self {
            tools: HashMap::new(),
            config: config.clone(),
        };

        registry.register_tools().await?;
        Ok(registry)
    }

    async fn register_tools(&mut self) -> Result<()> {
        info!("Registering tools for toolsets: {:?}", self.config.toolsets);

        // Register tools based on enabled toolsets
        for toolset in &self.config.toolsets {
            match toolset.as_str() {
                "default" | "all" => {
                    self.register_default_tools().await?;
                }
                "pipelines" => {
                    self.register_pipeline_tools().await?;
                }
                "connectors" => {
                    self.register_connector_tools().await?;
                }
                "repositories" => {
                    self.register_repository_tools().await?;
                }
                "dashboards" => {
                    self.register_dashboard_tools().await?;
                }
                "ccm" => {
                    self.register_ccm_tools().await?;
                }
                "chaos" => {
                    self.register_chaos_tools().await?;
                }
                "idp" => {
                    self.register_idp_tools().await?;
                }
                "sto" => {
                    self.register_sto_tools().await?;
                }
                "scs" => {
                    self.register_scs_tools().await?;
                }
                _ => {
                    debug!("Unknown toolset: {}", toolset);
                }
            }
        }

        info!("Registered {} tools", self.tools.len());
        Ok(())
    }

    async fn register_default_tools(&mut self) -> Result<()> {
        // Register a subset of tools that are always available
        self.register_pipeline_tools().await?;
        self.register_connector_tools().await?;
        self.register_dashboard_tools().await?;
        Ok(())
    }

    async fn register_pipeline_tools(&mut self) -> Result<()> {
        // TODO: Implement pipeline tools
        debug!("Registering pipeline tools");
        Ok(())
    }

    async fn register_connector_tools(&mut self) -> Result<()> {
        // TODO: Implement connector tools
        debug!("Registering connector tools");
        Ok(())
    }

    async fn register_repository_tools(&mut self) -> Result<()> {
        // TODO: Implement repository tools
        debug!("Registering repository tools");
        Ok(())
    }

    async fn register_dashboard_tools(&mut self) -> Result<()> {
        // TODO: Implement dashboard tools
        debug!("Registering dashboard tools");
        Ok(())
    }

    async fn register_ccm_tools(&mut self) -> Result<()> {
        // TODO: Implement CCM tools
        debug!("Registering CCM tools");
        Ok(())
    }

    async fn register_chaos_tools(&mut self) -> Result<()> {
        // TODO: Implement chaos tools
        debug!("Registering chaos tools");
        Ok(())
    }

    async fn register_idp_tools(&mut self) -> Result<()> {
        // TODO: Implement IDP tools
        debug!("Registering IDP tools");
        Ok(())
    }

    async fn register_sto_tools(&mut self) -> Result<()> {
        // TODO: Implement STO tools
        debug!("Registering STO tools");
        Ok(())
    }

    async fn register_scs_tools(&mut self) -> Result<()> {
        // TODO: Implement SCS tools
        debug!("Registering SCS tools");
        Ok(())
    }

    pub fn register_tool(&mut self, tool: Arc<dyn Tool>) {
        let name = tool.name().to_string();
        self.tools.insert(name, tool);
    }

    pub async fn list_tools(&self) -> Result<Vec<ToolDefinition>> {
        let mut tools = Vec::new();
        
        for tool in self.tools.values() {
            tools.push(ToolDefinition {
                name: tool.name().to_string(),
                description: tool.description().to_string(),
                input_schema: tool.input_schema(),
            });
        }

        Ok(tools)
    }

    pub async fn call_tool(&self, params: &Value) -> Result<Value> {
        let name = params.get("name")
            .and_then(|n| n.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing tool name"))?;

        let arguments = params.get("arguments")
            .unwrap_or(&Value::Object(serde_json::Map::new()));

        let tool = self.tools.get(name)
            .ok_or_else(|| anyhow::anyhow!("Tool not found: {}", name))?;

        debug!("Calling tool: {} with arguments: {:?}", name, arguments);
        
        let result = tool.execute(arguments).await?;
        
        Ok(serde_json::json!({
            "content": [
                {
                    "type": "text",
                    "text": result.to_string()
                }
            ]
        }))
    }
}