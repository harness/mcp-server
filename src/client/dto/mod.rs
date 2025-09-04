//! Data Transfer Objects for client operations

pub mod dashboard;
pub mod error;
pub mod pipeline;
pub mod connector;
pub mod environment;
// pub mod secret; // Skipped due to ignore patterns
pub mod template;
pub mod service;
pub mod repository;

// Re-export common DTOs
pub use dashboard::*;
pub use error::*;
pub use pipeline::*;
pub use connector::*;
pub use environment::*;
// pub use secret::*;
pub use template::*;
pub use service::*;
pub use repository::*;