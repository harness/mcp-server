use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CcmOverviewStatsData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time: Option<i64>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost: Option<CostData>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub efficiency_score: Option<f64>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forecasted_cost: Option<CostData>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_trend: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CostData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CcmOverviewStatsDataResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<CcmOverviewStatsData>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CcmPerspectiveListItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub view_type: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated_at: Option<i64>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated_by: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CcmPerspectiveListResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Vec<CcmPerspectiveListItem>>,
}