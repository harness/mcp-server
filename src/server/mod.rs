pub mod mcp;
pub mod stdio;

use crate::config::Config;
use crate::error::Result;

pub async fn run_stdio_server(config: Config) -> Result<()> {
    stdio::run_stdio_server(config).await
}

pub async fn run_internal_server(config: Config) -> Result<()> {
    // For now, internal mode also uses stdio
    stdio::run_stdio_server(config).await
}