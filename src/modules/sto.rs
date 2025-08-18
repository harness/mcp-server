//! Security Test Orchestration (STO) module implementation

use crate::{
    client::HarnessClient,
    config::Config,
    modules::Module,
    tools::{
        sto::{
            ExemptionsApproveExemptionTool, ExemptionsPromoteExemptionTool, StoAllIssuesListTool,
            StoGlobalExemptionsTool,
        },
        ToolRegistry,
    },
    utils::{build_service_url, create_client},
    Result,
};
use std::{sync::Arc, time::Duration};

/// STO (Security Test Orchestration) module
pub struct STOModule {
    config: Config,
}

impl STOModule {
    /// Create a new instance of STOModule
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    /// Register Security Test Orchestration toolset
    async fn register_sto(&self, registry: &mut ToolRegistry) -> Result<()> {
        let base_url = build_service_url(
            &self.config,
            self.config.sto_svc_base_url.as_deref(),
            &self.config.base_url,
            "sto",
        );
        
        // Do not use STO API key, use NG Manager secret as STO calls ACL & ng-manager APIs with the token
        let principal_secret = self.config.ng_manager_secret.clone();
        
        let sto_client = Arc::new(create_client(
            base_url,
            &self.config,
            principal_secret.clone(),
            Some(Duration::from_secs(30)),
        ).await?);

        let base_url_principal = build_service_url(
            &self.config,
            self.config.ng_manager_base_url.as_deref(),
            &self.config.base_url,
            "ng/api",
        );

        let principal_client = Arc::new(create_client(
            base_url_principal,
            &self.config,
            principal_secret,
            None,
        ).await?);

        // Register STO tools
        registry.register(Box::new(StoAllIssuesListTool::new(
            self.config.clone(),
            sto_client.clone(),
        )));
        registry.register(Box::new(StoGlobalExemptionsTool::new(
            self.config.clone(),
            sto_client.clone(),
            principal_client.clone(),
        )));
        registry.register(Box::new(ExemptionsPromoteExemptionTool::new(
            self.config.clone(),
            sto_client.clone(),
            principal_client.clone(),
        )));
        registry.register(Box::new(ExemptionsApproveExemptionTool::new(
            self.config.clone(),
            sto_client,
            principal_client,
        )));

        Ok(())
    }
}

impl Module for STOModule {
    fn id(&self) -> &str {
        "STO"
    }

    fn name(&self) -> &str {
        "Security Test Orchestration"
    }

    fn is_default(&self) -> bool {
        false
    }

    async fn register_tools(&self, registry: &mut ToolRegistry) -> Result<()> {
        self.register_sto(registry).await
    }
}