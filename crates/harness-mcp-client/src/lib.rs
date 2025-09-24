//! HTTP client for Harness services
//!
//! This crate provides HTTP client implementations for communicating
//! with various Harness services and APIs.

pub mod client;
pub mod connector;
pub mod dashboard;
pub mod error;
pub mod pipeline;

pub use client::HarnessClient;
pub use error::{ClientError, ClientResult};
