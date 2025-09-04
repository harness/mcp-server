//! Utility functions for the Harness module

use crate::types::{Config, Result};
use crate::client::HarnessClient;

/// Create a service client with proper configuration
pub fn create_service_client(
    config: &Config,
    service_base_url: Option<&str>,
    fallback_base_url: &str,
    service_path: &str,
    _service_secret: Option<&str>,
) -> Result<HarnessClient> {
    let base_url = service_base_url
        .unwrap_or(fallback_base_url)
        .trim_end_matches('/')
        .to_string();
        
    let full_url = if service_path.is_empty() {
        base_url
    } else {
        format!("{}/{}", base_url, service_path.trim_start_matches('/'))
    };
    
    let mut client = HarnessClient::new(full_url)?;
    
    // Add authentication
    if let Some(api_key) = &config.api_key {
        client = client.with_api_key(api_key.clone());
    }
    
    if let Some(bearer_token) = &config.bearer_token {
        client = client.with_bearer_token(bearer_token.clone());
    }
    
    Ok(client)
}

/// Create a license client for license validation
pub fn create_license_client(
    config: &Config,
    service_base_url: Option<&str>,
    fallback_base_url: &str,
    service_path: &str,
    service_secret: Option<&str>,
) -> Result<HarnessClient> {
    create_service_client(config, service_base_url, fallback_base_url, service_path, service_secret)
}