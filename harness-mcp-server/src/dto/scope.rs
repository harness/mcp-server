use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
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
    
    pub fn get_ref(&self) -> String {
        let mut parts = vec![self.account_id.clone()];
        
        if let Some(org_id) = &self.org_id {
            parts.push(org_id.clone());
            
            if let Some(project_id) = &self.project_id {
                parts.push(project_id.clone());
            }
        }
        
        parts.join("/")
    }
}