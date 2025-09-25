pub mod http_server;
pub mod stdio_server;

use crate::config::Config;
use crate::error::Result;

/// Common server functionality
pub trait Server {
    async fn run(config: Config) -> Result<()>;
}