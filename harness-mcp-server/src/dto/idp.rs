use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IdpCatalogItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spec: Option<serde_json::Value>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IdpCatalogListResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Vec<IdpCatalogItem>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IdpScorecard {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checks: Option<Vec<IdpScorecardCheck>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IdpScorecardCheck {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IdpScorecardListResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Vec<IdpScorecard>>,
}