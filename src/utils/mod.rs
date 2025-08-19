// Utility functions and helpers

pub mod http;

pub use http::{HttpClient, format_url};

use anyhow::Result;
use crate::config::Config;

pub fn create_service_client(
    config: &Config,
    service_base_url: Option<String>,
    fallback_base_url: &str,
    service_path: &str,
    secret: Option<String>,
) -> Result<HttpClient> {
    let base_url = service_base_url
        .unwrap_or_else(|| format!("{}/{}", fallback_base_url, service_path));
    
    let mut client = HttpClient::new(base_url)?;
    
    if let Some(secret) = secret {
        client = client.with_secret(&secret);
    } else if !config.api_key.is_empty() {
        client = client.with_api_key(&config.api_key);
    }
    
    Ok(client)
}