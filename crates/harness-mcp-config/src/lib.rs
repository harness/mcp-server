//! Configuration management for Harness MCP Server
//!
//! This crate handles configuration loading from various sources including
//! environment variables, configuration files, and command-line arguments.

pub mod config;
pub mod env;
pub mod error;

pub use config::{Config, HttpConfig, TransportType};
pub use env::{EnvVars, load_config_from_env};
pub use error::{Error, Result};

/// Re-export commonly used types
pub mod prelude {
    pub use crate::config::*;
    pub use crate::env::*;
    pub use crate::error::{Error, Result};
}