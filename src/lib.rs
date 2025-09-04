//! Harness MCP (Model Context Protocol) Server
//! 
//! A Rust implementation of the Harness MCP server that provides tools and resources
//! for interacting with the Harness platform.

pub mod client;
pub mod harness;
pub mod modules;
pub mod types;

// Re-export commonly used types
pub use types::*;

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const COMMIT: &str = env!("VERGEN_GIT_SHA_SHORT", "dev");
pub const BUILD_DATE: &str = env!("VERGEN_BUILD_TIMESTAMP", "unknown");