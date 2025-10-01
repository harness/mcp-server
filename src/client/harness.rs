use super::*;
use crate::error::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Common Harness API response structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarnessResponse<T> {
    pub status: String,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PagedResponse<T> {
    #[serde(rename = "totalPages")]
    pub total_pages: Option<i64>,
    #[serde(rename = "totalItems")]
    pub total_items: Option<i64>,
    #[serde(rename = "pageItemCount")]
    pub page_item_count: Option<i64>,
    #[serde(rename = "pageSize")]
    pub page_size: Option<i64>,
    pub content: Vec<T>,
}

// Scope for Harness API requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    #[serde(rename = "accountIdentifier")]
    pub account_id: String,
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_id: Option<String>,
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
}

impl Scope {
    pub fn new(account_id: String) -> Self {
        Self {
            account_id,
            org_id: None,
            project_id: None,
        }
    }
    
    pub fn with_org(mut self, org_id: String) -> Self {
        self.org_id = Some(org_id);
        self
    }
    
    pub fn with_project(mut self, project_id: String) -> Self {
        self.project_id = Some(project_id);
        self
    }
    
    pub fn to_query_params(&self) -> HashMap<String, String> {
        let mut params = HashMap::new();
        params.insert("accountIdentifier".to_string(), self.account_id.clone());
        
        if let Some(org_id) = &self.org_id {
            params.insert("orgIdentifier".to_string(), org_id.clone());
        }
        
        if let Some(project_id) = &self.project_id {
            params.insert("projectIdentifier".to_string(), project_id.clone());
        }
        
        params
    }
}

// Harness service clients
pub struct PipelineService {
    client: HarnessClient,
}

impl PipelineService {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }
    
    pub async fn list_pipelines(
        &self,
        scope: &Scope,
        page: Option<i64>,
        limit: Option<i64>,
    ) -> Result<HarnessResponse<PagedResponse<Pipeline>>> {
        let mut query = scope.to_query_params();
        
        if let Some(page) = page {
            query.insert("page".to_string(), page.to_string());
        }
        
        if let Some(limit) = limit {
            query.insert("limit".to_string(), limit.to_string());
        }
        
        self.client.get("/pipeline/api/pipelines/list", Some(&query)).await
    }
    
    pub async fn get_pipeline(
        &self,
        scope: &Scope,
        pipeline_id: &str,
    ) -> Result<HarnessResponse<Pipeline>> {
        let mut query = scope.to_query_params();
        query.insert("pipelineIdentifier".to_string(), pipeline_id.to_string());
        
        self.client.get("/pipeline/api/pipelines", Some(&query)).await
    }
}

pub struct DashboardService {
    client: HarnessClient,
}

impl DashboardService {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }
    
    pub async fn list_dashboards(
        &self,
        scope: &Scope,
    ) -> Result<HarnessResponse<Vec<Dashboard>>> {
        let query = scope.to_query_params();
        self.client.get("/ng/api/dashboards", Some(&query)).await
    }
    
    pub async fn get_dashboard(
        &self,
        scope: &Scope,
        dashboard_id: &str,
    ) -> Result<HarnessResponse<Dashboard>> {
        let mut query = scope.to_query_params();
        query.insert("dashboardIdentifier".to_string(), dashboard_id.to_string());
        
        self.client.get("/ng/api/dashboards", Some(&query)).await
    }
}

// Data models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "gitDetails")]
    pub git_details: Option<GitDetails>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    #[serde(rename = "repoIdentifier")]
    pub repo_identifier: Option<String>,
    #[serde(rename = "repoName")]
    pub repo_name: Option<String>,
    pub branch: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dashboard {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "gitProvider")]
    pub git_provider: Option<String>,
    pub url: Option<String>,
}