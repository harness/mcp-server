//! Harness MCP Server Library
//! 
//! This library provides the core functionality for the Harness MCP Server,
//! including configuration, server implementations, tools, and middleware.

pub mod config;
pub mod server;
pub mod auth;
pub mod middleware;
pub mod modules;
pub mod tools;
pub mod toolsets;
pub mod error;

pub use config::Config;
pub use error::{ServerError, Result};

/// Server version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Server name
pub const SERVER_NAME: &str = "harness-mcp-server";