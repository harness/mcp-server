pub mod toolset;
pub mod pipelines;
pub mod connectors;
pub mod dashboards;
pub mod ccm;
pub mod registry;
pub mod error;
pub mod mcp;

pub use toolset::{Toolset, ToolsetGroup, Tool, ToolHandler};
pub use error::{ToolError, Result as ToolResult, ParameterValidator, ErrorHandler};
pub use mcp::{Tool as McpTool, ToolResult as McpToolResult, ToolContent};

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}