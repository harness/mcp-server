use crate::client::HarnessClient;
use crate::config::Config;
use crate::dto::{ApiResponse, service::Service};
use crate::error::Result;
use crate::tools::Tool;
use async_trait::async_trait;
use serde_json::{json, Value};
use tracing::debug;

pub struct GetServiceTool {
    client: HarnessClient,
}

impl GetServiceTool {
    pub fn new(config: &Config) -> Result<Self> {
        let client = HarnessClient::new(config)?;
        Ok(Self { client })
    }
}

#[async_trait]
impl Tool for GetServiceTool {
    fn name(&self) -> &str {
        "get_service"
    }
    
    fn description(&self) -> &str {
        "Get details of a specific service in Harness"
    }
    
    async fn execute(&self, params: Value) -> Result<Value> {
        debug!("Executing get_service with params: {:?}", params);
        
        // Extract parameters
        let service_id = params.get("serviceIdentifier")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::HarnessError::missing_parameter("serviceIdentifier"))?;
        
        let org_id = params.get("orgIdentifier")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::HarnessError::missing_parameter("orgIdentifier"))?;
        
        let project_id = params.get("projectIdentifier")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::HarnessError::missing_parameter("projectIdentifier"))?;
        
        // Build query parameters
        let query_params = [
            ("orgIdentifier", org_id),
            ("projectIdentifier", project_id),
        ];
        
        // Make API call
        let path = format!("ng/api/servicesV2/{}", service_id);
        let response: ApiResponse<Service> = self.client
            .get(&path, Some(&query_params))
            .await?;
        
        // Convert to JSON
        Ok(serde_json::to_value(response)?)
    }
}