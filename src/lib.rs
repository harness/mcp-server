//! Harness MCP Server
//! 
//! A Rust implementation of the Harness Model Context Protocol (MCP) Server
//! that provides seamless integration with Harness APIs, enabling advanced 
//! automation and interaction capabilities for developers and tools.

pub mod auth;
pub mod client;
pub mod config;
pub mod error;
pub mod modules;
pub mod server;
pub mod tools;
pub mod utils;

pub use error::{Error, Result};

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Default tools to enable
pub const DEFAULT_TOOLS: &[&str] = &[];

/// Re-exports for convenience
pub mod prelude {
    pub use crate::{Error, Result};
    pub use anyhow::Context;
    pub use serde::{Deserialize, Serialize};
    pub use tracing::{debug, error, info, trace, warn};
}