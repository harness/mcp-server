use crate::{ToolError, params::ToolRequest};
use harness_client::{HarnessClient, connector::ConnectorClient};
use harness_config::Config;
use serde_json::Value;
use std::sync::Arc;
use tracing::{debug, error};

/// Connector tools implementation
/// Migrated from Go connector tools
pub struct ConnectorTools {
    client: ConnectorClient,
    config: Arc<Config>,
}

impl ConnectorTools {
    /// Create new connector tools
    pub fn new(client: HarnessClient, config: Arc<Config>) -> Self {
        let connector_client = ConnectorClient::new(client);
        Self {
            client: connector_client,
            config,
        }
    }

    /// List connector catalogue tool
    pub async fn list_connector_catalogue(&self, _request: &ToolRequest) -> Result<Value, ToolError> {
        debug!("Listing connector catalogue for account: {}", self.config.account_id);

        match self.client.list_connector_catalogue(&self.config.account_id).await {
            Ok(catalogue) => {
                Ok(serde_json::json!({
                    "catalogue": catalogue,
                    "total_count": catalogue.len()
                }))
            }
            Err(e) => {
                error!("Failed to list connector catalogue: {}", e);
                Err(ToolError::ExecutionFailed {
                    message: format!("Failed to list connector catalogue: {}", e),
                })
            }
        }
    }

    /// Get connector details tool
    pub async fn get_connector_details(&self, request: &ToolRequest) -> Result<Value, ToolError> {
        use crate::params::{required_param, optional_param};

        let connector_id: String = required_param(request, "connector_id")?;
        let org_id: Option<String> = optional_param(request, "org_id")?
            .or_else(|| self.config.default_org_id.clone());
        let project_id: Option<String> = optional_param(request, "project_id")?
            .or_else(|| self.config.default_project_id.clone());

        debug!("Getting connector details for: {}", connector_id);

        match self.client.get_connector_details(
            &self.config.account_id,
            org_id.as_deref(),
            project_id.as_deref(),
            &connector_id,
        ).await {
            Ok(connector) => {
                Ok(serde_json::to_value(connector).map_err(|e| ToolError::ExecutionFailed {
                    message: format!("Failed to serialize connector: {}", e),
                })?)
            }
            Err(e) => {
                error!("Failed to get connector details: {}", e);
                Err(ToolError::ExecutionFailed {
                    message: format!("Failed to get connector details: {}", e),
                })
            }
        }
    }

    /// List connectors tool
    pub async fn list_connectors(&self, request: &ToolRequest) -> Result<Value, ToolError> {
        use crate::params::{optional_param, optional_int_param};

        let org_id: Option<String> = optional_param(request, "org_id")?
            .or_else(|| self.config.default_org_id.clone());
        let project_id: Option<String> = optional_param(request, "project_id")?
            .or_else(|| self.config.default_project_id.clone());
        let page: Option<i32> = optional_int_param(request, "page")?;
        let size: Option<i32> = optional_int_param(request, "size")?;

        debug!("Listing connectors for account: {}", self.config.account_id);

        match self.client.list_connectors(
            &self.config.account_id,
            org_id.as_deref(),
            project_id.as_deref(),
            page,
            size,
        ).await {
            Ok(response) => {
                Ok(serde_json::json!({
                    "connectors": response.content,
                    "page_info": response.page_info,
                    "total_count": response.content.len()
                }))
            }
            Err(e) => {
                error!("Failed to list connectors: {}", e);
                Err(ToolError::ExecutionFailed {
                    message: format!("Failed to list connectors: {}", e),
                })
            }
        }
    }
}