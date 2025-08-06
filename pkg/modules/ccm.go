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
			toolsets.NewServerTool(tools.ListCcmRecommendationsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmRecommendationsByResourceTypeTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmRecommendationsStatsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.UpdateCcmRecommendationStateTool(config, ccmClient)),
			toolsets.NewServerTool(tools.OverrideCcmRecommendationSavingsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.FetchCommitmentCoverageTool(config, ccmClient)),
			toolsets.NewServerTool(tools.FetchCommitmentSavingsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.FetchCommitmentUtilisationTool(config, ccmClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(ccm)
	return nil
}
