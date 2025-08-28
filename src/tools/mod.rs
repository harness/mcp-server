use anyhow::Result;
use serde_json::Value;
use std::collections::HashMap;

use crate::config::Config;

pub mod pipelines;
pub mod connectors;
pub mod dashboards;

pub struct ToolRegistry {
    tools: HashMap<String, Box<dyn Tool + Send + Sync>>,
    config: Config,
}

#[async_trait::async_trait]
pub trait Tool {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn input_schema(&self) -> Value;
    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value>;
}

impl ToolRegistry {
    pub async fn new(config: &Config) -> Result<Self> {
        let mut registry = ToolRegistry {
            tools: HashMap::new(),
            config: config.clone(),
        };

        // Register tools based on enabled toolsets
        registry.register_tools().await?;

        Ok(registry)
    }

    async fn register_tools(&mut self) -> Result<()> {
        for toolset in &self.config.toolsets {
            match toolset.as_str() {
                "default" => {
                    self.register_default_tools().await?;
                }
                "all" => {
                    self.register_all_tools().await?;
                }
                "pipelines" => {
                    self.register_pipeline_tools().await?;
                }
                "connectors" => {
                    self.register_connector_tools().await?;
                }
                "dashboards" => {
                    self.register_dashboard_tools().await?;
                }
                _ => {
                    log::warn!("Unknown toolset: {}", toolset);
                }
            }
        }

        Ok(())
    }

    async fn register_default_tools(&mut self) -> Result<()> {
        // Register a subset of commonly used tools
        self.register_pipeline_tools().await?;
        self.register_connector_tools().await?;
        self.register_dashboard_tools().await?;
        Ok(())
    }

    async fn register_all_tools(&mut self) -> Result<()> {
        // Register all available tools
        self.register_pipeline_tools().await?;
        self.register_connector_tools().await?;
        self.register_dashboard_tools().await?;
        // Add more toolsets as they are implemented
        Ok(())
    }

    async fn register_pipeline_tools(&mut self) -> Result<()> {
        let list_pipelines = pipelines::ListPipelinesTool::new();
        let get_pipeline = pipelines::GetPipelineTool::new();
        let fetch_execution_url = pipelines::FetchExecutionURLTool::new();
        let get_execution = pipelines::GetExecutionTool::new();
        let list_executions = pipelines::ListExecutionsTool::new();
        let get_pipeline_summary = pipelines::GetPipelineSummaryTool::new();
        
        self.tools.insert(list_pipelines.name().to_string(), Box::new(list_pipelines));
        self.tools.insert(get_pipeline.name().to_string(), Box::new(get_pipeline));
        self.tools.insert(fetch_execution_url.name().to_string(), Box::new(fetch_execution_url));
        self.tools.insert(get_execution.name().to_string(), Box::new(get_execution));
        self.tools.insert(list_executions.name().to_string(), Box::new(list_executions));
        self.tools.insert(get_pipeline_summary.name().to_string(), Box::new(get_pipeline_summary));
        
        Ok(())
    }

    async fn register_connector_tools(&mut self) -> Result<()> {
        let list_connector_catalogue = connectors::ListConnectorCatalogueTool::new();
        let get_connector_details = connectors::GetConnectorDetailsTool::new();
        let list_connectors = connectors::ListConnectorsTool::new();
        
        self.tools.insert(list_connector_catalogue.name().to_string(), Box::new(list_connector_catalogue));
        self.tools.insert(get_connector_details.name().to_string(), Box::new(get_connector_details));
        self.tools.insert(list_connectors.name().to_string(), Box::new(list_connectors));
        
        Ok(())
    }

    async fn register_dashboard_tools(&mut self) -> Result<()> {
        let list_dashboards = dashboards::ListDashboardsTool::new();
        let get_dashboard_data = dashboards::GetDashboardDataTool::new();
        
        self.tools.insert(list_dashboards.name().to_string(), Box::new(list_dashboards));
        self.tools.insert(get_dashboard_data.name().to_string(), Box::new(get_dashboard_data));
        
        Ok(())
    }

    pub async fn list_tools(&self) -> Result<Vec<Value>> {
        let mut tools = Vec::new();
        
        for tool in self.tools.values() {
            tools.push(serde_json::json!({
                "name": tool.name(),
                "description": tool.description(),
                "inputSchema": tool.input_schema()
            }));
        }

        Ok(tools)
    }

    pub async fn call_tool(&self, name: &str, arguments: &Value) -> Result<Value> {
        if let Some(tool) = self.tools.get(name) {
            tool.execute(arguments, &self.config).await
        } else {
            Err(anyhow::anyhow!("Tool not found: {}", name))
        }
    }
}