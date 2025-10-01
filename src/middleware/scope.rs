use anyhow::Result;
use serde_json::Value;

use super::Scope;

pub struct ScopeExtractor;

impl ScopeExtractor {
    pub fn new() -> Self {
        Self
    }
    
    pub async fn extract(&self, request: &Value) -> Result<Option<Scope>> {
        // Extract scope from MCP request parameters
        let params = request.get("params");
        if let Some(params) = params {
            let org_id = params
                .get("arguments")
                .and_then(|args| args.get("org_id"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            
            let project_id = params
                .get("arguments")
                .and_then(|args| args.get("project_id"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            
            if org_id.is_some() || project_id.is_some() {
                return Ok(Some(Scope::new(org_id, project_id)));
            }
        }
        
        Ok(None)
    }
}