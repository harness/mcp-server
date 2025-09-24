//! Core types and utilities for Harness MCP Server
//!
//! This crate provides the foundational types, traits, and utilities
//! used throughout the Harness MCP Server implementation.

pub mod config;
pub mod error;
pub mod middleware;
pub mod server;
pub mod types;

pub use error::{Error, Result};
