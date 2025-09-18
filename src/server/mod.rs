pub mod http;
pub mod stdio;

use crate::config::Config;
use crate::error::Result;

/// Run the HTTP server
pub async fn run_http_server(config: Config) -> Result<()> {
    http::run_server(config).await
}

/// Run the stdio server
pub async fn run_stdio_server(config: Config) -> Result<()> {
    stdio::run_server(config).await
}