use anyhow::Result;
use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::config::Config;
use crate::tools::Tool;
use crate::common::Scope;

// Helper functions for parameter extraction
fn get_required_param<T>(arguments: &Value, key: &str) -> Result<T>
where
    T: serde::de::DeserializeOwned,
{
    arguments
        .get(key)
        .ok_or_else(|| anyhow::anyhow!("Missing required parameter: {}", key))?
        .clone()
        .try_into()
        .map_err(|_| anyhow::anyhow!("Invalid type for parameter: {}", key))
}

fn get_optional_param<T>(arguments: &Value, key: &str) -> Result<Option<T>>
where
    T: serde::de::DeserializeOwned,
{
    match arguments.get(key) {
        Some(value) => Ok(Some(
            value
                .clone()
                .try_into()
                .map_err(|_| anyhow::anyhow!("Invalid type for parameter: {}", key))?,
        )),
        None => Ok(None),
    }
}

fn get_scope_from_request(arguments: &Value, config: &Config) -> Result<Scope> {
    let account_id = config.account_id.clone().unwrap_or_default();
    let org_id = get_optional_param::<String>(arguments, "org_id")?
        .or_else(|| config.default_org_id.clone());
    let project_id = get_optional_param::<String>(arguments, "project_id")?
        .or_else(|| config.default_project_id.clone());

    // For connectors, project_id is optional (can be account or org level)
    if let (Some(org_id), Some(project_id)) = (org_id.clone(), project_id) {
        Ok(Scope::project_level(account_id, org_id, project_id))
    } else if let Some(org_id) = org_id {
        Ok(Scope::org_level(account_id, org_id))
    } else {
        Ok(Scope::account_level(account_id))
    }
}

fn parse_string_slice(input: Option<String>) -> Vec<String> {
    match input {
        Some(s) if !s.is_empty() => s
            .split(',')
            .map(|part| part.trim().to_string())
            .filter(|part| !part.is_empty())
            .collect(),
        _ => Vec::new(),
    }
}

// List Connector Catalogue Tool
pub struct ListConnectorCatalogueTool;

impl ListConnectorCatalogueTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for ListConnectorCatalogueTool {
    fn name(&self) -> &str {
        "list_connector_catalogue"
    }

    fn description(&self) -> &str {
        "List the Harness connector catalogue."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "org_id": {
                    "type": "string",
                    "description": "Organization ID (optional)"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID (optional)"
                }
            }
        })
    }

    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value> {
        let _scope = get_scope_from_request(arguments, config)?;

        // TODO: Implement actual API call to Harness
        let result = json!({
            "catalogue": [
                {
                    "type": "K8sCluster",
                    "category": "CLOUD_PROVIDER",
                    "name": "Kubernetes Cluster",
                    "description": "Connect to Kubernetes clusters"
                },
                {
                    "type": "Git",
                    "category": "CODE_REPO",
                    "name": "Git Repository",
                    "description": "Connect to Git repositories"
                },
                {
                    "type": "DockerRegistry",
                    "category": "ARTIFACTORY",
                    "name": "Docker Registry",
                    "description": "Connect to Docker registries"
                }
            ]
        });

        Ok(json!(serde_json::to_string(&result)?))
    }
}

// Get Connector Details Tool
pub struct GetConnectorDetailsTool;

impl GetConnectorDetailsTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for GetConnectorDetailsTool {
    fn name(&self) -> &str {
        "get_connector_details"
    }

    fn description(&self) -> &str {
        "Get detailed information about a specific connector."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "connector_identifier": {
                    "type": "string",
                    "description": "The identifier of the connector"
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID (optional)"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID (optional)"
                }
            },
            "required": ["connector_identifier"]
        })
    }

    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value> {
        let connector_identifier: String = get_required_param(arguments, "connector_identifier")?;
        let _scope = get_scope_from_request(arguments, config)?;

        // TODO: Implement actual API call to Harness
        let result = json!({
            "connector": {
                "name": format!("Connector {}", connector_identifier),
                "identifier": connector_identifier,
                "description": "Sample connector description",
                "type": "K8sCluster",
                "category": "CLOUD_PROVIDER",
                "accountIdentifier": config.account_id,
                "orgIdentifier": config.default_org_id,
                "projectIdentifier": config.default_project_id,
                "tags": {}
            },
            "createdAt": 1640995200000i64,
            "lastModifiedAt": 1640995800000i64,
            "status": {
                "status": "SUCCESS",
                "errorSummary": null,
                "errors": [],
                "testedAt": 1640995800000i64,
                "lastTestedAt": 1640995800000i64,
                "lastConnectedAt": 1640995800000i64
            },
            "activityDetails": {
                "lastActivityTime": 1640995800000i64
            },
            "harnessManaged": false,
            "isFavorite": false
        });

        Ok(json!(serde_json::to_string(&result)?))
    }
}

// List Connectors Tool
pub struct ListConnectorsTool;

impl ListConnectorsTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for ListConnectorsTool {
    fn name(&self) -> &str {
        "list_connectors"
    }

    fn description(&self) -> &str {
        "List connectors with filtering options."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "connector_names": {
                    "type": "string",
                    "description": "Comma-separated list of connector names to filter by"
                },
                "connector_identifiers": {
                    "type": "string",
                    "description": "Comma-separated list of connector identifiers to filter by"
                },
                "description": {
                    "type": "string",
                    "description": "Filter by connector description"
                },
                "types": {
                    "type": "string",
                    "description": "Comma-separated list of connector types",
                    "enum": ["K8sCluster", "Git", "Splunk", "AppDynamics", "Prometheus", "Dynatrace", "Vault", "AzureKeyVault", "DockerRegistry", "Local", "AwsKms", "GcpKms", "AwsSecretManager", "Gcp", "Aws", "Azure", "Artifactory", "Jira", "Nexus", "Github", "Gitlab", "Bitbucket", "Codecommit", "CEAws", "CEAzure", "GcpCloudCost", "CEK8sCluster", "HttpHelmRepo", "NewRelic", "Datadog", "SumoLogic", "PagerDuty", "CustomHealth", "ServiceNow", "ErrorTracking", "Pdc", "AzureRepo", "Jenkins", "OciHelmRepo", "CustomSecretManager", "ElasticSearch", "GcpSecretManager", "AzureArtifacts", "Tas", "Spot", "Bamboo", "TerraformCloud", "SignalFX", "Harness", "Rancher", "JDBC", "Zoom", "MsTeams", "Confluence", "Slack", "Salesforce", "LangSmith", "MLFlow"]
                },
                "categories": {
                    "type": "string",
                    "description": "Comma-separated list of connector categories",
                    "enum": ["CLOUD_PROVIDER", "SECRET_MANAGER", "CLOUD_COST", "ARTIFACTORY", "CODE_REPO", "MONITORING", "TICKETING", "DATABASE", "COMMUNICATION", "DOCUMENTATION", "ML_OPS"]
                },
                "connectivity_statuses": {
                    "type": "string",
                    "description": "Comma-separated list of connectivity statuses",
                    "enum": ["SUCCESS", "FAILURE", "PARTIAL", "UNKNOWN", "PENDING"]
                },
                "inheriting_credentials_from_delegate": {
                    "type": "boolean",
                    "description": "Filter by whether connectors inherit credentials from delegate"
                },
                "connector_connectivity_modes": {
                    "type": "string",
                    "description": "Comma-separated list of connectivity modes",
                    "enum": ["DELEGATE", "MANAGER"]
                },
                "tags": {
                    "type": "string",
                    "description": "JSON object of tags to filter by (e.g., {\"env\":\"prod\"})"
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID (optional)"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID (optional)"
                }
            }
        })
    }

    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value> {
        let _scope = get_scope_from_request(arguments, config)?;

        // Parse optional parameters
        let _connector_names = parse_string_slice(get_optional_param(arguments, "connector_names")?);
        let _connector_identifiers = parse_string_slice(get_optional_param(arguments, "connector_identifiers")?);
        let _description: Option<String> = get_optional_param(arguments, "description")?;
        let _types = parse_string_slice(get_optional_param(arguments, "types")?);
        let _categories = parse_string_slice(get_optional_param(arguments, "categories")?);
        let _connectivity_statuses = parse_string_slice(get_optional_param(arguments, "connectivity_statuses")?);
        let _inheriting_credentials_from_delegate: Option<bool> = get_optional_param(arguments, "inheriting_credentials_from_delegate")?;
        let _connector_connectivity_modes = parse_string_slice(get_optional_param(arguments, "connector_connectivity_modes")?);
        
        let mut _tags: Option<HashMap<String, String>> = None;
        if let Some(tags_str) = get_optional_param::<String>(arguments, "tags")? {
            if !tags_str.is_empty() {
                _tags = Some(serde_json::from_str(&tags_str)?);
            }
        }

        // TODO: Implement actual API call to Harness
        let result = json!({
            "content": [
                {
                    "connector": {
                        "name": "Sample Connector",
                        "identifier": "sample_connector",
                        "description": "A sample connector",
                        "type": "K8sCluster",
                        "category": "CLOUD_PROVIDER",
                        "accountIdentifier": config.account_id,
                        "orgIdentifier": config.default_org_id,
                        "projectIdentifier": config.default_project_id,
                        "tags": {}
                    },
                    "createdAt": 1640995200000i64,
                    "lastModifiedAt": 1640995800000i64,
                    "status": {
                        "status": "SUCCESS",
                        "errorSummary": null,
                        "errors": [],
                        "testedAt": 1640995800000i64,
                        "lastTestedAt": 1640995800000i64,
                        "lastConnectedAt": 1640995800000i64
                    },
                    "activityDetails": {
                        "lastActivityTime": 1640995800000i64
                    },
                    "harnessManaged": false,
                    "isFavorite": false
                }
            ],
            "pageInfo": {
                "page": 0,
                "size": 20,
                "hasNext": false,
                "hasPrev": false
            },
            "empty": false,
            "totalElements": 1,
            "totalPages": 1
        });

        Ok(json!(serde_json::to_string(&result)?))
    }
}