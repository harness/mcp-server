// Enums for various Harness types

use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum PipelineStatus {
    Success,
    Failed,
    Aborted,
    Expired,
    Running,
    Paused,
    Queued,
    Skipped,
    #[serde(rename = "INTERVENTION_WAITING")]
    InterventionWaiting,
    #[serde(rename = "APPROVAL_WAITING")]
    ApprovalWaiting,
    #[serde(rename = "RESOURCE_WAITING")]
    ResourceWaiting,
    #[serde(rename = "ASYNC_WAITING")]
    AsyncWaiting,
    #[serde(rename = "TASK_WAITING")]
    TaskWaiting,
    #[serde(rename = "TIMED_WAITING")]
    TimedWaiting,
    Discontinuing,
    Queuing,
    NotStarted,
    Suspended,
    Ignorefailed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum ConnectorType {
    Git,
    Github,
    Gitlab,
    Bitbucket,
    #[serde(rename = "Azure Repos")]
    AzureRepos,
    Docker,
    #[serde(rename = "DockerRegistry")]
    DockerRegistry,
    Kubernetes,
    #[serde(rename = "KubernetesCluster")]
    KubernetesCluster,
    Aws,
    #[serde(rename = "CEAws")]
    CeAws,
    Azure,
    #[serde(rename = "CEAzure")]
    CeAzure,
    Gcp,
    #[serde(rename = "GcpCloudCost")]
    GcpCloudCost,
    Artifactory,
    Nexus,
    HttpHelm,
    Oci,
    Jenkins,
    Bamboo,
    Custom,
    Vault,
    #[serde(rename = "AppDynamics")]
    AppDynamics,
    Splunk,
    #[serde(rename = "ElasticSearch")]
    ElasticSearch,
    Prometheus,
    Datadog,
    #[serde(rename = "NewRelic")]
    NewRelic,
    Jira,
    ServiceNow,
    Pagerduty,
    Slack,
    #[serde(rename = "MicrosoftTeams")]
    MicrosoftTeams,
    Email,
    Webhook,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PullRequestState {
    Open,
    Closed,
    Merged,
    Draft,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum ExecutionTriggerType {
    Manual,
    Webhook,
    #[serde(rename = "WEBHOOK_CUSTOM")]
    WebhookCustom,
    Scheduled,
    Artifact,
    Manifest,
    Pipeline,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum ServiceType {
    Kubernetes,
    NativeHelm,
    #[serde(rename = "ServerlessAwsLambda")]
    ServerlessAwsLambda,
    #[serde(rename = "AzureWebApp")]
    AzureWebApp,
    Ecs,
    Elastigroup,
    Asg,
    #[serde(rename = "TanzuApplicationService")]
    TanzuApplicationService,
    CustomDeployment,
    #[serde(rename = "GoogleCloudFunctions")]
    GoogleCloudFunctions,
    #[serde(rename = "AwsLambda")]
    AwsLambda,
    #[serde(rename = "AzureFunctions")]
    AzureFunctions,
    Ssh,
    WinRm,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum EnvironmentType {
    Production,
    #[serde(rename = "PreProduction")]
    PreProduction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum InfrastructureType {
    #[serde(rename = "KubernetesDirect")]
    KubernetesDirect,
    #[serde(rename = "KubernetesGcp")]
    KubernetesGcp,
    #[serde(rename = "KubernetesAzure")]
    KubernetesAzure,
    #[serde(rename = "KubernetesAws")]
    KubernetesAws,
    #[serde(rename = "ServerlessAwsLambda")]
    ServerlessAwsLambda,
    #[serde(rename = "Pdc")]
    Pdc,
    #[serde(rename = "SshWinRmAws")]
    SshWinRmAws,
    #[serde(rename = "SshWinRmAzure")]
    SshWinRmAzure,
    #[serde(rename = "AzureWebApp")]
    AzureWebApp,
    #[serde(rename = "EcsRolling")]
    EcsRolling,
    #[serde(rename = "TanzuApplicationService")]
    TanzuApplicationService,
    CustomDeployment,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum ConnectorConnectivityStatus {
    Success,
    Failure,
    Partial,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum RecommendationState {
    Open,
    Applied,
    Ignored,
    Invalid,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum AnomalyStatus {
    Open,
    Acknowledged,
    False_Positive,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum StepType {
    Run,
    #[serde(rename = "RunTests")]
    RunTests,
    #[serde(rename = "BuildAndPushDockerRegistry")]
    BuildAndPushDockerRegistry,
    #[serde(rename = "BuildAndPushECR")]
    BuildAndPushEcr,
    #[serde(rename = "BuildAndPushGCR")]
    BuildAndPushGcr,
    #[serde(rename = "SaveCacheS3")]
    SaveCacheS3,
    #[serde(rename = "RestoreCacheS3")]
    RestoreCacheS3,
    #[serde(rename = "Security")]
    Security,
    #[serde(rename = "GitClone")]
    GitClone,
    Plugin,
    Action,
    #[serde(rename = "Background")]
    Background,
    #[serde(rename = "Parallel")]
    Parallel,
    #[serde(rename = "StepGroup")]
    StepGroup,
}

// Implement Display for better string representation
impl fmt::Display for PipelineStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PipelineStatus::Success => write!(f, "SUCCESS"),
            PipelineStatus::Failed => write!(f, "FAILED"),
            PipelineStatus::Aborted => write!(f, "ABORTED"),
            PipelineStatus::Expired => write!(f, "EXPIRED"),
            PipelineStatus::Running => write!(f, "RUNNING"),
            PipelineStatus::Paused => write!(f, "PAUSED"),
            PipelineStatus::Queued => write!(f, "QUEUED"),
            PipelineStatus::Skipped => write!(f, "SKIPPED"),
            PipelineStatus::InterventionWaiting => write!(f, "INTERVENTION_WAITING"),
            PipelineStatus::ApprovalWaiting => write!(f, "APPROVAL_WAITING"),
            PipelineStatus::ResourceWaiting => write!(f, "RESOURCE_WAITING"),
            PipelineStatus::AsyncWaiting => write!(f, "ASYNC_WAITING"),
            PipelineStatus::TaskWaiting => write!(f, "TASK_WAITING"),
            PipelineStatus::TimedWaiting => write!(f, "TIMED_WAITING"),
            PipelineStatus::Discontinuing => write!(f, "DISCONTINUING"),
            PipelineStatus::Queuing => write!(f, "QUEUING"),
            PipelineStatus::NotStarted => write!(f, "NOT_STARTED"),
            PipelineStatus::Suspended => write!(f, "SUSPENDED"),
            PipelineStatus::Ignorefailed => write!(f, "IGNOREFAILED"),
        }
    }
}

impl fmt::Display for ConnectorType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            ConnectorType::Git => "Git",
            ConnectorType::Github => "Github",
            ConnectorType::Gitlab => "Gitlab",
            ConnectorType::Bitbucket => "Bitbucket",
            ConnectorType::AzureRepos => "Azure Repos",
            ConnectorType::Docker => "Docker",
            ConnectorType::DockerRegistry => "DockerRegistry",
            ConnectorType::Kubernetes => "Kubernetes",
            ConnectorType::KubernetesCluster => "KubernetesCluster",
            ConnectorType::Aws => "Aws",
            ConnectorType::CeAws => "CEAws",
            ConnectorType::Azure => "Azure",
            ConnectorType::CeAzure => "CEAzure",
            ConnectorType::Gcp => "Gcp",
            ConnectorType::GcpCloudCost => "GcpCloudCost",
            ConnectorType::Artifactory => "Artifactory",
            ConnectorType::Nexus => "Nexus",
            ConnectorType::HttpHelm => "HttpHelm",
            ConnectorType::Oci => "Oci",
            ConnectorType::Jenkins => "Jenkins",
            ConnectorType::Bamboo => "Bamboo",
            ConnectorType::Custom => "Custom",
            ConnectorType::Vault => "Vault",
            ConnectorType::AppDynamics => "AppDynamics",
            ConnectorType::Splunk => "Splunk",
            ConnectorType::ElasticSearch => "ElasticSearch",
            ConnectorType::Prometheus => "Prometheus",
            ConnectorType::Datadog => "Datadog",
            ConnectorType::NewRelic => "NewRelic",
            ConnectorType::Jira => "Jira",
            ConnectorType::ServiceNow => "ServiceNow",
            ConnectorType::Pagerduty => "Pagerduty",
            ConnectorType::Slack => "Slack",
            ConnectorType::MicrosoftTeams => "MicrosoftTeams",
            ConnectorType::Email => "Email",
            ConnectorType::Webhook => "Webhook",
        };
        write!(f, "{}", s)
    }
}