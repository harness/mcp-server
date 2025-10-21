use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PullRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<PullRequestAuthor>,
    
    #[serde(rename = "check_summary", skip_serializing_if = "Option::is_none")]
    pub check_summary: Option<PullRequestCheckSummary>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub closed: Option<i64>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created: Option<i64>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edited: Option<i64>,
    
    #[serde(rename = "is_draft", skip_serializing_if = "Option::is_none")]
    pub is_draft: Option<bool>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub labels: Option<Vec<PullRequestLabel>>,
    
    #[serde(rename = "merge_base_sha", skip_serializing_if = "Option::is_none")]
    pub merge_base_sha: Option<String>,
    
    #[serde(rename = "merge_check_status", skip_serializing_if = "Option::is_none")]
    pub merge_check_status: Option<String>,
    
    #[serde(rename = "merge_conflicts", skip_serializing_if = "Option::is_none")]
    pub merge_conflicts: Option<Vec<String>>,
    
    #[serde(rename = "merge_method", skip_serializing_if = "Option::is_none")]
    pub merge_method: Option<String>,
    
    #[serde(rename = "merge_target_sha", skip_serializing_if = "Option::is_none")]
    pub merge_target_sha: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merged: Option<i64>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merger: Option<PullRequestAuthor>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number: Option<i32>,
    
    #[serde(rename = "rebase_check_status", skip_serializing_if = "Option::is_none")]
    pub rebase_check_status: Option<String>,
    
    #[serde(rename = "rebase_conflicts", skip_serializing_if = "Option::is_none")]
    pub rebase_conflicts: Option<Vec<String>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rules: Option<Vec<PullRequestRule>>,
    
    #[serde(rename = "source_branch", skip_serializing_if = "Option::is_none")]
    pub source_branch: Option<String>,
    
    #[serde(rename = "source_repo_id", skip_serializing_if = "Option::is_none")]
    pub source_repo_id: Option<i32>,
    
    #[serde(rename = "source_sha", skip_serializing_if = "Option::is_none")]
    pub source_sha: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stats: Option<PullRequestStats>,
    
    #[serde(rename = "target_branch", skip_serializing_if = "Option::is_none")]
    pub target_branch: Option<String>,
    
    #[serde(rename = "target_repo_id", skip_serializing_if = "Option::is_none")]
    pub target_repo_id: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PullRequestAuthor {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created: Option<i64>,
    
    #[serde(rename = "display_name", skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<i32>,
    
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub author_type: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PullRequestCheckSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pending: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub running: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success: Option<i32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PullRequestLabel {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    
    #[serde(rename = "value_color", skip_serializing_if = "Option::is_none")]
    pub value_color: Option<String>,
    
    #[serde(rename = "value_count", skip_serializing_if = "Option::is_none")]
    pub value_count: Option<i32>,
    
    #[serde(rename = "value_id", skip_serializing_if = "Option::is_none")]
    pub value_id: Option<i32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PullRequestRule {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    
    #[serde(rename = "repo_path", skip_serializing_if = "Option::is_none")]
    pub repo_path: Option<String>,
    
    #[serde(rename = "space_path", skip_serializing_if = "Option::is_none")]
    pub space_path: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub rule_type: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PullRequestStats {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub additions: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commits: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversations: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deletions: Option<i32>,
    
    #[serde(rename = "files_changed", skip_serializing_if = "Option::is_none")]
    pub files_changed: Option<i32>,
    
    #[serde(rename = "unresolved_count", skip_serializing_if = "Option::is_none")]
    pub unresolved_count: Option<i32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreatePullRequest {
    pub title: String,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    #[serde(rename = "source_branch")]
    pub source_branch: String,
    
    #[serde(rename = "target_branch", skip_serializing_if = "Option::is_none")]
    pub target_branch: Option<String>,
    
    #[serde(rename = "is_draft", skip_serializing_if = "Option::is_none")]
    pub is_draft: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PullRequestOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<Vec<String>>,
    
    #[serde(rename = "source_repo_ref", skip_serializing_if = "Option::is_none")]
    pub source_repo_ref: Option<String>,
    
    #[serde(rename = "source_branch", skip_serializing_if = "Option::is_none")]
    pub source_branch: Option<String>,
    
    #[serde(rename = "target_branch", skip_serializing_if = "Option::is_none")]
    pub target_branch: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    
    #[serde(rename = "created_by", skip_serializing_if = "Option::is_none")]
    pub created_by: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort: Option<String>,
    
    #[serde(rename = "created_lt", skip_serializing_if = "Option::is_none")]
    pub created_lt: Option<i64>,
    
    #[serde(rename = "created_gt", skip_serializing_if = "Option::is_none")]
    pub created_gt: Option<i64>,
    
    #[serde(rename = "updated_lt", skip_serializing_if = "Option::is_none")]
    pub updated_lt: Option<i64>,
    
    #[serde(rename = "updated_gt", skip_serializing_if = "Option::is_none")]
    pub updated_gt: Option<i64>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i32>,
    
    #[serde(rename = "author_id", skip_serializing_if = "Option::is_none")]
    pub author_id: Option<i32>,
    
    #[serde(rename = "include_checks", skip_serializing_if = "Option::is_none")]
    pub include_checks: Option<bool>,
}