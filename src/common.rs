use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub account_id: String,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}

impl Scope {
    pub fn new(account_id: String, org_id: Option<String>, project_id: Option<String>) -> Self {
        Self {
            account_id,
            org_id,
            project_id,
        }
    }

    pub fn account_level(account_id: String) -> Self {
        Self {
            account_id,
            org_id: None,
            project_id: None,
        }
    }

    pub fn org_level(account_id: String, org_id: String) -> Self {
        Self {
            account_id,
            org_id: Some(org_id),
            project_id: None,
        }
    }

    pub fn project_level(account_id: String, org_id: String, project_id: String) -> Self {
        Self {
            account_id,
            org_id: Some(org_id),
            project_id: Some(project_id),
        }
    }
}