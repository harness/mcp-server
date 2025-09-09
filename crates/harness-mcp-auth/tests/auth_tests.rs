use harness_mcp_auth::provider::{AuthError, AuthProvider};
use harness_mcp_config::Config;
use reqwest::RequestBuilder;

#[test]
fn test_auth_provider_creation() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config);
    assert!(auth_provider.is_ok());
}

#[test]
fn test_auth_provider_creation_missing_api_key() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: None,
        internal: false,
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config);
    assert!(auth_provider.is_err());

    match auth_provider.unwrap_err() {
        AuthError::InvalidCredentials => {
            // Expected
        }
        other => {
            panic!("Expected InvalidCredentials error, got: {:?}", other);
        }
    }
}

#[test]
fn test_auth_provider_creation_empty_api_key() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("".to_string()),
        internal: false,
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config);
    assert!(auth_provider.is_err());

    match auth_provider.unwrap_err() {
        AuthError::InvalidCredentials => {
            // Expected
        }
        other => {
            panic!("Expected InvalidCredentials error, got: {:?}", other);
        }
    }
}

#[test]
fn test_auth_provider_internal_mode() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        internal: true,
        bearer_token: Some("test_token".to_string()),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config);
    assert!(auth_provider.is_ok());
}

#[tokio::test]
async fn test_add_auth_headers() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");

    let client = reqwest::Client::new();
    let request = client.get("https://example.com");

    let result = auth_provider.add_auth_headers(request).await;
    assert!(result.is_ok());

    // We can't easily inspect the headers without making the request,
    // but we can verify that the method doesn't fail
}

#[test]
fn test_auth_error_display() {
    let error = AuthError::InvalidCredentials;
    let display = format!("{}", error);
    assert!(display.contains("Invalid credentials"));

    let error = AuthError::TokenExpired;
    let display = format!("{}", error);
    assert!(display.contains("Token expired"));

    let error = AuthError::NetworkError("Network failed".to_string());
    let display = format!("{}", error);
    assert!(display.contains("Network failed"));

    let error = AuthError::ConfigurationError("Config error".to_string());
    let display = format!("{}", error);
    assert!(display.contains("Config error"));
}

#[test]
fn test_auth_error_debug() {
    let error = AuthError::InvalidCredentials;
    let debug = format!("{:?}", error);
    assert!(debug.contains("InvalidCredentials"));

    let error = AuthError::NetworkError("Test network error".to_string());
    let debug = format!("{:?}", error);
    assert!(debug.contains("NetworkError"));
    assert!(debug.contains("Test network error"));
}

#[test]
fn test_auth_provider_clone() {
    let config = Config {
        base_url: "https://app.harness.io".to_string(),
        api_key: Some("test_key".to_string()),
        ..Default::default()
    };

    let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");
    let cloned_provider = auth_provider.clone();

    // Both providers should work the same way
    // We can't easily test this without making actual requests,
    // but we can verify that cloning doesn't fail
    assert_eq!(
        format!("{:?}", auth_provider),
        format!("{:?}", cloned_provider)
    );
}

#[test]
fn test_auth_error_from_reqwest() {
    let reqwest_error = reqwest::Error::from(reqwest::ErrorKind::Request);
    let auth_error: AuthError = reqwest_error.into();

    match auth_error {
        AuthError::NetworkError(_) => {
            // Expected
        }
        other => {
            panic!("Expected NetworkError, got: {:?}", other);
        }
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use tokio;

    #[tokio::test]
    async fn test_auth_provider_with_real_request() {
        let config = Config {
            base_url: "https://httpbin.org".to_string(),
            api_key: Some("test_key".to_string()),
            ..Default::default()
        };

        let auth_provider = AuthProvider::new(&config).expect("Failed to create auth provider");

        let client = reqwest::Client::new();
        let request = client.get("https://httpbin.org/headers");

        let request_with_auth = auth_provider
            .add_auth_headers(request)
            .await
            .expect("Failed to add auth headers");

        // Make the request to verify headers are added correctly
        let response = request_with_auth.send().await;

        match response {
            Ok(resp) => {
                let text = resp.text().await.expect("Failed to get response text");
                // The response should contain our authorization header
                assert!(text.contains("Authorization") || text.contains("x-api-key"));
            }
            Err(e) => {
                // Network errors are acceptable in test environment
                println!("Network error (acceptable in tests): {}", e);
            }
        }
    }
}
