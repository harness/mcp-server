//! Continuous Delivery (CD) module implementation

use crate::{
    client::HarnessClient,
    config::Config,
    modules::Module,
    tools::{
        environments::{GetEnvironmentTool, ListEnvironmentsTool, MoveEnvironmentConfigsTool},
        infrastructure::{ListInfrastructuresTool, MoveInfrastructureConfigsTool},
        services::{GetServiceTool, ListServicesTool},
        ToolRegistry,
    },
    utils::{build_service_url, create_client},
    Result,
};
use std::sync::Arc;

/// CD (Continuous Delivery) module
pub struct CDModule {
    config: Config,
}

impl CDModule {
    /// Create a new instance of CDModule
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    /// Register services toolset
    async fn register_services(&self, registry: &mut ToolRegistry) -> Result<()> {
        let base_url = build_service_url(
            &self.config,
            self.config.ng_manager_base_url.as_deref(),
            &self.config.base_url,
            "ng/api",
        );
        let secret = self.config.ng_manager_secret.clone();

        let service_client = Arc::new(create_client(base_url, &self.config, secret, None).await?);

        registry.register(Box::new(GetServiceTool::new(
            self.config.clone(),
            service_client.clone(),
        )));
        registry.register(Box::new(ListServicesTool::new(
            self.config.clone(),
            service_client,
        )));

        Ok(())
    }

    /// Register environments toolset
    async fn register_environments(&self, registry: &mut ToolRegistry) -> Result<()> {
        let base_url = build_service_url(
            &self.config,
            self.config.ng_manager_base_url.as_deref(),
            &self.config.base_url,
            "ng/api",
        );
        let secret = self.config.ng_manager_secret.clone();

        let environment_client = Arc::new(create_client(base_url, &self.config, secret, None).await?);

        registry.register(Box::new(GetEnvironmentTool::new(
            self.config.clone(),
            environment_client.clone(),
        )));
        registry.register(Box::new(ListEnvironmentsTool::new(
            self.config.clone(),
            environment_client.clone(),
        )));
        registry.register(Box::new(MoveEnvironmentConfigsTool::new(
            self.config.clone(),
            environment_client,
        )));

        Ok(())
    }

    /// Register infrastructure toolset
    async fn register_infrastructure(&self, registry: &mut ToolRegistry) -> Result<()> {
        let base_url = build_service_url(
            &self.config,
            self.config.ng_manager_base_url.as_deref(),
            &self.config.base_url,
            "ng/api",
        );
        let secret = self.config.ng_manager_secret.clone();

        let infrastructure_client = Arc::new(create_client(base_url, &self.config, secret, None).await?);

        registry.register(Box::new(ListInfrastructuresTool::new(
            self.config.clone(),
            infrastructure_client.clone(),
        )));
        registry.register(Box::new(MoveInfrastructureConfigsTool::new(
            self.config.clone(),
            infrastructure_client,
        )));

        Ok(())
    }
}

impl Module for CDModule {
    fn id(&self) -> &str {
        "CD"
    }

    fn name(&self) -> &str {
        "Continuous Delivery"
    }

    fn is_default(&self) -> bool {
        false
    }

    async fn register_tools(&self, registry: &mut ToolRegistry) -> Result<()> {
        self.register_services(registry).await?;
        self.register_environments(registry).await?;
        self.register_infrastructure(registry).await?;
        Ok(())
    }
}