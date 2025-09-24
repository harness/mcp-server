use harness_mcp_client::dto::*;
use insta::assert_json_snapshot;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[test]
fn test_pipeline_dto_snapshot() {
    let mut tags = HashMap::new();
    tags.insert("environment".to_string(), "production".to_string());
    tags.insert("team".to_string(), "platform".to_string());
    
    let pipeline = Pipeline {
        identifier: "sample_pipeline".to_string(),
        name: "Sample Pipeline".to_string(),
        description: Some("A sample pipeline for testing".to_string()),
        tags: Some(tags),
        version: Some(42),
        created: Some("2024-01-15T10:30:00Z".parse::<DateTime<Utc>>().unwrap()),
        updated: Some("2024-01-16T14:45:00Z".parse::<DateTime<Utc>>().unwrap()),
        yaml: Some("pipeline:\n  name: Sample Pipeline\n  stages:\n    - stage:\n        name: Build".to_string()),
    };
    
    assert_json_snapshot!("pipeline_dto", pipeline);
}

#[test]
fn test_pipeline_execution_dto_snapshot() {
    let execution = PipelineExecution {
        plan_execution_id: "exec_12345".to_string(),
        pipeline_identifier: "sample_pipeline".to_string(),
        status: "SUCCESS".to_string(),
        created: Some("2024-01-16T09:00:00Z".parse::<DateTime<Utc>>().unwrap()),
        started: Some("2024-01-16T09:01:00Z".parse::<DateTime<Utc>>().unwrap()),
        ended: Some("2024-01-16T09:15:30Z".parse::<DateTime<Utc>>().unwrap()),
        trigger_type: Some("MANUAL".to_string()),
    };
    
    assert_json_snapshot!("pipeline_execution_dto", execution);
}

#[test]
fn test_connector_dto_snapshot() {
    let mut tags = HashMap::new();
    tags.insert("type".to_string(), "source_control".to_string());
    tags.insert("provider".to_string(), "github".to_string());
    
    let connector = Connector {
        identifier: "github_connector".to_string(),
        name: "GitHub Connector".to_string(),
        description: Some("Connector for GitHub repositories".to_string()),
        tags: Some(tags),
        connector_type: "Git".to_string(),
        created: Some("2024-01-10T08:00:00Z".parse::<DateTime<Utc>>().unwrap()),
        updated: Some("2024-01-15T12:30:00Z".parse::<DateTime<Utc>>().unwrap()),
    };
    
    assert_json_snapshot!("connector_dto", connector);
}

#[test]
fn test_service_dto_snapshot() {
    let mut tags = HashMap::new();
    tags.insert("tier".to_string(), "backend".to_string());
    tags.insert("language".to_string(), "java".to_string());
    
    let service = Service {
        identifier: "user_service".to_string(),
        name: "User Service".to_string(),
        description: Some("Microservice for user management".to_string()),
        tags: Some(tags),
        created: Some("2024-01-05T10:00:00Z".parse::<DateTime<Utc>>().unwrap()),
        updated: Some("2024-01-14T16:20:00Z".parse::<DateTime<Utc>>().unwrap()),
    };
    
    assert_json_snapshot!("service_dto", service);
}

#[test]
fn test_environment_dto_snapshot() {
    let mut tags = HashMap::new();
    tags.insert("region".to_string(), "us-east-1".to_string());
    tags.insert("cost_center".to_string(), "engineering".to_string());
    
    let environment = Environment {
        identifier: "prod_env".to_string(),
        name: "Production Environment".to_string(),
        description: Some("Production environment for live services".to_string()),
        tags: Some(tags),
        environment_type: "Production".to_string(),
        created: Some("2024-01-01T00:00:00Z".parse::<DateTime<Utc>>().unwrap()),
        updated: Some("2024-01-10T18:45:00Z".parse::<DateTime<Utc>>().unwrap()),
    };
    
    assert_json_snapshot!("environment_dto", environment);
}

#[test]
fn test_paginated_response_dto_snapshot() {
    let pipelines = vec![
        Pipeline {
            identifier: "pipeline_1".to_string(),
            name: "First Pipeline".to_string(),
            description: None,
            tags: None,
            version: Some(1),
            created: Some("2024-01-01T10:00:00Z".parse::<DateTime<Utc>>().unwrap()),
            updated: None,
            yaml: None,
        },
        Pipeline {
            identifier: "pipeline_2".to_string(),
            name: "Second Pipeline".to_string(),
            description: Some("Second test pipeline".to_string()),
            tags: None,
            version: Some(3),
            created: Some("2024-01-02T11:00:00Z".parse::<DateTime<Utc>>().unwrap()),
            updated: Some("2024-01-03T12:00:00Z".parse::<DateTime<Utc>>().unwrap()),
            yaml: Some("pipeline:\n  name: Second Pipeline".to_string()),
        },
    ];
    
    let paginated_response = PaginatedResponse {
        data: pipelines,
        page: 0,
        size: 2,
        total: Some(25),
    };
    
    assert_json_snapshot!("paginated_response_dto", paginated_response);
}

#[test]
fn test_scope_dto_snapshot() {
    let scope = Scope {
        account_id: "account_12345".to_string(),
        org_id: Some("org_67890".to_string()),
        project_id: Some("project_abcdef".to_string()),
    };
    
    assert_json_snapshot!("scope_dto", scope);
}

#[test]
fn test_pipeline_list_options_dto_snapshot() {
    let options = PipelineListOptions {
        page: Some(2),
        size: Some(10),
        search_term: Some("production".to_string()),
    };
    
    assert_json_snapshot!("pipeline_list_options_dto", options);
}

#[test]
fn test_minimal_dtos_snapshot() {
    // Test minimal pipeline (only required fields)
    let minimal_pipeline = Pipeline {
        identifier: "minimal_pipeline".to_string(),
        name: "Minimal Pipeline".to_string(),
        description: None,
        tags: None,
        version: None,
        created: None,
        updated: None,
        yaml: None,
    };
    
    assert_json_snapshot!("minimal_pipeline_dto", minimal_pipeline);
    
    // Test minimal connector
    let minimal_connector = Connector {
        identifier: "minimal_connector".to_string(),
        name: "Minimal Connector".to_string(),
        description: None,
        tags: None,
        connector_type: "Git".to_string(),
        created: None,
        updated: None,
    };
    
    assert_json_snapshot!("minimal_connector_dto", minimal_connector);
    
    // Test minimal scope (account only)
    let minimal_scope = Scope {
        account_id: "account_only".to_string(),
        org_id: None,
        project_id: None,
    };
    
    assert_json_snapshot!("minimal_scope_dto", minimal_scope);
}

#[test]
fn test_empty_collections_snapshot() {
    // Test empty paginated response
    let empty_response: PaginatedResponse<Pipeline> = PaginatedResponse {
        data: vec![],
        page: 0,
        size: 10,
        total: Some(0),
    };
    
    assert_json_snapshot!("empty_paginated_response", empty_response);
    
    // Test pipeline with empty tags
    let pipeline_empty_tags = Pipeline {
        identifier: "pipeline_empty_tags".to_string(),
        name: "Pipeline with Empty Tags".to_string(),
        description: None,
        tags: Some(HashMap::new()),
        version: Some(1),
        created: None,
        updated: None,
        yaml: None,
    };
    
    assert_json_snapshot!("pipeline_empty_tags", pipeline_empty_tags);
}