use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::common::{GitDetails, EntityValidityDetails};

/// Template representation in Harness
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "templateEntityType")]
    pub template_entity_type: String,
    #[serde(rename = "childType")]
    pub child_type: Option<String>,
    #[serde(rename = "templateScope")]
    pub template_scope: String,
    pub version: String,
    #[serde(rename = "versionLabel")]
    pub version_label: String,
    #[serde(rename = "isStableTemplate")]
    pub is_stable_template: Option<bool>,
    pub yaml: Option<String>,
    #[serde(rename = "gitDetails")]
    pub git_details: Option<GitDetails>,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: Option<EntityValidityDetails>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
}

/// Template summary for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateSummary {
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "templateEntityType")]
    pub template_entity_type: String,
    #[serde(rename = "childType")]
    pub child_type: Option<String>,
    #[serde(rename = "templateScope")]
    pub template_scope: String,
    pub version: String,
    #[serde(rename = "versionLabel")]
    pub version_label: String,
    #[serde(rename = "isStableTemplate")]
    pub is_stable_template: Option<bool>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "stableTemplate")]
    pub stable_template: Option<bool>,
}

/// Template input for creation/update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateInput {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "templateEntityType")]
    pub template_entity_type: String,
    #[serde(rename = "childType")]
    pub child_type: Option<String>,
    #[serde(rename = "versionLabel")]
    pub version_label: String,
    pub yaml: String,
}

/// Template filter options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateFilterOptions {
    #[serde(rename = "templateNames")]
    pub template_names: Option<Vec<String>>,
    #[serde(rename = "templateIdentifiers")]
    pub template_identifiers: Option<Vec<String>>,
    pub description: Option<String>,
    #[serde(rename = "templateEntityTypes")]
    pub template_entity_types: Option<Vec<String>>,
    #[serde(rename = "childTypes")]
    pub child_types: Option<Vec<String>>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "filterType")]
    pub filter_type: Option<String>,
    #[serde(rename = "includeAllTemplatesAvailableAtScope")]
    pub include_all_templates_available_at_scope: Option<bool>,
}

/// Template search request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateSearchRequest {
    pub query: String,
    #[serde(rename = "templateEntityTypes")]
    pub template_entity_types: Option<Vec<String>>,
    #[serde(rename = "childTypes")]
    pub child_types: Option<Vec<String>>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "includeAllTemplatesAvailableAtScope")]
    pub include_all_templates_available_at_scope: Option<bool>,
}

/// Template version information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateVersion {
    pub version: String,
    #[serde(rename = "versionLabel")]
    pub version_label: String,
    #[serde(rename = "isStableTemplate")]
    pub is_stable_template: Option<bool>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
}