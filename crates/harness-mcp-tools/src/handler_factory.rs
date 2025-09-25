//! Tool handler factory for creating working tool handlers

use crate::service_factory::ServiceFactory;
use crate::tools::pipelines::{handle_pipeline_tool_call, create_get_pipeline_tool, create_list_pipelines_tool, create_get_execution_tool, create_list_executions_tool, create_fetch_execution_url_tool};
use crate::tools::connectors::{handle_connector_tool_call, create_list_connector_catalogue_tool, create_get_connector_details_tool, create_list_connectors_tool};
use harness_mcp_core::{
    server::ToolHandler,
    types::{Tool, ToolCallRequest, ToolCallResult},
    error::Result,
};
use std::sync::Arc;

/// Factory for creating tool handlers with actual service implementations
pub struct ToolHandlerFactory {
    service_factory: Arc<ServiceFactory>,
}

impl ToolHandlerFactory {
    /// Create a new tool handler factory
    pub fn new(service_factory: Arc<ServiceFactory>) -> Self {
        Self { service_factory }
    }

    /// Create all pipeline tools with handlers
    pub fn create_pipeline_tools(&self) -> Vec<(Tool, ToolHandler)> {
        let service_factory = self.service_factory.clone();
        
        vec![
            (
                create_get_pipeline_tool(),
                Arc::new(move |request| {
                    let service = service_factory.pipeline_service();
                    Box::pin(async move {
                        handle_pipeline_tool_call("get_pipeline", &request, &service).await
                    })
                }),
            ),
            (
                create_list_pipelines_tool(),
                Arc::new(move |request| {
                    let service = service_factory.pipeline_service();
                    Box::pin(async move {
                        handle_pipeline_tool_call("list_pipelines", &request, &service).await
                    })
                }),
            ),
            (
                create_get_execution_tool(),
                Arc::new(move |request| {
                    let service = service_factory.pipeline_service();
                    Box::pin(async move {
                        handle_pipeline_tool_call("get_execution", &request, &service).await
                    })
                }),
            ),
            (
                create_list_executions_tool(),
                Arc::new(move |request| {
                    let service = service_factory.pipeline_service();
                    Box::pin(async move {
                        handle_pipeline_tool_call("list_executions", &request, &service).await
                    })
                }),
            ),
            (
                create_fetch_execution_url_tool(),
                Arc::new(move |request| {
                    let service = service_factory.pipeline_service();
                    Box::pin(async move {
                        handle_pipeline_tool_call("fetch_execution_url", &request, &service).await
                    })
                }),
            ),
        ]
    }

    /// Create all connector tools with handlers
    pub fn create_connector_tools(&self) -> Vec<(Tool, ToolHandler)> {
        let service_factory = self.service_factory.clone();
        
        vec![
            (
                create_list_connector_catalogue_tool(),
                Arc::new(move |request| {
                    let service = service_factory.connector_service();
                    Box::pin(async move {
                        handle_connector_tool_call("list_connector_catalogue", &request, &service).await
                    })
                }),
            ),
            (
                create_get_connector_details_tool(),
                Arc::new(move |request| {
                    let service = service_factory.connector_service();
                    Box::pin(async move {
                        handle_connector_tool_call("get_connector_details", &request, &service).await
                    })
                }),
            ),
            (
                create_list_connectors_tool(),
                Arc::new(move |request| {
                    let service = service_factory.connector_service();
                    Box::pin(async move {
                        handle_connector_tool_call("list_connectors", &request, &service).await
                    })
                }),
            ),
        ]
    }

    /// Create all tools with handlers
    pub fn create_all_tools(&self) -> Vec<(Tool, ToolHandler)> {
        let mut tools = Vec::new();
        tools.extend(self.create_pipeline_tools());
        tools.extend(self.create_connector_tools());
        tools
    }
}