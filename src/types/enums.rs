use serde::{Deserialize, Serialize};
use std::fmt;

/// Transport protocol for the MCP server
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransportType {
    /// Standard input/output transport
    Stdio,
    /// HTTP transport
    Http,
    /// Internal transport mode
    Internal,
}

impl fmt::Display for TransportType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TransportType::Stdio => write!(f, "stdio"),
            TransportType::Http => write!(f, "http"),
            TransportType::Internal => write!(f, "internal"),
        }
    }
}

impl TransportType {
    pub fn parse(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "http" => TransportType::Http,
            "internal" => TransportType::Internal,
            _ => TransportType::Stdio,
        }
    }
}

/// Harness module types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ModuleType {
    Core,
    Ci,
    Cd,
    Ccm,
    Chaos,
    Code,
    Har,
    Idp,
    Sei,
    Ssca,
    Sto,
    Acm,
    Dbops,
}

impl fmt::Display for ModuleType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ModuleType::Core => write!(f, "CORE"),
            ModuleType::Ci => write!(f, "CI"),
            ModuleType::Cd => write!(f, "CD"),
            ModuleType::Ccm => write!(f, "CCM"),
            ModuleType::Chaos => write!(f, "CHAOS"),
            ModuleType::Code => write!(f, "CODE"),
            ModuleType::Har => write!(f, "HAR"),
            ModuleType::Idp => write!(f, "IDP"),
            ModuleType::Sei => write!(f, "SEI"),
            ModuleType::Ssca => write!(f, "SSCA"),
            ModuleType::Sto => write!(f, "STO"),
            ModuleType::Acm => write!(f, "ACM"),
            ModuleType::Dbops => write!(f, "DBOPS"),
        }
    }
}

/// License status for modules
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum LicenseStatus {
    Active,
    Inactive,
    Expired,
}

impl fmt::Display for LicenseStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LicenseStatus::Active => write!(f, "ACTIVE"),
            LicenseStatus::Inactive => write!(f, "INACTIVE"),
            LicenseStatus::Expired => write!(f, "EXPIRED"),
        }
    }
}

/// Connectivity modes for connectors
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectivityMode {
    Manager,
    Delegate,
}

impl fmt::Display for ConnectivityMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConnectivityMode::Manager => write!(f, "manager"),
            ConnectivityMode::Delegate => write!(f, "delegate"),
        }
    }
}

/// Delegate types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum DelegateType {
    Docker,
    Kubernetes,
    Shell,
}

impl fmt::Display for DelegateType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DelegateType::Docker => write!(f, "DOCKER"),
            DelegateType::Kubernetes => write!(f, "KUBERNETES"),
            DelegateType::Shell => write!(f, "SHELL"),
        }
    }
}

/// Pipeline execution status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ExecutionStatus {
    Success,
    Failed,
    Aborted,
    Expired,
    Running,
    Paused,
    NotStarted,
    Queued,
}

impl fmt::Display for ExecutionStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ExecutionStatus::Success => write!(f, "SUCCESS"),
            ExecutionStatus::Failed => write!(f, "FAILED"),
            ExecutionStatus::Aborted => write!(f, "ABORTED"),
            ExecutionStatus::Expired => write!(f, "EXPIRED"),
            ExecutionStatus::Running => write!(f, "RUNNING"),
            ExecutionStatus::Paused => write!(f, "PAUSED"),
            ExecutionStatus::NotStarted => write!(f, "NOT_STARTED"),
            ExecutionStatus::Queued => write!(f, "QUEUED"),
        }
    }
}

/// Pull request state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PullRequestState {
    Open,
    Closed,
    Merged,
}

impl fmt::Display for PullRequestState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PullRequestState::Open => write!(f, "open"),
            PullRequestState::Closed => write!(f, "closed"),
            PullRequestState::Merged => write!(f, "merged"),
        }
    }
}