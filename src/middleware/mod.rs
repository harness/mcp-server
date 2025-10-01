// Middleware modules for the Harness MCP server
// Currently, authentication middleware is in the auth module
// This module can be extended for additional middleware like:
// - Request/response logging
// - Rate limiting
// - Metrics collection
// - Request validation

pub mod logging;
pub mod timeout;

pub use logging::*;
pub use timeout::*;