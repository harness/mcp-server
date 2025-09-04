// Cloud Cost Management DTOs

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CcmOverview {
    #[serde(rename = "totalCost")]
    pub total_cost: f64,
    #[serde(rename = "totalCostTrend")]
    pub total_cost_trend: f64,
    #[serde(rename = "forecastCost")]
    pub forecast_cost: f64,
    #[serde(rename = "lastPeriodCost")]
    pub last_period_cost: f64,
    #[serde(rename = "costTrendPercentage")]
    pub cost_trend_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostCategory {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: i64,
    pub rules: Vec<CostCategoryRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostCategoryRule {
    pub name: String,
    pub conditions: Vec<CostCategoryCondition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostCategoryCondition {
    pub field: String,
    pub operator: String,
    pub values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Perspective {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: i64,
    pub filters: Vec<PerspectiveFilter>,
    #[serde(rename = "groupBy")]
    pub group_by: Vec<PerspectiveGroupBy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerspectiveFilter {
    pub field: String,
    pub operator: String,
    pub values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerspectiveGroupBy {
    pub field: String,
    #[serde(rename = "type")]
    pub group_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerspectiveCostData {
    #[serde(rename = "totalCost")]
    pub total_cost: f64,
    #[serde(rename = "idleCost")]
    pub idle_cost: f64,
    #[serde(rename = "utilizedCost")]
    pub utilized_cost: f64,
    #[serde(rename = "unallocatedCost")]
    pub unallocated_cost: f64,
    pub data: Vec<PerspectiveDataPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerspectiveDataPoint {
    pub name: String,
    pub cost: f64,
    #[serde(rename = "idleCost")]
    pub idle_cost: f64,
    #[serde(rename = "utilizedCost")]
    pub utilized_cost: f64,
    #[serde(rename = "unallocatedCost")]
    pub unallocated_cost: f64,
    #[serde(rename = "costTrend")]
    pub cost_trend: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recommendation {
    pub id: String,
    #[serde(rename = "type")]
    pub recommendation_type: String,
    #[serde(rename = "resourceType")]
    pub resource_type: String,
    #[serde(rename = "resourceName")]
    pub resource_name: String,
    #[serde(rename = "monthlyCost")]
    pub monthly_cost: f64,
    #[serde(rename = "monthlySavings")]
    pub monthly_savings: f64,
    #[serde(rename = "lastDaysCost")]
    pub last_days_cost: HashMap<String, f64>,
    pub state: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationStats {
    #[serde(rename = "totalRecommendations")]
    pub total_recommendations: i32,
    #[serde(rename = "totalMonthlyCost")]
    pub total_monthly_cost: f64,
    #[serde(rename = "totalMonthlySavings")]
    pub total_monthly_savings: f64,
    #[serde(rename = "resourceTypeBreakdown")]
    pub resource_type_breakdown: HashMap<String, RecommendationTypeStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationTypeStats {
    pub count: i32,
    #[serde(rename = "monthlyCost")]
    pub monthly_cost: f64,
    #[serde(rename = "monthlySavings")]
    pub monthly_savings: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anomaly {
    pub id: String,
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "actualCost")]
    pub actual_cost: f64,
    #[serde(rename = "expectedCost")]
    pub expected_cost: f64,
    #[serde(rename = "anomalousSpend")]
    pub anomalous_spend: f64,
    #[serde(rename = "anomalyScore")]
    pub anomaly_score: f64,
    #[serde(rename = "detectedAt")]
    pub detected_at: i64,
    #[serde(rename = "timeGranularity")]
    pub time_granularity: String,
    pub status: String,
    pub feedback: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitmentCoverage {
    #[serde(rename = "totalSpend")]
    pub total_spend: f64,
    #[serde(rename = "coveredSpend")]
    pub covered_spend: f64,
    #[serde(rename = "uncoveredSpend")]
    pub uncovered_spend: f64,
    #[serde(rename = "coveragePercentage")]
    pub coverage_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitmentSavings {
    #[serde(rename = "totalSavings")]
    pub total_savings: f64,
    #[serde(rename = "riSavings")]
    pub ri_savings: f64,
    #[serde(rename = "spSavings")]
    pub sp_savings: f64,
    #[serde(rename = "potentialSavings")]
    pub potential_savings: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitmentUtilization {
    #[serde(rename = "totalCommitment")]
    pub total_commitment: f64,
    #[serde(rename = "usedCommitment")]
    pub used_commitment: f64,
    #[serde(rename = "unusedCommitment")]
    pub unused_commitment: f64,
    #[serde(rename = "utilizationPercentage")]
    pub utilization_percentage: f64,
    #[serde(rename = "riUtilization")]
    pub ri_utilization: CommitmentTypeUtilization,
    #[serde(rename = "spUtilization")]
    pub sp_utilization: CommitmentTypeUtilization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitmentTypeUtilization {
    pub commitment: f64,
    pub used: f64,
    pub unused: f64,
    #[serde(rename = "utilizationPercentage")]
    pub utilization_percentage: f64,
}

// Request/Response types for CCM APIs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerspectiveGridRequest {
    #[serde(rename = "perspectiveId")]
    pub perspective_id: String,
    #[serde(rename = "startTime")]
    pub start_time: i64,
    #[serde(rename = "endTime")]
    pub end_time: i64,
    #[serde(rename = "groupBy", skip_serializing_if = "Option::is_none")]
    pub group_by: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filters: Option<Vec<PerspectiveFilter>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerspectiveTimeSeriesRequest {
    #[serde(rename = "perspectiveId")]
    pub perspective_id: String,
    #[serde(rename = "startTime")]
    pub start_time: i64,
    #[serde(rename = "endTime")]
    pub end_time: i64,
    #[serde(rename = "timeGranularity")]
    pub time_granularity: String, // DAILY, WEEKLY, MONTHLY
    #[serde(rename = "groupBy", skip_serializing_if = "Option::is_none")]
    pub group_by: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filters: Option<Vec<PerspectiveFilter>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationListRequest {
    #[serde(rename = "resourceTypes", skip_serializing_if = "Option::is_none")]
    pub resource_types: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub states: Option<Vec<String>>,
    #[serde(rename = "minSavings", skip_serializing_if = "Option::is_none")]
    pub min_savings: Option<f64>,
    #[serde(rename = "maxSavings", skip_serializing_if = "Option::is_none")]
    pub max_savings: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyListRequest {
    #[serde(rename = "startTime")]
    pub start_time: i64,
    #[serde(rename = "endTime")]
    pub end_time: i64,
    #[serde(rename = "minAnomalyScore", skip_serializing_if = "Option::is_none")]
    pub min_anomaly_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub statuses: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i32>,
}