use harness_mcp_client::{
    client::*,
    dto::*,
    error::*,
};
use serde_json::json;

#[test]
fn test_scope_creation() {
    let scope = Scope {
        account_id: "test_account".to_string(),
        org_id: Some("test_org".to_string()),
        project_id: Some("test_project".to_string()),
    };
    
    assert_eq!(scope.account_id, "test_account");
    assert_eq!(scope.org_id, Some("test_org".to_string()));
    assert_eq!(scope.project_id, Some("test_project".to_string()));
}

#[test]
fn test_pipeline_list_options_default() {
    let options = PipelineListOptions::default();
    assert_eq!(options.page, Some(0));
    assert_eq!(options.size, Some(5));
    assert_eq!(options.search_term, None);
}

#[test]
fn test_pipeline_serialization() {
    let pipeline = Pipeline {
        identifier: "test_pipeline".to_string(),
        name: "Test Pipeline".to_string(),
        description: Some("A test pipeline".to_string()),
        tags: None,
        version: Some(1),
        created: None,
        updated: None,
        yaml: Some("pipeline:\n  name: test".to_string()),
    };
    
    let serialized = serde_json::to_string(&pipeline);
    assert!(serialized.is_ok());
    
    let deserialized: Result<Pipeline, _> = serde_json::from_str(&serialized.unwrap());
    assert!(deserialized.is_ok());
    
    let deserialized_pipeline = deserialized.unwrap();
    assert_eq!(pipeline.identifier, deserialized_pipeline.identifier);
    assert_eq!(pipeline.name, deserialized_pipeline.name);
}

#[test]
fn test_pipeline_execution_serialization() {
    let execution = PipelineExecution {
        plan_execution_id: "exec_123".to_string(),
        pipeline_identifier: "pipeline_456".to_string(),
        status: "SUCCESS".to_string(),
        created: None,
        started: None,
        ended: None,
        trigger_type: Some("MANUAL".to_string()),
    };
    
    let serialized = serde_json::to_string(&execution);
    assert!(serialized.is_ok());
    
    let json_value: serde_json::Value = serde_json::from_str(&serialized.unwrap()).unwrap();
    assert_eq!(json_value["plan_execution_id"], "exec_123");
    assert_eq!(json_value["pipeline_identifier"], "pipeline_456");
    assert_eq!(json_value["status"], "SUCCESS");
}

#[test]
fn test_connector_serialization() {
    let connector = Connector {
        identifier: "test_connector".to_string(),
        name: "Test Connector".to_string(),
        description: Some("A test connector".to_string()),
        tags: None,
        connector_type: "Git".to_string(),
        created: None,
        updated: None,
    };
    
    let serialized = serde_json::to_string(&connector);
    assert!(serialized.is_ok());
    
    let deserialized: Result<Connector, _> = serde_json::from_str(&serialized.unwrap());
    assert!(deserialized.is_ok());
    
    let deserialized_connector = deserialized.unwrap();
    assert_eq!(connector.identifier, deserialized_connector.identifier);
    assert_eq!(connector.connector_type, deserialized_connector.connector_type);
}

#[test]
fn test_service_serialization() {
    let service = Service {
        identifier: "test_service".to_string(),
        name: "Test Service".to_string(),
        description: Some("A test service".to_string()),
        tags: None,
        created: None,
        updated: None,
    };
    
    let serialized = serde_json::to_string(&service);
    assert!(serialized.is_ok());
    
    let deserialized: Result<Service, _> = serde_json::from_str(&serialized.unwrap());
    assert!(deserialized.is_ok());
}

#[test]
fn test_environment_serialization() {
    let environment = Environment {
        identifier: "test_env".to_string(),
        name: "Test Environment".to_string(),
        description: Some("A test environment".to_string()),
        tags: None,
        environment_type: "Production".to_string(),
        created: None,
        updated: None,
    };
    
    let serialized = serde_json::to_string(&environment);
    assert!(serialized.is_ok());
    
    let deserialized: Result<Environment, _> = serde_json::from_str(&serialized.unwrap());
    assert!(deserialized.is_ok());
    
    let deserialized_env = deserialized.unwrap();
    assert_eq!(environment.environment_type, deserialized_env.environment_type);
}

#[test]
fn test_paginated_response_serialization() {
    let response = PaginatedResponse {
        data: vec![
            Pipeline {
                identifier: "pipeline1".to_string(),
                name: "Pipeline 1".to_string(),
                description: None,
                tags: None,
                version: Some(1),
                created: None,
                updated: None,
                yaml: None,
            },
            Pipeline {
                identifier: "pipeline2".to_string(),
                name: "Pipeline 2".to_string(),
                description: None,
                tags: None,
                version: Some(2),
                created: None,
                updated: None,
                yaml: None,
            },
        ],
        page: 0,
        size: 2,
        total: Some(10),
    };
    
    let serialized = serde_json::to_string(&response);
    assert!(serialized.is_ok());
    
    let deserialized: Result<PaginatedResponse<Pipeline>, _> = serde_json::from_str(&serialized.unwrap());
    assert!(deserialized.is_ok());
    
    let deserialized_response = deserialized.unwrap();
    assert_eq!(deserialized_response.data.len(), 2);
    assert_eq!(deserialized_response.page, 0);
    assert_eq!(deserialized_response.size, 2);
    assert_eq!(deserialized_response.total, Some(10));
}

#[test]
fn test_client_error_retryability() {
    assert!(ClientError::RateLimitError.is_retryable());
    assert!(ClientError::TimeoutError.is_retryable());
    assert!(!ClientError::AuthError("test".to_string()).is_retryable());
    assert!(!ClientError::ConfigError("test".to_string()).is_retryable());
    
    let api_error_500 = ClientError::ApiError {
        status: 500,
        message: "Internal Server Error".to_string(),
    };
    assert!(api_error_500.is_retryable());
    
    let api_error_400 = ClientError::ApiError {
        status: 400,
        message: "Bad Request".to_string(),
    };
    assert!(!api_error_400.is_retryable());
    
    let api_error_429 = ClientError::ApiError {
        status: 429,
        message: "Too Many Requests".to_string(),
    };
    assert!(api_error_429.is_retryable());
}

#[test]
fn test_client_error_display() {
    let auth_error = ClientError::AuthError("Invalid token".to_string());
    assert_eq!(format!("{}", auth_error), "Authentication error: Invalid token");
    
    let api_error = ClientError::ApiError {
        status: 404,
        message: "Not Found".to_string(),
    };
    assert_eq!(format!("{}", api_error), "API error 404: Not Found");
    
    let rate_limit_error = ClientError::RateLimitError;
    assert_eq!(format!("{}", rate_limit_error), "Rate limit exceeded");
}