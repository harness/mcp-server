pub mod registry;
pub mod pipelines;
pub mod connectors;
pub mod repositories;
pub mod dashboards;
pub mod ccm;
pub mod chaos;
pub mod idp;
pub mod sto;
pub mod scs;

pub use registry::ToolRegistry;

use anyhow::Result;
use serde_json::Value;
use async_trait::async_trait;

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn input_schema(&self) -> Value;
    async fn execute(&self, params: &Value) -> Result<Value>;
}

pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}