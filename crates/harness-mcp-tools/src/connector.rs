use crate::{Result, ToolError};
use harness_mcp_client::HarnessClient;
use harness_mcp_dto::Scope;
use serde_json::Value;
use tracing::{debug, error, info};

#[derive(Clone)]
pub struct ConnectorTools {
    client: HarnessClient,
}

impl ConnectorTools {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    pub async fn get_connector(&self, params: Value) -> Result<Value> {
        let connector_id = params["connector_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing connector_id".to_string()))?;

        let org_id = params["org_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing org_id".to_string()))?;

        let project_id = params["project_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing project_id".to_string()))?;

        info!(
            "Getting connector: {} in org: {}, project: {}",
            connector_id, org_id, project_id
        );

        let scope = Scope {
            account_id: "".to_string(),
            org_id: org_id.to_string(),
            project_id: project_id.to_string(),
        };

        let connector_service = self.client.connectors();
        let connector = connector_service
            .get(&scope, connector_id)
            .await
            .map_err(|e| {
                error!("Failed to get connector {}: {}", connector_id, e);
                ToolError::ToolExecutionFailed {
                    tool: "get_connector".to_string(),
                    params: format!(
                        "connector_id={}, org_id={}, project_id={}",
                        connector_id, org_id, project_id
                    ),
                    reason: e.to_string(),
                }
            })?;

        debug!("Successfully retrieved connector data");
        Ok(serde_json::json!({
            "content": [{
                "type": "text",
                "text": format!("Connector Data:\\n{}",
                    serde_json::to_string_pretty(&connector).unwrap_or_default()
                )
            }]
        }))
    }

    pub async fn list_connectors(&self, params: Value) -> Result<Value> {
        let org_id = params["org_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing org_id".to_string()))?;

        let project_id = params["project_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing project_id".to_string()))?;

        let scope = Scope {
            account_id: "".to_string(),
            org_id: org_id.to_string(),
            project_id: project_id.to_string(),
        };

        let page = params["page"].as_u64().map(|p| p as u32);
        let size = params["size"].as_u64().map(|s| s as u32);

        let connector_service = self.client.connectors();
        let connectors = connector_service
            .list(&scope, page, size)
            .await
            .map_err(|e| ToolError::ToolExecutionFailed {
                tool: "list_connectors".to_string(),
                params: format!("org_id={}, project_id={}", org_id, project_id),
                reason: e.to_string(),
            })?;

        Ok(serde_json::json!({
            "content": [{
                "type": "text",
                "text": format!("Connectors:\\n{}",
                    serde_json::to_string_pretty(&connectors).unwrap_or_default()
                )
            }]
        }))
    }

    pub async fn list_connector_catalogue(&self, _params: Value) -> Result<Value> {
        let connector_service = self.client.connectors();
        let scope = Scope {
            account_id: "".to_string(),
            org_id: "".to_string(),
            project_id: "".to_string(),
        };

        let catalogue = connector_service
            .list_catalogue(&scope)
            .await
            .map_err(|e| ToolError::ToolExecutionFailed {
                tool: "list_connector_catalogue".to_string(),
                params: "".to_string(),
                reason: e.to_string(),
            })?;

        Ok(serde_json::json!({
            "content": [{
                "type": "text",
                "text": format!("Connector Catalogue:\\n{}",
                    serde_json::to_string_pretty(&catalogue).unwrap_or_default()
                )
            }]
        }))
    }
}
