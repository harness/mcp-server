//! Template DTOs

use serde::{Deserialize, Serialize};

/// Template information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: std::collections::HashMap<String, String>,
    pub template_type: String,
    pub version_label: String,
}

/// Template list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateListResponse {
    pub status: String,
    pub data: Option<TemplateListData>,
}

/// Template list data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateListData {
    pub content: Vec<Template>,
    pub total_elements: i64,
}