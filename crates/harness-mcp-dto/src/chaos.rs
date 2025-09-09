use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListExperimentResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Vec<ChaosExperiment>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetExperimentResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<ChaosExperiment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChaosExperiment {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experiment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperimentRunDetail {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experiment_run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experiment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_sequence: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revision_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow_revision: Option<WorkflowRevision>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRevision {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revision_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experiment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experiment_manifest: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChaosExperimentRun {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experiment_run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experiment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experiment_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experiment_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experiment_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<crate::common::User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_by: Option<crate::common::User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_sequence: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resiliency_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experiment_run_details: Option<ExperimentRunDetail>,
}
