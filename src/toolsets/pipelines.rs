use crate::client::HttpClient;
use crate::mcp::ToolHandler;
use crate::tools::pipelines::{GetPipelineTool, ListPipelinesTool};
use std::sync::Arc;

pub fn create_pipeline_toolset(client: HttpClient) -> Vec<Box<dyn ToolHandler + Send + Sync>> {
    vec![
        Box::new(GetPipelineTool::new(client.clone())),
        Box::new(ListPipelinesTool::new(client)),
    ]
}

pub fn get_pipeline_tool_names() -> Vec<&'static str> {
    vec![
        "get_pipeline",
        "list_pipelines",
    ]
}