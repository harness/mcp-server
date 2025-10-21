use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Common response status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ResponseStatus {
    Success,
    Failure,
    Error,
}

/// Common error codes used across Harness APIs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorCode {
    #[serde(rename = "INVALID_REQUEST")]
    InvalidRequest,
    #[serde(rename = "RESOURCE_NOT_FOUND")]
    ResourceNotFound,
    #[serde(rename = "ACCESS_DENIED")]
    AccessDenied,
    #[serde(rename = "INVALID_ARGUMENT")]
    InvalidArgument,
    #[serde(rename = "INTERNAL_ERROR")]
    InternalError,
    #[serde(rename = "RATE_LIMIT_EXCEEDED")]
    RateLimitExceeded,
}

/// Sort order for list requests
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum SortOrder {
    Asc,
    Desc,
}

/// Filter operator for advanced filtering
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum FilterOperator {
    Equals,
    NotEquals,
    In,
    NotIn,
    Like,
    StartsWith,
    EndsWith,
    GreaterThan,
    LessThan,
    GreaterThanOrEqual,
    LessThanOrEqual,
}

/// Generic filter for list requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Filter {
    pub field: String,
    pub operator: FilterOperator,
    pub values: Vec<String>,
}

/// Advanced search criteria
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchCriteria {
    pub filters: Option<Vec<Filter>>,
    pub search_term: Option<String>,
    pub sort_orders: Option<Vec<SortCriteria>>,
}

/// Sort criteria for ordering results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortCriteria {
    pub field: String,
    pub order: SortOrder,
}

/// Time range filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRange {
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
}

/// Execution status enum
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ExecutionStatus {
    Running,
    Success,
    Failed,
    Aborted,
    Expired,
    Paused,
    Queued,
    Skipped,
    Suspended,
    #[serde(rename = "APPROVAL_WAITING")]
    ApprovalWaiting,
    #[serde(rename = "INTERVENTION_WAITING")]
    InterventionWaiting,
    #[serde(rename = "APPROVAL_REJECTED")]
    ApprovalRejected,
}

/// Pipeline execution mode
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ExecutionMode {
    Normal,
    Pipeline,
    PipelineRollback,
    Child,
    ChildRollback,
}

/// Trigger type for pipeline executions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum TriggerType {
    Manual,
    Webhook,
    Scheduled,
    Artifact,
    Manifest,
}

/// Connector category
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ConnectorCategory {
    CloudProvider,
    ArtifactRegistry,
    SourceRepo,
    Monitoring,
    SecretManager,
    CloudCost,
    TicketingSystem,
    Verification,
}

/// Connector type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConnectorType {
    K8sCluster,
    Git,
    Github,
    Gitlab,
    Bitbucket,
    DockerRegistry,
    Aws,
    Gcp,
    Azure,
    Vault,
    AwsSecretManager,
    AzureKeyVault,
    GcpSecretManager,
    AppDynamics,
    NewRelic,
    Datadog,
    Splunk,
    SumoLogic,
    Jira,
    ServiceNow,
    PagerDuty,
    Slack,
    MicrosoftTeams,
    Email,
    Webhook,
}

/// Resource scope level
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ScopeLevel {
    Account,
    Organization,
    Project,
}

/// Git provider type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum GitProvider {
    Github,
    Gitlab,
    Bitbucket,
    Azure,
    Harness,
}

/// Entity type for various Harness resources
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum EntityType {
    Pipeline,
    Service,
    Environment,
    Infrastructure,
    Connector,
    Secret,
    Template,
    InputSet,
    Trigger,
    Variable,
    FileStore,
}

/// Health status for various resources
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum HealthStatus {
    Healthy,
    Unhealthy,
    Unknown,
    Warning,
}

/// Common metadata for Harness entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityMetadata {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub version: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Git sync information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitSyncInfo {
    #[serde(rename = "repoIdentifier")]
    pub repo_identifier: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "rootFolder")]
    pub root_folder: Option<String>,
    pub branch: Option<String>,
    #[serde(rename = "commitId")]
    pub commit_id: Option<String>,
}

/// User information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub uuid: Option<String>,
    pub name: Option<String>,
    pub email: Option<String>,
    pub username: Option<String>,
}

/// Audit information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditInfo {
    #[serde(rename = "createdBy")]
    pub created_by: Option<UserInfo>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedBy")]
    pub last_modified_by: Option<UserInfo>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}