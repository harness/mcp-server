package modules

import (
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// CCMModule implements the Module interface for Cloud Cost Management
type CCMModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewCCMModule creates a new instance of CCMModule
func NewCCMModule(config *config.Config, tsg *toolsets.ToolsetGroup) *CCMModule {
	return &CCMModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *CCMModule) ID() string {
	return "CCM"
}

// Name returns the name of module
func (m *CCMModule) Name() string {
	return "Cloud Cost Management"
}

// Toolsets returns the names of toolsets provided by this module
func (m *CCMModule) Toolsets() []string {
	return []string{
		"ccm",
	}
}

// RegisterToolsets registers all toolsets in the CCM module
func (m *CCMModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "ccm":
			if err := RegisterCloudCostManagement(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the CCM module
func (m *CCMModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *CCMModule) IsDefault() bool {
	return false
}

func RegisterCloudCostManagement(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for CCM
	baseURL := utils.BuildServiceURL(config, config.NextgenCEBaseURL, config.BaseURL, "")
	secret := config.NextgenCESecret

	// Create base client for CCM
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	ccmClient := &client.CloudCostManagementService{
		Client: c,
	}

	commOrchBaseURL := utils.BuildServiceURL(config, config.CCMCommOrchBaseURL, config.BaseURL, "lw/co/api")
	commOrchSecret := config.CCMCommOrchSecret

	// Create base client for CCM
	commOrchClient, err := utils.CreateClient(commOrchBaseURL, config, commOrchSecret)
	if err != nil {
		return err
	}

	ccmCommOrchClient := &client.CloudCostManagementService{
		Client: commOrchClient,
	}

	// Create the CCM toolset
	ccm := toolsets.NewToolset("ccm", "Harness Cloud Cost Management related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetCcmOverviewTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmCostCategoriesTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmCostCategoriesDetailTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmCostCategoryTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmPerspectivesDetailTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetLastPeriodCostCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetLastTwelveMonthsCostCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CreateCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.UpdateCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.DeleteCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmPerspectiveRulesTool(config)),
			toolsets.NewServerTool(tools.CcmPerspectiveGridTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveTimeSeriesTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveSummaryWithBudgetTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveBudgetTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmMetadataTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveRecommendationsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveFilterValuesTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveFilterValuesToolEvent(config)),
			toolsets.NewServerTool(tools.ListCcmRecommendationsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmRecommendationsByResourceTypeTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmRecommendationsStatsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.UpdateCcmRecommendationStateTool(config, ccmClient)),
			toolsets.NewServerTool(tools.OverrideCcmRecommendationSavingsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CreateCcmJiraTicketTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CreateCcmServiceNowTicketTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetEc2RecommendationDetailTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetAzureVmRecommendationDetailTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetEcsServiceRecommendationDetailTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetNodePoolRecommendationDetailTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetWorkloadRecommendationDetailTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListJiraProjectsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListJiraIssueTypesTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmAnomaliesSummaryTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmAnomaliesTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListAllCcmAnomaliesTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmIgnoredAnomaliesTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmAnomaliesForPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ReportCcmAnomalyFeedbackTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListFilterValuesCcmAnomaliesTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListAllCcmBudgetsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmBudgetDetailTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmBudgetsForPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmBudgetCostDetailTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CloneCcmBudgetTool(config, ccmClient)),
			toolsets.NewServerTool(tools.DeleteCcmBudgetTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CreateCcmBudgetTool(config, ccmClient)),
			toolsets.NewServerTool(tools.UpdateCcmBudgetTool(config, ccmClient)),
			toolsets.NewServerTool(tools.FetchCommitmentCoverageTool(config, ccmClient)),
			toolsets.NewServerTool(tools.FetchCommitmentSavingsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.FetchCommitmentUtilisationTool(config, ccmClient)),
			toolsets.NewServerTool(tools.FetchEstimatedSavingsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.FetchEC2AnalysisTool(config, ccmCommOrchClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(ccm)
	return nil
}
