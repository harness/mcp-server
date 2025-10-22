//! Model Context Protocol (MCP) implementation for Rust
//! 
//! This crate provides a Rust implementation of the Model Context Protocol,
//! including message types, server implementation, and transport layers.

pub mod types;
pub mod server;
pub mod transport;
pub mod error;

pub use error::{McpError, Result};
pub use types::*;
pub use server::McpServer;
pub use transport::{HttpTransport, StdioTransport};

/// MCP protocol version
pub const MCP_VERSION: &str = "2024-11-05";

/// Default MCP HTTP path
pub const DEFAULT_HTTP_PATH: &str = "/mcp";

/// Default MCP HTTP port
pub const DEFAULT_HTTP_PORT: u16 = 8080;