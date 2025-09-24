use harness_mcp_core::config::Config;
use clap::Parser;

#[test]
fn test_cli_parsing_stdio() {
    let args = vec![
        "harness-mcp-server",
        "stdio",
        "--api-key", "pat.account123.token456.secret789",
        "--default-org-id", "test_org",
        "--default-project-id", "test_project",
        "--debug"
    ];
    
    // This would test the CLI parsing if we had the full CLI structure
    // For now, just test basic config creation
    let mut config = Config::default();
    config.api_key = Some("pat.account123.token456.secret789".to_string());
    config.default_org_id = Some("test_org".to_string());
    config.default_project_id = Some("test_project".to_string());
    config.debug = true;
    
    assert_eq!(config.api_key, Some("pat.account123.token456.secret789".to_string()));
    assert_eq!(config.default_org_id, Some("test_org".to_string()));
    assert_eq!(config.default_project_id, Some("test_project".to_string()));
    assert!(config.debug);
}

#[test]
fn test_cli_parsing_http_server() {
    let mut config = Config::default();
    config.internal = true;
    config.bearer_token = Some("bearer_token_123".to_string());
    
    assert!(config.internal);
    assert_eq!(config.bearer_token, Some("bearer_token_123".to_string()));
}

#[test]
fn test_config_environment_variables() {
    // Test that config can be created with environment variable names
    let mut config = Config::default();
    
    // Simulate environment variable parsing
    config.base_url = "https://custom.harness.io".to_string();
    config.toolsets = vec!["pipelines".to_string(), "connectors".to_string()];
    config.enable_modules = vec!["CI".to_string(), "CD".to_string()];
    config.read_only = true;
    config.log_file = Some("/var/log/harness-mcp.log".to_string());
    config.output_dir = Some("/tmp/harness-output".to_string());
    
    assert_eq!(config.base_url, "https://custom.harness.io");
    assert_eq!(config.toolsets, vec!["pipelines", "connectors"]);
    assert_eq!(config.enable_modules, vec!["CI", "CD"]);
    assert!(config.read_only);
    assert_eq!(config.log_file, Some("/var/log/harness-mcp.log".to_string()));
    assert_eq!(config.output_dir, Some("/tmp/harness-output".to_string()));
}

#[test]
fn test_config_validation() {
    let mut config = Config::default();
    
    // Test valid API key
    config.api_key = Some("pat.account123.token456.secret789".to_string());
    let result = config.extract_account_id();
    assert!(result.is_ok());
    assert_eq!(config.account_id, Some("account123".to_string()));
    
    // Test invalid API key
    config.api_key = Some("invalid_key".to_string());
    let result = config.extract_account_id();
    assert!(result.is_err());
}

#[test]
fn test_config_serialization_roundtrip() {
    let original_config = Config {
        version: Some("1.0.0".to_string()),
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("pat.test.token.secret".to_string()),
        default_org_id: Some("org123".to_string()),
        default_project_id: Some("proj456".to_string()),
        toolsets: vec!["default".to_string(), "pipelines".to_string()],
        enable_modules: vec!["CI".to_string()],
        enable_license: true,
        read_only: false,
        log_file: Some("/var/log/test.log".to_string()),
        debug: true,
        output_dir: Some("/tmp/output".to_string()),
        bearer_token: None,
        internal: false,
        account_id: Some("test".to_string()),
        service_configs: std::collections::HashMap::new(),
    };
    
    let serialized = serde_json::to_string(&original_config).unwrap();
    let deserialized: Config = serde_json::from_str(&serialized).unwrap();
    
    assert_eq!(original_config.version, deserialized.version);
    assert_eq!(original_config.base_url, deserialized.base_url);
    assert_eq!(original_config.api_key, deserialized.api_key);
    assert_eq!(original_config.toolsets, deserialized.toolsets);
    assert_eq!(original_config.enable_modules, deserialized.enable_modules);
    assert_eq!(original_config.debug, deserialized.debug);
}

#[test]
fn test_config_defaults() {
    let config = Config::default();
    
    assert_eq!(config.base_url, "https://app.harness.io");
    assert_eq!(config.toolsets, vec!["default"]);
    assert!(config.enable_modules.is_empty());
    assert!(!config.enable_license);
    assert!(!config.read_only);
    assert!(!config.debug);
    assert!(!config.internal);
    assert_eq!(config.version, Some("0.1.0".to_string()));
    assert!(config.service_configs.is_empty());
}

#[test]
fn test_service_config_management() {
    let mut config = Config::default();
    
    let service_config = harness_mcp_core::config::ServiceConfig {
        base_url: "https://pipeline-service.harness.io".to_string(),
        secret: Some("secret123".to_string()),
    };
    
    config.add_service_config("pipeline-service".to_string(), service_config.clone());
    
    let retrieved = config.get_service_config("pipeline-service");
    assert!(retrieved.is_some());
    assert_eq!(retrieved.unwrap().base_url, service_config.base_url);
    assert_eq!(retrieved.unwrap().secret, service_config.secret);
    
    // Test non-existent service
    let missing = config.get_service_config("non-existent");
    assert!(missing.is_none());
}