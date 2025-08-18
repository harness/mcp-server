//! Cloud Cost Management (CCM) module implementation

use crate::{
    client::HarnessClient,
    config::Config,
    modules::Module,
    tools::{
        ccm::{
            CcmMetadataTool, CcmPerspectiveBudgetTool, CcmPerspectiveFilterValuesTool,
            CcmPerspectiveGridTool, CcmPerspectiveRulesTool, CcmPerspectiveTimeSeriesTool,
            CreateCcmPerspectiveTool, DeleteCcmPerspectiveTool, FetchCommitmentCoverageTool,
            FetchCommitmentSavingsTool, FetchCommitmentUtilisationTool, FetchEC2AnalysisTool,
            FetchEstimatedSavingsTool, GetCcmCostCategoryTool, GetCcmOverviewTool,
            GetCcmPerspectiveTool, GetCcmRecommendationsStatsTool, GetLastPeriodCostCcmPerspectiveTool,
            GetLastTwelveMonthsCostCcmPerspectiveTool, ListCcmCostCategoriesTool,
            ListCcmCostCategoriesDetailTool, ListCcmPerspectivesDetailTool,
            ListCcmRecommendationsByResourceTypeTool, ListCcmRecommendationsTool,
            OverrideCcmRecommendationSavingsTool, UpdateCcmPerspectiveTool,
            UpdateCcmRecommendationStateTool,
        },
        ToolRegistry,
    },
    utils::{build_service_url, create_client},
    Result,
};
use std::sync::Arc;

/// CCM (Cloud Cost Management) module
pub struct CCMModule {
    config: Config,
}

impl CCMModule {
    /// Create a new instance of CCMModule
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    /// Register cloud cost management toolset
    async fn register_cloud_cost_management(&self, registry: &mut ToolRegistry) -> Result<()> {
        // Create CCM client
        let base_url = build_service_url(
            &self.config,
            self.config.nextgen_ce_base_url.as_deref(),
            &self.config.base_url,
            "",
        );
        let secret = self.config.nextgen_ce_secret.clone();

        let ccm_client = Arc::new(create_client(base_url, &self.config, secret, None).await?);

        // Create CCM Communication Orchestrator client
        let comm_orch_base_url = build_service_url(
            &self.config,
            self.config.ccm_comm_orch_base_url.as_deref(),
            &self.config.base_url,
            "lw/co/api",
        );
        let comm_orch_secret = self.config.ccm_comm_orch_secret.clone();

        let ccm_comm_orch_client = Arc::new(create_client(
            comm_orch_base_url,
            &self.config,
            comm_orch_secret,
            None,
        ).await?);

        // Register CCM tools
        registry.register(Box::new(GetCcmOverviewTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(ListCcmCostCategoriesTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(ListCcmCostCategoriesDetailTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(GetCcmCostCategoryTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(ListCcmPerspectivesDetailTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(GetCcmPerspectiveTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(GetLastPeriodCostCcmPerspectiveTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(GetLastTwelveMonthsCostCcmPerspectiveTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(CreateCcmPerspectiveTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(UpdateCcmPerspectiveTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(DeleteCcmPerspectiveTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(CcmPerspectiveRulesTool::new(
            self.config.clone(),
        )));
        registry.register(Box::new(CcmPerspectiveGridTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(CcmPerspectiveTimeSeriesTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(CcmPerspectiveBudgetTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(CcmMetadataTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(CcmPerspectiveFilterValuesTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(ListCcmRecommendationsTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(ListCcmRecommendationsByResourceTypeTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(GetCcmRecommendationsStatsTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(UpdateCcmRecommendationStateTool::new(
            self.config.clone(),
            ccm_client.clone(),
        )));
        registry.register(Box::new(OverrideCcmRecommendationSavingsTool::new(
            self.config.clone(),
            ccm_client,
        )));

        // Register CCM Communication Orchestrator tools
        registry.register(Box::new(FetchCommitmentCoverageTool::new(
            self.config.clone(),
            ccm_comm_orch_client.clone(),
        )));
        registry.register(Box::new(FetchCommitmentSavingsTool::new(
            self.config.clone(),
            ccm_comm_orch_client.clone(),
        )));
        registry.register(Box::new(FetchCommitmentUtilisationTool::new(
            self.config.clone(),
            ccm_comm_orch_client.clone(),
        )));
        registry.register(Box::new(FetchEstimatedSavingsTool::new(
            self.config.clone(),
            ccm_comm_orch_client.clone(),
        )));
        registry.register(Box::new(FetchEC2AnalysisTool::new(
            self.config.clone(),
            ccm_comm_orch_client,
        )));

        Ok(())
    }
}

impl Module for CCMModule {
    fn id(&self) -> &str {
        "CCM"
    }

    fn name(&self) -> &str {
        "Cloud Cost Management"
    }

    fn is_default(&self) -> bool {
        false
    }

    async fn register_tools(&self, registry: &mut ToolRegistry) -> Result<()> {
        self.register_cloud_cost_management(registry).await
    }
}