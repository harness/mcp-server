use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Dashboard information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dashboard {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Repository information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "gitProvider")]
    pub git_provider: Option<String>,
    pub url: Option<String>,
    #[serde(rename = "defaultBranch")]
    pub default_branch: Option<String>,
    #[serde(rename = "isPublic")]
    pub is_public: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Service information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "serviceDefinition")]
    pub service_definition: Option<serde_json::Value>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Environment information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "environmentType")]
    pub environment_type: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Infrastructure information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Infrastructure {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    #[serde(rename = "environmentRef")]
    pub environment_ref: Option<String>,
    #[serde(rename = "deploymentType")]
    pub deployment_type: Option<String>,
    #[serde(rename = "infrastructureDefinition")]
    pub infrastructure_definition: Option<serde_json::Value>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Pull request information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub number: i32,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    #[serde(rename = "sourceBranch")]
    pub source_branch: String,
    #[serde(rename = "targetBranch")]
    pub target_branch: String,
    pub author: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<i64>,
    #[serde(rename = "mergedAt")]
    pub merged_at: Option<i64>,
    pub url: Option<String>,
}

/// Pull request check information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestCheck {
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    #[serde(rename = "detailsUrl")]
    pub details_url: Option<String>,
    #[serde(rename = "startedAt")]
    pub started_at: Option<i64>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
}

/// Template information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    #[serde(rename = "templateType")]
    pub template_type: Option<String>,
    pub version: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Audit event information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    #[serde(rename = "eventType")]
    pub event_type: String,
    pub resource: Option<String>,
    #[serde(rename = "resourceType")]
    pub resource_type: Option<String>,
    pub action: Option<String>,
    pub principal: Option<String>,
    #[serde(rename = "timestamp")]
    pub timestamp: Option<i64>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    pub details: Option<serde_json::Value>,
}

/// CCM perspective information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CcmPerspective {
    pub uuid: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
    #[serde(rename = "viewType")]
    pub view_type: Option<String>,
    #[serde(rename = "viewState")]
    pub view_state: Option<String>,
}

/// CCM recommendation information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CcmRecommendation {
    pub uuid: String,
    #[serde(rename = "recommendationType")]
    pub recommendation_type: String,
    #[serde(rename = "resourceType")]
    pub resource_type: Option<String>,
    #[serde(rename = "resourceName")]
    pub resource_name: Option<String>,
    #[serde(rename = "clusterId")]
    pub cluster_id: Option<String>,
    #[serde(rename = "namespace")]
    pub namespace: Option<String>,
    #[serde(rename = "monthlyCost")]
    pub monthly_cost: Option<f64>,
    #[serde(rename = "monthlySaving")]
    pub monthly_saving: Option<f64>,
    #[serde(rename = "lastDaysCost")]
    pub last_days_cost: Option<f64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
}

/// CCM anomaly information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CcmAnomaly {
    pub id: String,
    #[serde(rename = "anomalyTime")]
    pub anomaly_time: Option<i64>,
    #[serde(rename = "actualCost")]
    pub actual_cost: Option<f64>,
    #[serde(rename = "expectedCost")]
    pub expected_cost: Option<f64>,
    #[serde(rename = "anomalousSpend")]
    pub anomalous_spend: Option<f64>,
    #[serde(rename = "resourceType")]
    pub resource_type: Option<String>,
    #[serde(rename = "cloudProvider")]
    pub cloud_provider: Option<String>,
    pub status: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
}

/// Sort information for pagination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortInfo {
    pub empty: Option<bool>,
    pub unsorted: Option<bool>,
    pub sorted: Option<bool>,
}

/// Pageable information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageableInfo {
    pub offset: Option<i32>,
    pub sort: Option<SortInfo>,
    pub paged: Option<bool>,
    pub unpaged: Option<bool>,
    #[serde(rename = "pageSize")]
    pub page_size: Option<i32>,
    #[serde(rename = "pageNumber")]
    pub page_number: Option<i32>,
}

/// Page information for responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageInfo {
    pub page: Option<i32>,
    pub size: Option<i32>,
    #[serde(rename = "hasNext")]
    pub has_next: Option<bool>,
    #[serde(rename = "hasPrev")]
    pub has_prev: Option<bool>,
}