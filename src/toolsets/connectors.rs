use crate::client::HttpClient;
use crate::mcp::ToolHandler;
use crate::tools::connectors::{GetConnectorDetailsTool, ListConnectorCatalogueTool, ListConnectorsTool};

pub fn create_connector_toolset(client: HttpClient) -> Vec<Box<dyn ToolHandler + Send + Sync>> {
    vec![
        Box::new(GetConnectorDetailsTool::new(client.clone())),
        Box::new(ListConnectorCatalogueTool::new(client.clone())),
        Box::new(ListConnectorsTool::new(client)),
    ]
}

pub fn get_connector_tool_names() -> Vec<&'static str> {
    vec![
        "get_connector_details",
        "list_connector_catalogue", 
        "list_connectors",
    ]
}