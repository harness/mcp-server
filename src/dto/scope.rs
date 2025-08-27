use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents the hierarchical scope in Harness (Account/Org/Project)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    #[serde(rename = "accountIdentifier")]
    pub account_identifier: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
}

impl Scope {
    pub fn new(account_id: String) -> Self {
        Self {
            account_identifier: account_id,
            org_identifier: None,
            project_identifier: None,
        }
    }

    pub fn with_org(mut self, org_id: String) -> Self {
        self.org_identifier = Some(org_id);
        self
    }

    pub fn with_project(mut self, project_id: String) -> Self {
        self.project_identifier = Some(project_id);
        self
    }

    /// Add scope parameters to a query parameter map
    pub fn add_to_params(&self, params: &mut HashMap<String, String>) {
        params.insert("accountIdentifier".to_string(), self.account_identifier.clone());
        
        if let Some(org_id) = &self.org_identifier {
            params.insert("orgIdentifier".to_string(), org_id.clone());
        }
        
        if let Some(project_id) = &self.project_identifier {
            params.insert("projectIdentifier".to_string(), project_id.clone());
        }
    }

    /// Get the scope level (Account, Org, or Project)
    pub fn level(&self) -> ScopeLevel {
        if self.project_identifier.is_some() {
            ScopeLevel::Project
        } else if self.org_identifier.is_some() {
            ScopeLevel::Org
        } else {
            ScopeLevel::Account
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScopeLevel {
    Account,
    Org,
    Project,
}