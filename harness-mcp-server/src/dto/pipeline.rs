use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use time::OffsetDateTime;

use super::pagination::ListOutput;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Entity<T> {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    pub data: T,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PipelineData {
    #[serde(rename = "yamlPipeline", skip_serializing_if = "Option::is_none")]
    pub yaml_pipeline: Option<String>,
    
    #[serde(rename = "resolvedTemplatesPipelineYaml", skip_serializing_if = "Option::is_none")]
    pub resolved_templates_pipeline_yaml: Option<String>,
    
    #[serde(rename = "gitDetails", skip_serializing_if = "Option::is_none")]
    pub git_details: Option<GitDetails>,
    
    #[serde(rename = "entityValidityDetails", skip_serializing_if = "Option::is_none")]
    pub entity_validity_details: Option<EntityValidityDetails>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modules: Option<Vec<String>>,
    
    #[serde(rename = "storeType", skip_serializing_if = "Option::is_none")]
    pub store_type: Option<String>,
    
    #[serde(rename = "connectorRef", skip_serializing_if = "Option::is_none")]
    pub connector_ref: Option<String>,
    
    #[serde(rename = "allowDynamicExecutions", skip_serializing_if = "Option::is_none")]
    pub allow_dynamic_executions: Option<bool>,
    
    #[serde(rename = "isInlineHCEntity", skip_serializing_if = "Option::is_none")]
    pub is_inline_hc_entity: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GitDetails {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub valid: Option<bool>,
    
    #[serde(rename = "invalidYaml", skip_serializing_if = "Option::is_none")]
    pub invalid_yaml: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub valid: Option<bool>,
    
    #[serde(rename = "invalidYaml", skip_serializing_if = "Option::is_none")]
    pub invalid_yaml: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PipelineListOptions {
    #[serde(flatten)]
    pub pagination: super::pagination::PaginationOptions,
    
    #[serde(rename = "searchTerm", skip_serializing_if = "Option::is_none")]
    pub search_term: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PipelineSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_identifier: Option<String>,
    
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_identifier: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<i32>,
    
    #[serde(rename = "numOfStages", skip_serializing_if = "Option::is_none")]
    pub num_of_stages: Option<i32>,
    
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    
    #[serde(rename = "lastUpdatedAt", skip_serializing_if = "Option::is_none")]
    pub last_updated_at: Option<i64>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modules: Option<Vec<String>>,
    
    #[serde(rename = "executionSummaryInfo", skip_serializing_if = "Option::is_none")]
    pub execution_summary_info: Option<ExecutionSummaryInfo>,
    
    #[serde(rename = "stageNames", skip_serializing_if = "Option::is_none")]
    pub stage_names: Option<Vec<String>>,
    
    #[serde(rename = "yamlVersion", skip_serializing_if = "Option::is_none")]
    pub yaml_version: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutionSummaryInfo {
    #[serde(rename = "lastExecutionTs", skip_serializing_if = "Option::is_none")]
    pub last_execution_ts: Option<i64>,
    
    #[serde(rename = "lastExecutionStatus", skip_serializing_if = "Option::is_none")]
    pub last_execution_status: Option<String>,
    
    #[serde(rename = "lastExecutionId", skip_serializing_if = "Option::is_none")]
    pub last_execution_id: Option<String>,
    
    #[serde(rename = "numOfErrors", skip_serializing_if = "Option::is_none")]
    pub num_of_errors: Option<Vec<i32>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PipelineListItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<i32>,
    
    #[serde(rename = "numOfStages", skip_serializing_if = "Option::is_none")]
    pub num_of_stages: Option<i32>,
    
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    
    #[serde(rename = "lastUpdatedAt", skip_serializing_if = "Option::is_none")]
    pub last_updated_at: Option<i64>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modules: Option<Vec<String>>,
    
    #[serde(rename = "executionSummaryInfo", skip_serializing_if = "Option::is_none")]
    pub execution_summary_info: Option<ExecutionSummaryInfo>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filters: Option<HashMap<String, serde_json::Value>>,
}

pub type PipelineListOutput = ListOutput<PipelineListItem>;