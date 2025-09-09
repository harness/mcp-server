use harness_mcp_auth::provider::AuthProvider;
use harness_mcp_client::{Error, HarnessClient};
use harness_mcp_config::Config;
use harness_mcp_dto::Scope;
use tokio;

#[tokio::test]
async fn test_client_creation() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let client = HarnessClient::new(&config, auth_provider);

    assert!(client.is_ok(), "Expected client creation to succeed");
}

#[tokio::test]
async fn test_client_with_invalid_config() {
    let config = Config {
        base_url: "".to_string(),
        api_key: None,
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let client = HarnessClient::new(&config, auth_provider);

    // Client creation should still succeed, but API calls will fail
    assert!(
        client.is_ok(),
        "Expected client creation to succeed even with invalid config"
    );
}

#[tokio::test]
async fn test_pipeline_service() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let client = HarnessClient::new(&config, auth_provider).expect("Failed to create client");

    let pipeline_service = client.pipelines();

    // Test with invalid credentials - should get auth error
    let scope = Scope {
        account_id: "test_account".to_string(),
        org_id: "test_org".to_string(),
        project_id: "test_project".to_string(),
    };

    let result = pipeline_service.list(&scope, Some(0), Some(10)).await;

    // Should get an error due to invalid credentials
    assert!(result.is_err(), "Expected error with invalid credentials");

    match result.unwrap_err() {
        Error::Auth(_) | Error::Unauthorized(_) | Error::Forbidden(_) => {
            // Expected authentication/authorization errors
        }
        Error::Network(_) => {
            // Network errors are also acceptable in test environment
        }
        other => {
            panic!("Unexpected error type: {:?}", other);
        }
    }
}

#[tokio::test]
async fn test_connector_service() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let client = HarnessClient::new(&config, auth_provider).expect("Failed to create client");

    let connector_service = client.connectors();

    // Test with invalid credentials - should get auth error
    let scope = Scope {
        account_id: "test_account".to_string(),
        org_id: "test_org".to_string(),
        project_id: "test_project".to_string(),
    };

    let result = connector_service.list(&scope, Some(0), Some(10)).await;

    // Should get an error due to invalid credentials
    assert!(result.is_err(), "Expected error with invalid credentials");
}

#[tokio::test]
async fn test_error_classification() {
    // Test error classification methods
    let auth_error = Error::Auth(harness_mcp_auth::provider::AuthError::InvalidCredentials);
    assert!(auth_error.is_auth_error());
    assert!(auth_error.is_retryable()); // Auth errors might be retryable

    let unauthorized_error = Error::Unauthorized("Unauthorized".to_string());
    assert!(unauthorized_error.is_auth_error());
    assert!(!unauthorized_error.is_retryable()); // Unauthorized is not retryable

    let rate_limit_error = Error::RateLimit("Rate limited".to_string());
    assert!(!rate_limit_error.is_auth_error());
    assert!(rate_limit_error.is_retryable()); // Rate limits are retryable

    let server_error = Error::ServerError("Internal server error".to_string());
    assert!(!server_error.is_auth_error());
    assert!(server_error.is_retryable()); // Server errors are retryable

    let bad_request_error = Error::BadRequest("Bad request".to_string());
    assert!(!bad_request_error.is_auth_error());
    assert!(!bad_request_error.is_retryable()); // Bad requests are not retryable
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_scope_serialization() {
        let scope = Scope {
            account_id: "test_account".to_string(),
            org_id: "test_org".to_string(),
            project_id: "test_project".to_string(),
        };

        let serialized = serde_json::to_string(&scope).expect("Failed to serialize scope");
        let deserialized: Scope =
            serde_json::from_str(&serialized).expect("Failed to deserialize scope");

        assert_eq!(scope.account_id, deserialized.account_id);
        assert_eq!(scope.org_id, deserialized.org_id);
        assert_eq!(scope.project_id, deserialized.project_id);
    }

    #[test]
    fn test_error_display() {
        let error = Error::BadRequest("Invalid parameter".to_string());
        let error_string = format!("{}", error);
        assert!(error_string.contains("Invalid parameter"));

        let error = Error::Network("Connection failed".to_string());
        let error_string = format!("{}", error);
        assert!(error_string.contains("Connection failed"));
    }
}
