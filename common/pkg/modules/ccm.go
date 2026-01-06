package modules

import (
	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// CCMModule implements the Module interface for Cloud Cost Management
type CCMModule struct {
	config *config.McpServerConfig
	tsg    *toolsets.ToolsetGroup
}

// NewCCMModule creates a new instance of CCMModule
func NewCCMModule(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *CCMModule {
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

func RegisterCloudCostManagement(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {

	// Create base client for CCM
	nextGenCli, err := DefaultClientProvider.CreateClient(config, "nextgen")
	if err != nil {
		return err
	}

	// Create base client for CCM
	ngManCli, err := DefaultClientProvider.CreateClient(config, "ngMan")
	if err != nil {
		return err
	}

	ccmClient := &client.CloudCostManagementService{
		Client:      nextGenCli,
		NgManClient: ngManCli,
	}

	// Create base client for CCM
	commOrchClient, err := DefaultClientProvider.CreateClient(config, "commOrch")
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
			toolsets.NewServerTool(tools.CcmListLabelsV2KeysTool(config, ccmClient)),
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
