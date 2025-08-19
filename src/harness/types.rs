use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub account_id: String,
    pub org_id: Option<String>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationOptions {
    pub page: Option<i32>,
    pub size: Option<i32>,
}

impl Default for PaginationOptions {
    fn default() -> Self {
        Self {
            page: Some(0),
            size: Some(50),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListResponse<T> {
    pub content: Vec<T>,
    pub total_elements: Option<i64>,
    pub total_pages: Option<i32>,
    pub page_index: Option<i32>,
    pub page_size: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolArguments {
    pub args: HashMap<String, serde_json::Value>,
}

impl ToolArguments {
    pub fn new() -> Self {
        Self {
            args: HashMap::new(),
        }
    }

    pub fn get<T>(&self, key: &str) -> Option<T>
    where
        T: serde::de::DeserializeOwned,
    {
        self.args.get(key)
            .and_then(|v| serde_json::from_value(v.clone()).ok())
    }

    pub fn get_required<T>(&self, key: &str) -> anyhow::Result<T>
    where
        T: serde::de::DeserializeOwned,
    {
        self.get(key)
            .ok_or_else(|| anyhow::anyhow!("Required parameter '{}' not found", key))
    }
}