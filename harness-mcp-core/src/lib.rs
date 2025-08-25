pub mod config;
pub mod server;
pub mod mcp;
pub mod tools;
pub mod modules;
pub mod prompts;
pub mod error;

pub use error::{McpError, Result};

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const NAME: &str = env!("CARGO_PKG_NAME");