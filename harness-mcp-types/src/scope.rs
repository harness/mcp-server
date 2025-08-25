use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScopeRequirement {
    Account,
    Organization,
    Project,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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
    
    pub fn satisfies(&self, requirement: &ScopeRequirement) -> bool {
        match requirement {
            ScopeRequirement::Account => true,
            ScopeRequirement::Organization => self.org_id.is_some(),
            ScopeRequirement::Project => self.org_id.is_some() && self.project_id.is_some(),
        }
    }
}