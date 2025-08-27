pub mod http_client;
pub mod pipelines;
pub mod connectors;

use crate::config::Config;
use crate::error::Result;

pub use http_client::*;
pub use pipelines::*;
pub use connectors::*;

/// Create HTTP client for Harness API
pub fn create_harness_client(config: &Config) -> Result<HttpClient> {
    HttpClient::new(&config.base_url, config.api_key.as_deref())
}