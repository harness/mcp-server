use harness_mcp_config::{Config, ConfigError};
use std::env;

#[test]
fn test_config_creation() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        ..Default::default()
    };

    assert_eq!(config.base_url, "https://app.harness.io");
    assert_eq!(config.api_key, Some("test_key".to_string()));
}

#[test]
fn test_config_validation_success() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        ..Default::default()
    };

    assert!(config.validate().is_ok());
}

#[test]
fn test_config_validation_invalid_url() {
    let config = Config {
        base_url: "invalid_url".to_string(),
        api_key: Some("test_key".to_string()),
        ..Default::default()
    };

    let result = config.validate();
    assert!(result.is_err());

    match result.unwrap_err() {
        ConfigError::InvalidValue { field, .. } if field == "base_url" => {
            // Expected
        }
        other => {
            panic!("Expected InvalidValue error for base_url, got: {:?}", other);
        }
    }
}

#[test]
fn test_config_validation_missing_api_key() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: None,
        internal: false,
        ..Default::default()
    };

    let result = config.validate();
    assert!(result.is_err());

    match result.unwrap_err() {
        ConfigError::MissingRequired(field) if field == "api_key" => {
            // Expected
        }
        other => {
            panic!(
                "Expected MissingRequired error for api_key, got: {:?}",
                other
            );
        }
    }
}

#[test]
fn test_config_validation_internal_mode() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        internal: true,
        bearer_token: Some("test_token".to_string()),
        ..Default::default()
    };

    assert!(config.validate().is_ok());
}

#[test]
fn test_config_validation_missing_bearer_token() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        internal: true,
        bearer_token: None,
        ..Default::default()
    };

    let result = config.validate();
    assert!(result.is_err());

    match result.unwrap_err() {
        ConfigError::MissingRequired(field) if field == "bearer_token" => {
            // Expected
        }
        other => {
            panic!(
                "Expected MissingRequired error for bearer_token, got: {:?}",
                other
            );
        }
    }
}

#[test]
fn test_config_get_base_url() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        ..Default::default()
    };

    assert_eq!(config.get_base_url(), "https://app.harness.io");
}

#[test]
fn test_config_extract_account_id() {
    let config = Config {
        api_key: Some("pat.test_account.token_id.suffix".to_string()),
        ..Default::default()
    };

    assert_eq!(
        config.extract_account_id(),
        Some("test_account".to_string())
    );
}

#[test]
fn test_config_extract_account_id_invalid() {
    let config = Config {
        api_key: Some("invalid_key".to_string()),
        ..Default::default()
    };

    assert_eq!(config.extract_account_id(), None);
}

#[test]
fn test_config_from_env() {
    // Set environment variables
    env::set_var("HARNESS_BASE_URL", "https://test.harness.io");
    env::set_var("HARNESS_API_KEY", "test_env_key");
    env::set_var("HARNESS_DEFAULT_ORG_ID", "test_env_org");
    env::set_var("HARNESS_DEFAULT_PROJECT_ID", "test_env_project");

    let config = Config::from_env().expect("Failed to create config from env");

    assert_eq!(config.base_url, "https://test.harness.io");
    assert_eq!(config.api_key, Some("test_env_key".to_string()));
    assert_eq!(config.default_org_id, Some("test_env_org".to_string()));
    assert_eq!(
        config.default_project_id,
        Some("test_env_project".to_string())
    );

    // Clean up
    env::remove_var("HARNESS_BASE_URL");
    env::remove_var("HARNESS_API_KEY");
    env::remove_var("HARNESS_DEFAULT_ORG_ID");
    env::remove_var("HARNESS_DEFAULT_PROJECT_ID");
}

#[test]
fn test_config_from_env_missing_required() {
    // Ensure required env vars are not set
    env::remove_var("HARNESS_API_KEY");
    env::remove_var("BEARER_TOKEN");

    let result = Config::from_env();
    assert!(result.is_err());
}

#[test]
fn test_config_default() {
    let config = Config::default();

    assert_eq!(config.base_url, "https://app.harness.io");
    assert_eq!(config.api_key, None);
    assert_eq!(config.default_org_id, None);
    assert_eq!(config.default_project_id, None);
    assert!(!config.read_only);
    assert!(!config.debug);
    assert!(!config.internal);
    assert_eq!(config.http_port, 8080);
    assert_eq!(config.http_path, "/mcp");
}

#[test]
fn test_config_is_internal() {
    let mut config = Config::default();
    assert!(!config.is_internal());

    config.internal = true;
    assert!(config.is_internal());
}

#[test]
fn test_config_error_display() {
    let error = ConfigError::MissingRequired("api_key".to_string());
    let display = format!("{}", error);
    assert!(display.contains("api_key"));

    let error = ConfigError::InvalidValue {
        field: "base_url".to_string(),
        value: "invalid".to_string(),
    };
    let display = format!("{}", error);
    assert!(display.contains("base_url"));
    assert!(display.contains("invalid"));

    let error = ConfigError::FileNotFound("config.yaml".to_string());
    let display = format!("{}", error);
    assert!(display.contains("config.yaml"));
}

#[test]
fn test_config_error_debug() {
    let error = ConfigError::MissingRequired("test_field".to_string());
    let debug = format!("{:?}", error);
    assert!(debug.contains("MissingRequired"));
    assert!(debug.contains("test_field"));
}

#[test]
fn test_config_serialization() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        default_org_id: Some("test_org".to_string()),
        default_project_id: Some("test_project".to_string()),
        read_only: true,
        debug: false,
        ..Default::default()
    };

    let serialized = serde_json::to_string(&config).expect("Failed to serialize config");
    let deserialized: Config =
        serde_json::from_str(&serialized).expect("Failed to deserialize config");

    assert_eq!(config.base_url, deserialized.base_url);
    assert_eq!(config.api_key, deserialized.api_key);
    assert_eq!(config.default_org_id, deserialized.default_org_id);
    assert_eq!(config.default_project_id, deserialized.default_project_id);
    assert_eq!(config.read_only, deserialized.read_only);
    assert_eq!(config.debug, deserialized.debug);
}

#[test]
fn test_config_yaml_serialization() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        default_org_id: Some("test_org".to_string()),
        default_project_id: Some("test_project".to_string()),
        read_only: true,
        debug: false,
        ..Default::default()
    };

    let serialized = serde_yaml::to_string(&config).expect("Failed to serialize config to YAML");
    let deserialized: Config =
        serde_yaml::from_str(&serialized).expect("Failed to deserialize config from YAML");

    assert_eq!(config.base_url, deserialized.base_url);
    assert_eq!(config.api_key, deserialized.api_key);
    assert_eq!(config.default_org_id, deserialized.default_org_id);
    assert_eq!(config.default_project_id, deserialized.default_project_id);
    assert_eq!(config.read_only, deserialized.read_only);
    assert_eq!(config.debug, deserialized.debug);
}

#[test]
fn test_config_apply_env_overrides() {
    let mut config = Config::default();

    // Set environment variables
    env::set_var("DEBUG", "true");
    env::set_var("HARNESS_API_KEY", "override_key");
    env::set_var("HTTP_PORT", "9090");

    config
        .apply_env_overrides()
        .expect("Failed to apply env overrides");

    assert!(config.debug);
    assert_eq!(config.api_key, Some("override_key".to_string()));
    assert_eq!(config.http_port, 9090);

    // Clean up
    env::remove_var("DEBUG");
    env::remove_var("HARNESS_API_KEY");
    env::remove_var("HTTP_PORT");
}
