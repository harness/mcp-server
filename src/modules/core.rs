//! Core module implementation for Harness MCP Server

use crate::{
    client::HarnessClient,
    config::Config,
    modules::{Module, ModuleRegistry},
    tools::{
        access_control::{GetAllUsersTool, GetUserInfoTool, ListAvailableRolesTool},
        audit::ListUserAuditTrailTool,
        chatbot::AskChatbotTool,
        connectors::{GetConnectorDetailsTool, ListConnectorCatalogueTool},
        dashboards::{GetDashboardDataTool, ListDashboardsTool},
        genai::AIDevOpsAgentTool,
        intelligence::FindSimilarTemplatesTool,
        logs::DownloadExecutionLogsTool,
        pipelines::{GetPipelineTool, ListPipelinesTool},
        templates::ListTemplatesTool,
        ToolRegistry,
    },
    utils::{build_service_url, create_client, create_service_client},
    Result,
};
use std::{sync::Arc, time::Duration};

/// Default timeout for GenAI service
const DEFAULT_GENAI_TIMEOUT: Duration = Duration::from_secs(300);

/// Core module containing all default toolsets
pub struct CoreModule {
    config: Config,
}

impl CoreModule {
    /// Create a new instance of CoreModule
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    /// Register pipelines toolset
    async fn register_pipelines(&self, registry: &mut ToolRegistry) -> Result<()> {
        let base_url = build_service_url(
            &self.config,
            self.config.pipeline_svc_base_url.as_deref(),
            &self.config.base_url,
            "pipeline",
        );
        let secret = self.config.pipeline_svc_secret.clone();

        let client = create_client(base_url, &self.config, secret, None).await?;
        let pipeline_client = Arc::new(client);

        // Register pipeline tools
        registry.register(Box::new(ListPipelinesTool::new(
            self.config.clone(),
            pipeline_client.clone(),
        )));
        registry.register(Box::new(GetPipelineTool::new(
            self.config.clone(),
            pipeline_client,
        )));

        Ok(())
    }

    /// Register connectors toolset
    async fn register_connectors(&self, registry: &mut ToolRegistry) -> Result<()> {
        let client = create_service_client(
            &self.config,
            self.config.ng_manager_base_url.as_deref(),
            &self.config.base_url,
            "ng/api",
            self.config.ng_manager_secret.clone(),
        )
        .await?;

        let connector_client = Arc::new(client);

        registry.register(Box::new(ListConnectorCatalogueTool::new(
            self.config.clone(),
            connector_client.clone(),
        )));
        registry.register(Box::new(GetConnectorDetailsTool::new(
            self.config.clone(),
            connector_client,
        )));

        Ok(())
    }

    /// Register dashboards toolset
    async fn register_dashboards(&self, registry: &mut ToolRegistry) -> Result<()> {
        let base_url = build_service_url(
            &self.config,
            self.config.dashboard_svc_base_url.as_deref(),
            &self.config.base_url,
            "dashboard",
        );
        let secret = self.config.dashboard_svc_secret.clone();

        let client = create_client(
            base_url,
            &self.config,
            secret,
            Some(Duration::from_secs(30)),
        )
        .await?;
        let dashboard_client = Arc::new(client);

        registry.register(Box::new(ListDashboardsTool::new(
            self.config.clone(),
            dashboard_client.clone(),
        )));
        registry.register(Box::new(GetDashboardDataTool::new(
            self.config.clone(),
            dashboard_client,
        )));

        Ok(())
    }

    /// Register audit toolset
    async fn register_audit(&self, registry: &mut ToolRegistry) -> Result<()> {
        let base_url = build_service_url(
            &self.config,
            self.config.audit_svc_base_url.as_deref(),
            &self.config.base_url,
            "audit",
        );
        let secret = self.config.audit_svc_secret.clone();

        let client = create_client(base_url, &self.config, secret, None).await?;
        let audit_client = Arc::new(client);

        registry.register(Box::new(ListUserAuditTrailTool::new(
            self.config.clone(),
            audit_client,
        )));

        Ok(())
    }

    /// Register access control toolset
    async fn register_access_control(&self, registry: &mut ToolRegistry) -> Result<()> {
        let rbac_base_url = build_service_url(
            &self.config,
            self.config.rbac_svc_base_url.as_deref(),
            &self.config.base_url,
            "authz",
        );
        let rbac_secret = self.config.rbac_svc_secret.clone();

        let principal_base_url = build_service_url(
            &self.config,
            self.config.ng_manager_base_url.as_deref(),
            &self.config.base_url,
            "ng/api",
        );
        let principal_secret = self.config.ng_manager_secret.clone();

        let rbac_client = Arc::new(create_client(rbac_base_url, &self.config, rbac_secret, None).await?);
        let principal_client = Arc::new(create_client(principal_base_url, &self.config, principal_secret, None).await?);

        registry.register(Box::new(ListAvailableRolesTool::new(
            self.config.clone(),
            rbac_client.clone(),
        )));
        registry.register(Box::new(GetUserInfoTool::new(
            self.config.clone(),
            principal_client.clone(),
        )));
        registry.register(Box::new(GetAllUsersTool::new(
            self.config.clone(),
            principal_client,
        )));

        Ok(())
    }

    /// Register templates toolset
    async fn register_templates(&self, registry: &mut ToolRegistry) -> Result<()> {
        let base_url = build_service_url(
            &self.config,
            self.config.template_svc_base_url.as_deref(),
            &self.config.base_url,
            "",
        );
        let secret = self.config.template_svc_secret.clone();

        let client = create_client(base_url, &self.config, secret, None).await?;
        let template_client = Arc::new(client);

        registry.register(Box::new(ListTemplatesTool::new(
            self.config.clone(),
            template_client,
        )));

        Ok(())
    }

    /// Register logs toolset
    async fn register_logs(&self, registry: &mut ToolRegistry) -> Result<()> {
        // Skip registration for internal mode for now
        if self.config.internal {
            return Ok(());
        }

        let log_service_base_url = if self.config.base_url.contains("/gateway") {
            build_service_url(
                &self.config,
                self.config.log_svc_base_url.as_deref(),
                &self.config.base_url,
                "log-service",
            )
        } else {
            build_service_url(
                &self.config,
                self.config.log_svc_base_url.as_deref(),
                &self.config.base_url,
                "gateway/log-service",
            )
        };
        let log_service_secret = self.config.log_svc_secret.clone();

        let log_client = create_client(log_service_base_url, &self.config, log_service_secret, None).await?;

        let pipeline_base_url = build_service_url(
            &self.config,
            self.config.pipeline_svc_base_url.as_deref(),
            &self.config.base_url,
            "pipeline",
        );
        let pipeline_secret = self.config.pipeline_svc_secret.clone();

        let pipeline_client = create_client(pipeline_base_url, &self.config, pipeline_secret, None).await?;

        registry.register(Box::new(DownloadExecutionLogsTool::new(
            self.config.clone(),
            Arc::new(log_client),
            Arc::new(pipeline_client),
        )));

        Ok(())
    }

    /// Register GenAI toolset
    async fn register_genai(&self, registry: &mut ToolRegistry) -> Result<()> {
        // Skip registration for external mode for now
        if !self.config.internal {
            return Ok(());
        }

        let base_url = self.config.genai_base_url.clone().unwrap_or_default();
        let secret = self.config.genai_secret.clone();

        let client = create_client(
            base_url,
            &self.config,
            secret,
            Some(DEFAULT_GENAI_TIMEOUT),
        )
        .await?;
        let genai_client = Arc::new(client);

        registry.register(Box::new(AIDevOpsAgentTool::new(
            self.config.clone(),
            genai_client,
        )));

        Ok(())
    }

    /// Register intelligence toolset
    async fn register_intelligence(&self, registry: &mut ToolRegistry) -> Result<()> {
        let base_url = build_service_url(
            &self.config,
            self.config.intelligence_svc_base_url.as_deref(),
            &self.config.base_url,
            "harness-intelligence",
        );
        let secret = self.config.intelligence_svc_secret.clone();

        let client = create_client(base_url, &self.config, secret, None).await?;
        let intelligence_client = Arc::new(client);

        registry.register(Box::new(FindSimilarTemplatesTool::new(
            self.config.clone(),
            intelligence_client,
        )));

        Ok(())
    }

    /// Register chatbot toolset
    async fn register_chatbot(&self, registry: &mut ToolRegistry) -> Result<()> {
        // Skip registration for external mode (no external service exposed)
        if !self.config.internal {
            return Ok(());
        }

        let base_url = self.config.chatbot_base_url.clone().unwrap_or_default();
        let secret = self.config.chatbot_secret.clone();

        let client = create_client(base_url, &self.config, secret, None).await?;
        let chatbot_client = Arc::new(client);

        registry.register(Box::new(AskChatbotTool::new(
            self.config.clone(),
            chatbot_client,
        )));

        Ok(())
    }
}

impl Module for CoreModule {
    fn id(&self) -> &str {
        "CORE"
    }

    fn name(&self) -> &str {
        "Core Module"
    }

    fn is_default(&self) -> bool {
        true
    }

    async fn register_tools(&self, registry: &mut ToolRegistry) -> Result<()> {
        // Register all core toolsets
        self.register_pipelines(registry).await?;
        self.register_connectors(registry).await?;
        self.register_audit(registry).await?;
        self.register_dashboards(registry).await?;
        self.register_access_control(registry).await?;
        self.register_templates(registry).await?;
        self.register_logs(registry).await?;
        self.register_genai(registry).await?;
        self.register_intelligence(registry).await?;
        self.register_chatbot(registry).await?;

        Ok(())
    }
}