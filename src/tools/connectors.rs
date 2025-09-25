use crate::client::HarnessClient;
use crate::config::Config;
use crate::dto::{ListResponse, connector::Connector};
use crate::error::Result;
use crate::tools::Tool;
use async_trait::async_trait;
use serde_json::{json, Value};
use tracing::debug;

pub struct ListConnectorsTool {
    client: HarnessClient,
}

impl ListConnectorsTool {
    pub fn new(config: &Config) -> Result<Self> {
        let client = HarnessClient::new(config)?;
        Ok(Self { client })
    }
}

#[async_trait]
impl Tool for ListConnectorsTool {
    fn name(&self) -> &str {
        "list_connectors"
    }
    
    fn description(&self) -> &str {
        "List connectors with filtering options"
    }
    
    async fn execute(&self, params: Value) -> Result<Value> {
        debug!("Executing list_connectors with params: {:?}", params);
        
        // Extract parameters
        let org_id = params.get("orgIdentifier")
            .and_then(|v| v.as_str());
        
        let project_id = params.get("projectIdentifier")
            .and_then(|v| v.as_str());
        
        let page = params.get("page")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        
        let size = params.get("size")
            .and_then(|v| v.as_i64())
            .unwrap_or(20);
        
        // Build query parameters
        let mut query_params = vec![
            ("page", page.to_string()),
            ("size", size.to_string()),
        ];
        
        if let Some(org_id) = org_id {
            query_params.push(("orgIdentifier", org_id.to_string()));
        }
        
        if let Some(project_id) = project_id {
            query_params.push(("projectIdentifier", project_id.to_string()));
        }
        
        let query_params: Vec<(&str, &str)> = query_params
            .iter()
            .map(|(k, v)| (*k, v.as_str()))
            .collect();
        
        // Make API call
        let response: ListResponse<Connector> = self.client
            .get("ng/api/connectors", Some(&query_params))
            .await?;
        
        // Convert to JSON
        Ok(serde_json::to_value(response)?)
    }
}