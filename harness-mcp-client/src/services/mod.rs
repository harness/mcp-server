//! Service-specific API clients

pub mod pipelines;
pub mod connectors;

pub use pipelines::PipelineService;
pub use connectors::ConnectorService;

// TODO: Implement additional service clients
// - Dashboard service
// - Log service
// - Repository service
// - And many more...