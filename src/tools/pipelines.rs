use crate::client::HarnessClient;
use crate::config::Config;
use crate::dto::{ListResponse, pipeline::PipelineSummary};
use crate::error::Result;
use crate::tools::Tool;
use async_trait::async_trait;
use serde_json::{json, Value};
use tracing::{debug, info};

pub struct ListPipelinesTool {
    client: HarnessClient,
}

impl ListPipelinesTool {
    pub fn new(config: &Config) -> Result<Self> {
        let client = HarnessClient::new(config)?;
        Ok(Self { client })
    }
}

#[async_trait]
impl Tool for ListPipelinesTool {
    fn name(&self) -> &str {
        "list_pipelines"
    }
    
    fn description(&self) -> &str {
        "List pipelines in a Harness project with pagination support. Returns pipeline summaries including execution status, stage information, and metadata."
    }
    
    async fn execute(&self, params: Value) -> Result<Value> {
        debug!("Executing list_pipelines with params: {:?}", params);
        
        // Extract parameters
        let org_id = params.get("orgIdentifier")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::HarnessError::missing_parameter("orgIdentifier"))?;
        
        let project_id = params.get("projectIdentifier")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::HarnessError::missing_parameter("projectIdentifier"))?;
        
        let page = params.get("page")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        
        let size = params.get("size")
            .and_then(|v| v.as_i64())
            .unwrap_or(20);
        
        // Optional search term
        let search_term = params.get("searchTerm")
            .and_then(|v| v.as_str());
        
        // Optional filter identifier
        let filter_identifier = params.get("filterIdentifier")
            .and_then(|v| v.as_str());
        
        info!("Listing pipelines for org: {}, project: {}, page: {}, size: {}", 
              org_id, project_id, page, size);
        
        // Build query parameters
        let mut query_params = vec![
            ("orgIdentifier", org_id.to_string()),
            ("projectIdentifier", project_id.to_string()),
            ("page", page.to_string()),
            ("size", size.to_string()),
        ];
        
        if let Some(search) = search_term {
            query_params.push(("searchTerm", search.to_string()));
        }
        
        if let Some(filter) = filter_identifier {
            query_params.push(("filterIdentifier", filter.to_string()));
        }
        
        let query_params: Vec<(&str, &str)> = query_params
            .iter()
            .map(|(k, v)| (*k, v.as_str()))
            .collect();
        
        // Make API call
        let response: ListResponse<PipelineSummary> = self.client
            .get("pipeline/api/pipelines/list", Some(&query_params))
            .await?;
        
        info!("Retrieved {} pipelines", 
              response.data.as_ref().map(|d| d.content.len()).unwrap_or(0));
        
        // Convert to JSON
        Ok(serde_json::to_value(response)?)
    }
}

pub struct GetPipelineTool {
    client: HarnessClient,
}

impl GetPipelineTool {
    pub fn new(config: &Config) -> Result<Self> {
        let client = HarnessClient::new(config)?;
        Ok(Self { client })
    }
}

#[async_trait]
impl Tool for GetPipelineTool {
    fn name(&self) -> &str {
        "get_pipeline"
    }
    
    fn description(&self) -> &str {
        "Get detailed information about a specific pipeline including YAML definition, git details, and execution history."
    }
    
    async fn execute(&self, params: Value) -> Result<Value> {
        debug!("Executing get_pipeline with params: {:?}", params);
        
        // Extract parameters
        let org_id = params.get("orgIdentifier")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::HarnessError::missing_parameter("orgIdentifier"))?;
        
        let project_id = params.get("projectIdentifier")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::HarnessError::missing_parameter("projectIdentifier"))?;
        
        let pipeline_id = params.get("pipelineIdentifier")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::HarnessError::missing_parameter("pipelineIdentifier"))?;
        
        info!("Getting pipeline: {} in org: {}, project: {}", pipeline_id, org_id, project_id);
        
        // Build query parameters
        let query_params = [
            ("orgIdentifier", org_id),
            ("projectIdentifier", project_id),
        ];
        
        // Make API call
        let path = format!("pipeline/api/pipelines/{}", pipeline_id);
        let response: Value = self.client
            .get(&path, Some(&query_params))
            .await?;
        
        info!("Retrieved pipeline details for: {}", pipeline_id);
        
        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use serde_json::json;

    fn create_test_config() -> Config {
        Config {
            version: "test".to_string(),
            base_url: "https://test.harness.io".to_string(),
            account_id: "test_account".to_string(),
            api_key: "test_key".to_string(),
            ..Default::default()
        }
    }

    #[test]
    fn test_list_pipelines_tool_creation() {
        let config = create_test_config();
        let tool = ListPipelinesTool::new(&config);
        assert!(tool.is_ok());
        
        let tool = tool.unwrap();
        assert_eq!(tool.name(), "list_pipelines");
        assert!(!tool.description().is_empty());
    }

    #[test]
    fn test_get_pipeline_tool_creation() {
        let config = create_test_config();
        let tool = GetPipelineTool::new(&config);
        assert!(tool.is_ok());
        
        let tool = tool.unwrap();
        assert_eq!(tool.name(), "get_pipeline");
        assert!(!tool.description().is_empty());
    }

    #[tokio::test]
    async fn test_list_pipelines_missing_org_identifier() {
        let config = create_test_config();
        let tool = ListPipelinesTool::new(&config).unwrap();
        
        let params = json!({
            "projectIdentifier": "test_project"
        });
        
        let result = tool.execute(params).await;
        assert!(result.is_err());
        
        let error = result.unwrap_err();
        assert!(error.to_string().contains("orgIdentifier"));
    }

    #[tokio::test]
    async fn test_list_pipelines_missing_project_identifier() {
        let config = create_test_config();
        let tool = ListPipelinesTool::new(&config).unwrap();
        
        let params = json!({
            "orgIdentifier": "test_org"
        });
        
        let result = tool.execute(params).await;
        assert!(result.is_err());
        
        let error = result.unwrap_err();
        assert!(error.to_string().contains("projectIdentifier"));
    }

    #[tokio::test]
    async fn test_get_pipeline_missing_pipeline_identifier() {
        let config = create_test_config();
        let tool = GetPipelineTool::new(&config).unwrap();
        
        let params = json!({
            "orgIdentifier": "test_org",
            "projectIdentifier": "test_project"
        });
        
        let result = tool.execute(params).await;
        assert!(result.is_err());
        
        let error = result.unwrap_err();
        assert!(error.to_string().contains("pipelineIdentifier"));
    }

    #[test]
    fn test_list_pipelines_parameter_extraction() {
        // This test validates parameter extraction logic without making HTTP calls
        let params = json!({
            "orgIdentifier": "test_org",
            "projectIdentifier": "test_project",
            "page": 1,
            "size": 50,
            "searchTerm": "test_search",
            "filterIdentifier": "test_filter"
        });
        
        // Extract parameters like the tool would
        let org_id = params.get("orgIdentifier").and_then(|v| v.as_str()).unwrap();
        let project_id = params.get("projectIdentifier").and_then(|v| v.as_str()).unwrap();
        let page = params.get("page").and_then(|v| v.as_i64()).unwrap_or(0);
        let size = params.get("size").and_then(|v| v.as_i64()).unwrap_or(20);
        let search_term = params.get("searchTerm").and_then(|v| v.as_str());
        let filter_identifier = params.get("filterIdentifier").and_then(|v| v.as_str());
        
        assert_eq!(org_id, "test_org");
        assert_eq!(project_id, "test_project");
        assert_eq!(page, 1);
        assert_eq!(size, 50);
        assert_eq!(search_term, Some("test_search"));
        assert_eq!(filter_identifier, Some("test_filter"));
    }

    #[test]
    fn test_list_pipelines_default_values() {
        let params = json!({
            "orgIdentifier": "test_org",
            "projectIdentifier": "test_project"
        });
        
        let page = params.get("page").and_then(|v| v.as_i64()).unwrap_or(0);
        let size = params.get("size").and_then(|v| v.as_i64()).unwrap_or(20);
        let search_term = params.get("searchTerm").and_then(|v| v.as_str());
        
        assert_eq!(page, 0);
        assert_eq!(size, 20);
        assert_eq!(search_term, None);
    }
}