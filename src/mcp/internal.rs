use crate::config::InternalConfig;
use crate::error::Result;
use tracing::info;

pub async fn run_internal_server(config: InternalConfig) -> Result<()> {
    info!("Starting internal server");
    
    // TODO: Implement internal server mode
    // This will handle internal Harness service authentication
    
    Ok(())
}