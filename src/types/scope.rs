use serde::{Deserialize, Serialize};

/// Scope represents the hierarchical context for Harness operations
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Scope {
    /// Account identifier (always required)
    pub account_id: String,
    /// Organization identifier (optional)
    pub org_id: Option<String>,
    /// Project identifier (optional)
    pub project_id: Option<String>,
}

impl Scope {
    /// Create a new scope with just an account ID
    pub fn new(account_id: String) -> Self {
        Self {
            account_id,
            org_id: None,
            project_id: None,
        }
    }

    /// Create a new scope with account and organization IDs
    pub fn with_org(account_id: String, org_id: String) -> Self {
        Self {
            account_id,
            org_id: Some(org_id),
            project_id: None,
        }
    }

    /// Create a new scope with account, organization, and project IDs
    pub fn with_project(account_id: String, org_id: String, project_id: String) -> Self {
        Self {
            account_id,
            org_id: Some(org_id),
            project_id: Some(project_id),
        }
    }

    /// Check if this scope has an organization ID
    pub fn has_org(&self) -> bool {
        self.org_id.is_some()
    }

    /// Check if this scope has a project ID
    pub fn has_project(&self) -> bool {
        self.project_id.is_some()
    }

    /// Get the organization ID if present
    pub fn get_org_id(&self) -> Option<&str> {
        self.org_id.as_deref()
    }

    /// Get the project ID if present
    pub fn get_project_id(&self) -> Option<&str> {
        self.project_id.as_deref()
    }

    /// Validate that required scope components are present
    pub fn validate(&self, require_org: bool, require_project: bool) -> Result<(), String> {
        if self.account_id.is_empty() {
            return Err("Account ID is required".to_string());
        }

        if require_org && self.org_id.is_none() {
            return Err("Organization ID is required".to_string());
        }

        if require_project && self.project_id.is_none() {
            return Err("Project ID is required".to_string());
        }

        Ok(())
    }
}