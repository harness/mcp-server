pub mod client;
pub mod error;
pub mod services;

pub use client::HarnessClient;
pub use error::{Error, Result};

// Re-export service clients
pub use services::{
    ConnectorService,
    EnvironmentService,
    // Add other services as they are implemented
    PipelineService,
};
