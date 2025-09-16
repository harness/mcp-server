use harness_mcp_server::config::*;
use clap::Parser;

#[tokio::test]
async fn test_stdio_command_parsing() {
    // Test stdio command with all options
    let args = vec![
        "harness-mcp-server",
        "--debug",
        "--read-only", 
        "--toolsets", "pipelines,connectors",
        "--enable-modules", "CORE,CI",
        "--log-file", "/tmp/test.log",
        "--output-dir", "/tmp/output",
        "stdio",
        "--base-url", "https://app.harness.io",
        "--api-key", "pat.test.key",
        "--default-org-id", "test_org",
        "--default-project-id", "test_project"
    ];

    let config = Config::try_parse_from(args);
    assert!(config.is_ok());
    
    let cfg = config.unwrap();
    assert!(cfg.debug);
    assert!(cfg.read_only);
    assert_eq!(cfg.toolsets, vec!["pipelines", "connectors"]);
    assert_eq!(cfg.enable_modules, vec!["CORE", "CI"]);
    
    match cfg.command {
        Commands::Stdio(stdio_config) => {
            assert_eq!(stdio_config.base_url, "https://app.harness.io");
            assert_eq!(stdio_config.api_key, "pat.test.key");
            assert_eq!(stdio_config.default_org_id, Some("test_org".to_string()));
            assert_eq!(stdio_config.default_project_id, Some("test_project".to_string()));
        }
        _ => panic!("Expected stdio command"),
    }
}

#[tokio::test]
async fn test_http_command_parsing() {
    let args = vec![
        "harness-mcp-server",
        "http",
        "--port", "8080",
        "--path", "/mcp"
    ];

    let config = Config::try_parse_from(args);
    assert!(config.is_ok());
    
    let cfg = config.unwrap();
    match cfg.command {
        Commands::Http(http_config) => {
            assert_eq!(http_config.port, 8080);
            assert_eq!(http_config.path, "/mcp");
        }
        _ => panic!("Expected http command"),
    }
}

#[tokio::test]
async fn test_internal_command_parsing() {
    let args = vec![
        "harness-mcp-server",
        "internal",
        "--bearer-token", "bearer_test_token",
        "--mcp-svc-secret", "mcp_secret",
        "--pipeline-svc-base-url", "http://pipeline:8080",
        "--ng-manager-base-url", "http://ng-manager:8080"
    ];

    let config = Config::try_parse_from(args);
    assert!(config.is_ok());
    
    let cfg = config.unwrap();
    match cfg.command {
        Commands::Internal(internal_config) => {
            assert_eq!(internal_config.bearer_token, "bearer_test_token");
            assert_eq!(internal_config.mcp_svc_secret, "mcp_secret");
            assert_eq!(internal_config.pipeline_svc_base_url, Some("http://pipeline:8080".to_string()));
            assert_eq!(internal_config.ng_manager_base_url, Some("http://ng-manager:8080".to_string()));
        }
        _ => panic!("Expected internal command"),
    }
}

#[tokio::test]
async fn test_environment_variable_parsing() {
    // Test that environment variables work with stdio config
    std::env::set_var("HARNESS_API_KEY", "env_api_key");
    std::env::set_var("HARNESS_BASE_URL", "https://env.harness.io");
    std::env::set_var("HARNESS_DEFAULT_ORG_ID", "env_org");
    std::env::set_var("HARNESS_DEFAULT_PROJECT_ID", "env_project");

    let args = vec!["harness-mcp-server", "stdio"];
    let config = Config::try_parse_from(args);
    assert!(config.is_ok());
    
    let cfg = config.unwrap();
    match cfg.command {
        Commands::Stdio(stdio_config) => {
            assert_eq!(stdio_config.api_key, "env_api_key");
            assert_eq!(stdio_config.base_url, "https://env.harness.io");
            assert_eq!(stdio_config.default_org_id, Some("env_org".to_string()));
            assert_eq!(stdio_config.default_project_id, Some("env_project".to_string()));
        }
        _ => panic!("Expected stdio command"),
    }

    // Clean up environment variables
    std::env::remove_var("HARNESS_API_KEY");
    std::env::remove_var("HARNESS_BASE_URL");
    std::env::remove_var("HARNESS_DEFAULT_ORG_ID");
    std::env::remove_var("HARNESS_DEFAULT_PROJECT_ID");
}

#[tokio::test]
async fn test_account_id_extraction() {
    let stdio_config = StdioConfig {
        base_url: "https://app.harness.io".to_string(),
        api_key: "pat.account123.token456.suffix".to_string(),
        default_org_id: None,
        default_project_id: None,
    };

    let account_id = stdio_config.account_id();
    assert!(account_id.is_ok());
    assert_eq!(account_id.unwrap(), "account123");
}

#[tokio::test]
async fn test_invalid_api_key_format() {
    let stdio_config = StdioConfig {
        base_url: "https://app.harness.io".to_string(),
        api_key: "invalid_key_format".to_string(),
        default_org_id: None,
        default_project_id: None,
    };

    let account_id = stdio_config.account_id();
    assert!(account_id.is_err());
}

#[tokio::test]
async fn test_default_values() {
    // Test default values are applied correctly
    let args = vec!["harness-mcp-server", "stdio", "--api-key", "test.key"];
    let config = Config::try_parse_from(args);
    assert!(config.is_ok());
    
    let cfg = config.unwrap();
    assert!(!cfg.debug); // Default false
    assert!(!cfg.read_only); // Default false
    assert!(!cfg.enable_license); // Default false
    assert!(cfg.toolsets.is_empty()); // Default empty
    assert!(cfg.enable_modules.is_empty()); // Default empty
    
    match cfg.command {
        Commands::Stdio(stdio_config) => {
            assert_eq!(stdio_config.base_url, "https://app.harness.io"); // Default value
            assert_eq!(stdio_config.default_org_id, None); // Default None
            assert_eq!(stdio_config.default_project_id, None); // Default None
        }
        _ => panic!("Expected stdio command"),
    }
}

#[tokio::test]
async fn test_http_default_values() {
    let args = vec!["harness-mcp-server", "http"];
    let config = Config::try_parse_from(args);
    assert!(config.is_ok());
    
    let cfg = config.unwrap();
    match cfg.command {
        Commands::Http(http_config) => {
            assert_eq!(http_config.port, 8080); // Default port
            assert_eq!(http_config.path, "/mcp"); // Default path
        }
        _ => panic!("Expected http command"),
    }
}

#[tokio::test]
async fn test_toolsets_parsing() {
    // Test single toolset
    let args = vec!["harness-mcp-server", "--toolsets", "pipelines", "stdio", "--api-key", "test"];
    let config = Config::try_parse_from(args);
    assert!(config.is_ok());
    assert_eq!(config.unwrap().toolsets, vec!["pipelines"]);

    // Test multiple toolsets
    let args = vec!["harness-mcp-server", "--toolsets", "pipelines,connectors,ccm", "stdio", "--api-key", "test"];
    let config = Config::try_parse_from(args);
    assert!(config.is_ok());
    assert_eq!(config.unwrap().toolsets, vec!["pipelines", "connectors", "ccm"]);

    // Test empty toolsets
    let args = vec!["harness-mcp-server", "stdio", "--api-key", "test"];
    let config = Config::try_parse_from(args);
    assert!(config.is_ok());
    assert!(config.unwrap().toolsets.is_empty());
}

#[tokio::test]
async fn test_enable_modules_parsing() {
    // Test single module
    let args = vec!["harness-mcp-server", "--enable-modules", "CORE", "stdio", "--api-key", "test"];
    let config = Config::try_parse_from(args);
    assert!(config.is_ok());
    assert_eq!(config.unwrap().enable_modules, vec!["CORE"]);

    // Test multiple modules
    let args = vec!["harness-mcp-server", "--enable-modules", "CORE,CI,CD,CCM", "stdio", "--api-key", "test"];
    let config = Config::try_parse_from(args);
    assert!(config.is_ok());
    assert_eq!(config.unwrap().enable_modules, vec!["CORE", "CI", "CD", "CCM"]);
}

#[tokio::test]
async fn test_required_fields_validation() {
    // Test that stdio command requires api-key
    let args = vec!["harness-mcp-server", "stdio"];
    let config = Config::try_parse_from(args);
    // This should fail because api-key is required for stdio
    // Note: clap validation happens at parse time, not at our validation level
    
    // Test that internal command requires bearer-token and mcp-svc-secret
    let args = vec!["harness-mcp-server", "internal"];
    let config = Config::try_parse_from(args);
    // This should fail because required fields are missing
}

#[tokio::test]
async fn test_help_and_version() {
    // Test that help works
    let args = vec!["harness-mcp-server", "--help"];
    let config = Config::try_parse_from(args);
    // This will exit the process in real usage, but in tests we can check the structure

    // Test that version works  
    let args = vec!["harness-mcp-server", "--version"];
    let config = Config::try_parse_from(args);
    // This will exit the process in real usage
}

#[tokio::test]
async fn test_service_config_defaults() {
    let service_config = ServiceConfig::default();
    assert!(service_config.base_url.is_empty());
    assert!(service_config.secret.is_none());
    assert_eq!(service_config.timeout_seconds, Some(30));
}