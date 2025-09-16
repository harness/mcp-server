use serde_json::json;
use harness_mcp_server::types::common::*;
use harness_mcp_server::types::connectors::*;
use harness_mcp_server::types::pipelines::*;

#[tokio::test]
async fn test_harness_response_compatibility() {
    // Test successful response
    let success_json = json!({
        "status": "SUCCESS",
        "data": {
            "name": "test-pipeline",
            "identifier": "test-id"
        },
        "metaData": null,
        "correlationId": "corr-123"
    });

    let response: Result<HarnessResponse<serde_json::Value>, _> = 
        serde_json::from_value(success_json);
    assert!(response.is_ok());
    
    let resp = response.unwrap();
    assert_eq!(resp.status, "SUCCESS");
    assert!(resp.is_success());
    assert!(resp.data.is_some());
}

#[tokio::test]
async fn test_scope_compatibility() {
    // Test account-level scope
    let account_scope = Scope::new("acc123".to_string());
    assert!(account_scope.account_only());
    assert!(!account_scope.org_level());
    assert!(!account_scope.project_level());

    // Test org-level scope
    let org_scope = Scope::new("acc123".to_string())
        .with_org("org456".to_string());
    assert!(!org_scope.account_only());
    assert!(org_scope.org_level());
    assert!(!org_scope.project_level());

    // Test project-level scope
    let project_scope = Scope::new("acc123".to_string())
        .with_org("org456".to_string())
        .with_project("proj789".to_string());
    assert!(!project_scope.account_only());
    assert!(!project_scope.org_level());
    assert!(project_scope.project_level());
}

#[tokio::test]
async fn test_connector_detail_serialization() {
    let connector_json = json!({
        "connector": {
            "name": "test-connector",
            "identifier": "test-id",
            "accountIdentifier": "acc123",
            "orgIdentifier": "org456",
            "projectIdentifier": "proj789",
            "type": "K8sCluster",
            "spec": {
                "credential": {
                    "type": "ManualConfig"
                }
            }
        },
        "createdAt": 1640995200000i64,
        "lastModifiedAt": 1640995200000i64,
        "status": {
            "status": "SUCCESS",
            "errors": []
        },
        "activityDetails": {
            "lastActivityTime": 1640995200000i64
        },
        "harnessManaged": false,
        "gitDetails": {
            "valid": true
        },
        "entityValidityDetails": {
            "valid": true
        },
        "isFavorite": false
    });

    let connector: Result<ConnectorDetail, _> = serde_json::from_value(connector_json);
    assert!(connector.is_ok());
    
    let conn = connector.unwrap();
    assert_eq!(conn.connector.name, "test-connector");
    assert_eq!(conn.connector.connector_type, "K8sCluster");
    assert_eq!(conn.created_at, 1640995200000i64);
    assert!(!conn.harness_managed);
}

#[tokio::test]
async fn test_connector_with_human_time() {
    let connector_detail = ConnectorDetail {
        connector: Connector {
            name: "test".to_string(),
            identifier: "test-id".to_string(),
            description: None,
            account_identifier: "acc123".to_string(),
            org_identifier: Some("org456".to_string()),
            project_identifier: Some("proj789".to_string()),
            tags: None,
            connector_type: "K8sCluster".to_string(),
            spec: json!({}),
        },
        created_at: 1640995200000i64,
        last_modified_at: 1640995200000i64,
        status: ConnectorStatus {
            status: "SUCCESS".to_string(),
            error_summary: None,
            errors: None,
            tested_at: Some(1640995200000i64),
            last_tested_at: None,
            last_connected_at: None,
            last_alert_sent: None,
        },
        activity_details: ActivityDetails {
            last_activity_time: Some(1640995200000i64),
        },
        harness_managed: false,
        git_details: GitDetails {
            valid: true,
            invalid_yaml: None,
            repo_identifier: None,
            file_path: None,
            branch: None,
        },
        entity_validity_details: EntityValidityDetails {
            valid: true,
            invalid_yaml: None,
        },
        governance_metadata: None,
        is_favorite: false,
    };

    let human_time = ConnectorDetailWithHumanTime::from_detail(connector_detail);
    assert!(human_time.created_at_time.contains("2022"));
    assert!(human_time.status.tested_at_time.is_some());
}

#[tokio::test]
async fn test_pipeline_execution_serialization() {
    let execution_json = json!({
        "pipelineIdentifier": "test-pipeline",
        "projectIdentifier": "proj789",
        "orgIdentifier": "org456",
        "planExecutionId": "exec-123",
        "name": "Test Execution",
        "status": "Success",
        "startTs": 1640995200000i64,
        "endTs": 1640995260000i64,
        "createdAt": 1640995200000i64,
        "successfulStagesCount": 3,
        "failedStagesCount": 0,
        "runningStagesCount": 0,
        "runSequence": 1
    });

    let execution: Result<PipelineExecution, _> = serde_json::from_value(execution_json);
    assert!(execution.is_ok());
    
    let exec = execution.unwrap();
    assert_eq!(exec.pipeline_identifier, Some("test-pipeline".to_string()));
    assert_eq!(exec.status, Some("Success".to_string()));
    assert_eq!(exec.successful_stages_count, Some(3));
    
    // Test duration calculation
    assert_eq!(exec.duration_seconds(), Some(60)); // 60 seconds
}

#[tokio::test]
async fn test_pipeline_list_item_serialization() {
    let pipeline_json = json!({
        "name": "Test Pipeline",
        "identifier": "test-pipeline",
        "description": "A test pipeline",
        "tags": {
            "env": "test",
            "team": "platform"
        },
        "version": 1,
        "numOfStages": 3,
        "createdAt": 1640995200000i64,
        "lastUpdatedAt": 1640995260000i64,
        "modules": ["ci", "cd"],
        "executionSummaryInfo": {
            "lastExecutionStatus": "Success",
            "lastExecutionId": "exec-123",
            "lastExecutionTs": 1640995200000i64
        },
        "stageNames": ["Build", "Test", "Deploy"],
        "yamlVersion": "0"
    });

    let pipeline: Result<PipelineListItem, _> = serde_json::from_value(pipeline_json);
    assert!(pipeline.is_ok());
    
    let pipe = pipeline.unwrap();
    assert_eq!(pipe.name, Some("Test Pipeline".to_string()));
    assert_eq!(pipe.num_of_stages, Some(3));
    assert!(pipe.tags.is_some());
    assert_eq!(pipe.modules, Some(vec!["ci".to_string(), "cd".to_string()]));
    
    // Test human-readable time methods
    assert!(pipe.created_at_time().is_some());
    assert!(pipe.last_updated_at_time().is_some());
}

#[tokio::test]
async fn test_connector_list_request_body() {
    let request_body = ConnectorListRequestBody {
        connector_names: Some(vec!["conn1".to_string(), "conn2".to_string()]),
        types: Some(vec!["K8sCluster".to_string(), "DockerRegistry".to_string()]),
        categories: Some(vec!["CloudProvider".to_string()]),
        connectivity_statuses: Some(vec!["SUCCESS".to_string()]),
        inheriting_credentials_from_delegate: Some(true),
        tags: Some({
            let mut tags = std::collections::HashMap::new();
            tags.insert("env".to_string(), "prod".to_string());
            tags
        }),
        filter_type: Some("Connector".to_string()),
        ..Default::default()
    };

    let json_result = serde_json::to_value(&request_body);
    assert!(json_result.is_ok());
    
    let json = json_result.unwrap();
    assert_eq!(json["connectorNames"][0], "conn1");
    assert_eq!(json["types"][0], "K8sCluster");
    assert_eq!(json["inheritingCredentialsFromDelegate"], true);
}

#[tokio::test]
async fn test_pagination_options() {
    let pagination = PaginationOptions {
        page: Some(0),
        size: Some(20),
    };

    let json_result = serde_json::to_value(&pagination);
    assert!(json_result.is_ok());
    
    let json = json_result.unwrap();
    assert_eq!(json["page"], 0);
    assert_eq!(json["size"], 20);
}

#[tokio::test]
async fn test_unix_millis_conversion() {
    let timestamp = 1640995200000i64; // 2022-01-01 00:00:00 UTC
    
    let datetime = unix_millis_to_datetime(timestamp);
    assert!(datetime.is_some());
    
    let rfc3339 = unix_millis_to_rfc3339(timestamp);
    assert!(rfc3339.is_some());
    assert!(rfc3339.unwrap().contains("2022"));
    
    // Test invalid timestamp
    let invalid = unix_millis_to_rfc3339(0);
    assert!(invalid.is_none());
}

#[tokio::test]
async fn test_execution_failure_info() {
    let failure_json = json!({
        "failureTypeList": ["AUTHENTICATION_ERROR", "TIMEOUT"],
        "responseMessages": [
            {
                "code": "AUTH_001",
                "message": "Authentication failed",
                "level": "ERROR",
                "exception": {
                    "message": "Invalid credentials"
                }
            }
        ]
    });

    let failure: Result<ExecutionFailureInfo, _> = serde_json::from_value(failure_json);
    assert!(failure.is_ok());
    
    let fail = failure.unwrap();
    assert_eq!(fail.failure_type_list, Some(vec!["AUTHENTICATION_ERROR".to_string(), "TIMEOUT".to_string()]));
    assert!(fail.response_messages.is_some());
    
    let messages = fail.response_messages.unwrap();
    assert_eq!(messages[0].code, Some("AUTH_001".to_string()));
    assert_eq!(messages[0].level, Some("ERROR".to_string()));
}