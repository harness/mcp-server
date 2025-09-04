// Repository and Pull Request DTOs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryDetail {
    pub identifier: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "defaultBranch")]
    pub default_branch: String,
    #[serde(rename = "gitURL")]
    pub git_url: String,
    #[serde(rename = "sshURL")]
    pub ssh_url: String,
    #[serde(rename = "httpURL")]
    pub http_url: String,
    pub path: String,
    #[serde(rename = "isPublic")]
    pub is_public: bool,
    #[serde(rename = "createdBy")]
    pub created_by: i64,
    #[serde(rename = "updatedBy")]
    pub updated_by: i64,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<i64>,
    #[serde(rename = "sizeUpdatedAt", skip_serializing_if = "Option::is_none")]
    pub size_updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestDetail {
    pub number: i32,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub state: String,
    #[serde(rename = "isDraft")]
    pub is_draft: bool,
    #[serde(rename = "sourceBranch")]
    pub source_branch: String,
    #[serde(rename = "sourceSHA")]
    pub source_sha: String,
    #[serde(rename = "targetBranch")]
    pub target_branch: String,
    #[serde(rename = "targetSHA")]
    pub target_sha: String,
    #[serde(rename = "mergeMethod", skip_serializing_if = "Option::is_none")]
    pub merge_method: Option<String>,
    #[serde(rename = "mergeBaseSHA", skip_serializing_if = "Option::is_none")]
    pub merge_base_sha: Option<String>,
    #[serde(rename = "mergeSHA", skip_serializing_if = "Option::is_none")]
    pub merge_sha: Option<String>,
    #[serde(rename = "mergedBy", skip_serializing_if = "Option::is_none")]
    pub merged_by: Option<i64>,
    #[serde(rename = "mergedAt", skip_serializing_if = "Option::is_none")]
    pub merged_at: Option<i64>,
    pub author: PullRequestUser,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merger: Option<PullRequestUser>,
    #[serde(rename = "createdBy")]
    pub created_by: i64,
    #[serde(rename = "updatedBy")]
    pub updated_by: i64,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "editedAt", skip_serializing_if = "Option::is_none")]
    pub edited_at: Option<i64>,
    pub stats: PullRequestStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestUser {
    pub id: i64,
    pub uid: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub email: String,
    #[serde(rename = "type")]
    pub user_type: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestStats {
    pub commits: i32,
    #[serde(rename = "filesChanged")]
    pub files_changed: i32,
    pub additions: i32,
    pub deletions: i32,
    pub conversations: i32,
    #[serde(rename = "unresolved")]
    pub unresolved: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestCheck {
    pub identifier: String,
    pub name: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details_url: Option<String>,
    #[serde(rename = "reportedAt")]
    pub reported_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestActivity {
    pub id: i64,
    #[serde(rename = "type")]
    pub activity_type: String,
    #[serde(rename = "createdBy")]
    pub created_by: i64,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<serde_json::Value>,
    pub author: PullRequestUser,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Branch {
    pub name: String,
    pub sha: String,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
    #[serde(rename = "isProtected")]
    pub is_protected: bool,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Commit {
    pub sha: String,
    pub message: String,
    pub author: CommitUser,
    pub committer: CommitUser,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stats: Option<CommitStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitUser {
    pub identity: CommitIdentity,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<PullRequestUser>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitIdentity {
    pub name: String,
    pub email: String,
    #[serde(rename = "when")]
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitStats {
    pub total: i32,
    pub additions: i32,
    pub deletions: i32,
}

// Request types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryListRequest {
    #[serde(rename = "query", skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    #[serde(rename = "sort", skip_serializing_if = "Option::is_none")]
    pub sort: Option<String>,
    #[serde(rename = "order", skip_serializing_if = "Option::is_none")]
    pub order: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestListRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(rename = "sort", skip_serializing_if = "Option::is_none")]
    pub sort: Option<String>,
    #[serde(rename = "order", skip_serializing_if = "Option::is_none")]
    pub order: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<i32>,
    #[serde(rename = "createdBy", skip_serializing_if = "Option::is_none")]
    pub created_by: Option<i64>,
    #[serde(rename = "sourceBranch", skip_serializing_if = "Option::is_none")]
    pub source_branch: Option<String>,
    #[serde(rename = "targetBranch", skip_serializing_if = "Option::is_none")]
    pub target_branch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePullRequestRequest {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "sourceBranch")]
    pub source_branch: String,
    #[serde(rename = "targetBranch")]
    pub target_branch: String,
    #[serde(rename = "isDraft", skip_serializing_if = "Option::is_none")]
    pub is_draft: Option<bool>,
}