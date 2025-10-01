use super::*;
use crate::client::HarnessClient;
use crate::client::harness::DashboardService;
use crate::mcp::{CallToolResponse, ToolContent, Tool, ToolHandler, ToolSchemaBuilder};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;

pub struct ListDashboardsHandler {
    service: Arc<DashboardService>,
    config: Config,
}

impl ListDashboardsHandler {
    pub fn new(client: Arc<HarnessClient>, config: Config) -> Self {
        Self {
            service: Arc::new(DashboardService::new((*client).clone())),
            config,
        }
    }
    
    pub fn tool() -> Tool {
        Tool {
            name: "list_dashboards".to_string(),
            description: "List dashboards in an organization and project".to_string(),
            input_schema: ToolSchemaBuilder::new()
                .add_string_property("accountIdentifier", "Account identifier", false)
                .add_string_property("orgIdentifier", "Organization identifier", false)
                .add_string_property("projectIdentifier", "Project identifier", false)
                .build(),
        }
    }
}

#[async_trait]
impl ToolHandler for ListDashboardsHandler {
    async fn execute(&self, arguments: HashMap<String, Value>) -> Result<CallToolResponse> {
        let scope = extract_scope_from_arguments(&arguments, &self.config)?;
        
        match self.service.list_dashboards(&scope).await {
            Ok(response) => {
                let json = serde_json::to_string_pretty(&response)?;
                Ok(CallToolResponse::success(vec![ToolContent::text(json)]))
            }
            Err(e) => Ok(CallToolResponse::error(format!("Failed to list dashboards: {}", e))),
        }
    }
}

pub struct GetDashboardHandler {
    service: Arc<DashboardService>,
    config: Config,
}

impl GetDashboardHandler {
    pub fn new(client: Arc<HarnessClient>, config: Config) -> Self {
        Self {
            service: Arc::new(DashboardService::new((*client).clone())),
            config,
        }
    }
    
    pub fn tool() -> Tool {
        Tool {
            name: "get_dashboard".to_string(),
            description: "Get details of a specific dashboard".to_string(),
            input_schema: ToolSchemaBuilder::new()
                .add_string_property("accountIdentifier", "Account identifier", false)
                .add_string_property("orgIdentifier", "Organization identifier", false)
                .add_string_property("projectIdentifier", "Project identifier", false)
                .add_string_property("dashboard_id", "The ID of the dashboard", true)
                .build(),
        }
    }
}

#[async_trait]
impl ToolHandler for GetDashboardHandler {
    async fn execute(&self, arguments: HashMap<String, Value>) -> Result<CallToolResponse> {
        let scope = extract_scope_from_arguments(&arguments, &self.config)?;
        let dashboard_id = crate::mcp::tool::get_required_string(&arguments, "dashboard_id")?;
        
        match self.service.get_dashboard(&scope, &dashboard_id).await {
            Ok(response) => {
                let json = serde_json::to_string_pretty(&response)?;
                Ok(CallToolResponse::success(vec![ToolContent::text(json)]))
            }
            Err(e) => Ok(CallToolResponse::error(format!("Failed to get dashboard: {}", e))),
        }
    }
}