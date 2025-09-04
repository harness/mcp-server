// Pipeline-specific DTOs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineStage {
    pub identifier: String,
    pub name: String,
    #[serde(rename = "type")]
    pub stage_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub spec: HashMap<String, serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<Vec<PipelineVariable>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineVariable {
    pub name: String,
    #[serde(rename = "type")]
    pub variable_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "defaultValue", skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineStep {
    pub identifier: String,
    pub name: String,
    #[serde(rename = "type")]
    pub step_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub spec: HashMap<String, serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<String>,
    #[serde(rename = "failureStrategies", skip_serializing_if = "Option::is_none")]
    pub failure_strategies: Option<Vec<FailureStrategy>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailureStrategy {
    #[serde(rename = "onFailure")]
    pub on_failure: FailureAction,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailureAction {
    #[serde(rename = "type")]
    pub action_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spec: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecutionSummary {
    #[serde(rename = "planExecutionId")]
    pub plan_execution_id: String,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: String,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: String,
    pub name: String,
    pub status: String,
    #[serde(rename = "startTs")]
    pub start_ts: i64,
    #[serde(rename = "endTs", skip_serializing_if = "Option::is_none")]
    pub end_ts: Option<i64>,
    #[serde(rename = "executionTriggerInfo")]
    pub execution_trigger_info: super::ExecutionTriggerInfo,
    #[serde(rename = "moduleInfo")]
    pub module_info: HashMap<String, serde_json::Value>,
    #[serde(rename = "layoutNodeMap")]
    pub layout_node_map: HashMap<String, ExecutionNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionNode {
    #[serde(rename = "nodeType")]
    pub node_type: String,
    #[serde(rename = "nodeGroup")]
    pub node_group: String,
    #[serde(rename = "nodeIdentifier")]
    pub node_identifier: String,
    pub name: String,
    #[serde(rename = "nodeUuid")]
    pub node_uuid: String,
    pub status: String,
    #[serde(rename = "module")]
    pub module: String,
    #[serde(rename = "moduleInfo")]
    pub module_info: HashMap<String, serde_json::Value>,
    #[serde(rename = "startTs", skip_serializing_if = "Option::is_none")]
    pub start_ts: Option<i64>,
    #[serde(rename = "endTs", skip_serializing_if = "Option::is_none")]
    pub end_ts: Option<i64>,
    #[serde(rename = "edgeLayoutList")]
    pub edge_layout_list: Option<Vec<EdgeLayout>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeLayout {
    #[serde(rename = "currentNodeChildren")]
    pub current_node_children: Vec<String>,
    #[serde(rename = "nextIds")]
    pub next_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecutionDetail {
    #[serde(rename = "pipelineExecutionSummary")]
    pub pipeline_execution_summary: PipelineExecutionSummary,
    #[serde(rename = "executionGraph")]
    pub execution_graph: ExecutionGraph,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionGraph {
    #[serde(rename = "rootNodeId")]
    pub root_node_id: String,
    #[serde(rename = "nodeMap")]
    pub node_map: HashMap<String, GraphNode>,
    #[serde(rename = "nodeAdjacencyListMap")]
    pub node_adjacency_list_map: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub uuid: String,
    #[serde(rename = "setupId")]
    pub setup_id: String,
    pub name: String,
    pub identifier: String,
    #[serde(rename = "baseFqn")]
    pub base_fqn: String,
    pub outcomes: HashMap<String, serde_json::Value>,
    #[serde(rename = "stepParameters")]
    pub step_parameters: HashMap<String, serde_json::Value>,
    #[serde(rename = "startTs", skip_serializing_if = "Option::is_none")]
    pub start_ts: Option<i64>,
    #[serde(rename = "endTs", skip_serializing_if = "Option::is_none")]
    pub end_ts: Option<i64>,
    #[serde(rename = "stepType")]
    pub step_type: String,
    pub status: String,
    #[serde(rename = "failureInfo", skip_serializing_if = "Option::is_none")]
    pub failure_info: Option<FailureInfo>,
    #[serde(rename = "skipInfo", skip_serializing_if = "Option::is_none")]
    pub skip_info: Option<SkipInfo>,
    #[serde(rename = "nodeRunInfo", skip_serializing_if = "Option::is_none")]
    pub node_run_info: Option<NodeRunInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailureInfo {
    pub message: String,
    #[serde(rename = "failureTypeList")]
    pub failure_type_list: Vec<String>,
    #[serde(rename = "responseMessages")]
    pub response_messages: Vec<ResponseMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMessage {
    pub code: String,
    pub level: String,
    pub message: String,
    #[serde(rename = "exception", skip_serializing_if = "Option::is_none")]
    pub exception: Option<String>,
    #[serde(rename = "failureTypes")]
    pub failure_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipInfo {
    #[serde(rename = "skipMessage")]
    pub skip_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeRunInfo {
    #[serde(rename = "whenCondition")]
    pub when_condition: String,
    #[serde(rename = "evaluatedCondition")]
    pub evaluated_condition: bool,
    #[serde(rename = "expressions")]
    pub expressions: Vec<String>,
}

// Request types for pipeline operations

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListRequest {
    #[serde(rename = "filterType", skip_serializing_if = "Option::is_none")]
    pub filter_type: Option<String>,
    #[serde(rename = "pipelineIdentifiers", skip_serializing_if = "Option::is_none")]
    pub pipeline_identifiers: Option<Vec<String>>,
    #[serde(rename = "pipelineNames", skip_serializing_if = "Option::is_none")]
    pub pipeline_names: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionListRequest {
    #[serde(rename = "pipelineIdentifier", skip_serializing_if = "Option::is_none")]
    pub pipeline_identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<Vec<String>>,
    #[serde(rename = "myDeployments", skip_serializing_if = "Option::is_none")]
    pub my_deployments: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(rename = "sort", skip_serializing_if = "Option::is_none")]
    pub sort: Option<Vec<String>>,
}