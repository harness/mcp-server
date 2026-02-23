package modules

import (
	"time"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// SEIModule implements the Module interface for Software Engineering Insights
type SEIModule struct {
	config *config.McpServerConfig
	tsg    *toolsets.ToolsetGroup
}

// NewSEIModule creates a new instance of SEIModule
func NewSEIModule(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *SEIModule {
	return &SEIModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *SEIModule) ID() string {
	return "SEI"
}

// Name returns the name of module
func (m *SEIModule) Name() string {
	return "Software Engineering Insights"
}

// Toolsets returns the names of toolsets provided by this module
func (m *SEIModule) Toolsets() []string {
	return []string{
		"sei",
	}
}

// RegisterToolsets registers all toolsets in the SEI module
func (m *SEIModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "sei":
			if err := RegisterSoftwareEngineeringInsights(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the SEI module
func (m *SEIModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *SEIModule) IsDefault() bool {
	return false
}

// RegisterSoftwareEngineeringInsights creates and registers SEI tools
func RegisterSoftwareEngineeringInsights(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	// Create base client for SEI with extended timeout for productivity calls
	// Productivity calls can take longer to process, so we increase timeout to 60 seconds
	seiTimeout := 60 * time.Second
	c, err := DefaultClientProvider.CreateClient(config, "sei", seiTimeout)
	if err != nil {
		return err
	}

	// Initialize SEI client with the proper constructor
	seiClient := &client.SEIService{
		Client:  c,
		BaseURL: "",
		Secret:  "",
	}

	// Create AI Insights client (uses sei-panorama-api)
	aiInsightsClient := &client.AIInsightsService{
		Client:  c,
		BaseURL: "",
		Secret:  "",
	}

	// Create the SEI toolset
	sei := toolsets.NewToolset("sei", "Harness Software Engineering Insights related tools")

	// Get productivity tools and handlers
	productivityFeatureMetricsTool, productivityFeatureMetricsHandler := tools.GetProductivityFeatureMetricsTool(config, seiClient)

	// Get efficiency tools and handlers
	efficiencyLeadTimeTool, efficiencyLeadTimeHandler := tools.GetEfficiencyLeadTimeTool(config, seiClient)
	deploymentFrequencyTool, deploymentFrequencyHandler := tools.GetDeploymentFrequencyTool(config, seiClient)
	changeFailureRateTool, changeFailureRateHandler := tools.GetChangeFailureRateTool(config, seiClient)
	mttrTool, mttrHandler := tools.GetMttrTool(config, seiClient)
	deploymentFrequencyDrilldownTool, deploymentFrequencyDrilldownHandler := tools.GetDeploymentFrequencyDrilldownTool(config, seiClient)
	changeFailureRateDrilldownTool, changeFailureRateDrilldownHandler := tools.GetChangeFailureRateDrilldownTool(config, seiClient)

	// Get Teams controller tools and handlers
	getTeamTool, getTeamHandler := tools.GetTeamTool(config, seiClient)
	getTeamsListTool, getTeamsListHandler := tools.GetTeamsListTool(config, seiClient)
	getTeamIntegrationsTool, getTeamIntegrationsHandler := tools.GetTeamIntegrationsTool(config, seiClient)
	getTeamDevelopersTool, getTeamDevelopersHandler := tools.GetTeamDevelopersTool(config, seiClient)
	getTeamIntegrationFiltersTool, getTeamIntegrationFiltersHandler := tools.GetTeamIntegrationFiltersTool(config, seiClient)

	// Get OrgTree controller tools and handlers
	getOrgTreesTool, getOrgTreesHandler := tools.GetOrgTreesTool(config, seiClient)
	getOrgTreeByIdTool, getOrgTreeByIdHandler := tools.GetOrgTreeByIdTool(config, seiClient)
	getOrgTreeEfficiencyProfileTool, getOrgTreeEfficiencyProfileHandler := tools.GetOrgTreeEfficiencyProfileTool(config, seiClient)
	getOrgTreeProductivityProfileTool, getOrgTreeProductivityProfileHandler := tools.GetOrgTreeProductivityProfileTool(config, seiClient)
	getOrgTreeBusinessAlignmentProfileTool, getOrgTreeBusinessAlignmentProfileHandler := tools.GetOrgTreeBusinessAlignmentProfileTool(config, seiClient)
	getOrgTreeIntegrationsTool, getOrgTreeIntegrationsHandler := tools.GetOrgTreeIntegrationsTool(config, seiClient)
	getOrgTreeTeamsTool, getOrgTreeTeamsHandler := tools.GetOrgTreeTeamsTool(config, seiClient)

	// Get BA controller tools and handlers
	getBAAllProfilesTool, getBAAllProfilesHandler := tools.GetBAAllProfilesTool(config, seiClient)
	getBAInsightMetricsTool, getBAInsightMetricsHandler := tools.GetBAInsightMetricsTool(config, seiClient)
	getBAInsightSummaryTool, getBAInsightSummaryHandler := tools.GetBAInsightSummaryTool(config, seiClient)
	getBADrilldownDataTool, getBADrilldownDataHandler := tools.GetBADrilldownDataTool(config, seiClient)

	// Get AI Insights tools and handlers (sei-panorama-api)
	getAIUsageMetricsTool, getAIUsageMetricsHandler := tools.GetAIUsageMetricsTool(config, aiInsightsClient)
	getAIUsageBreakdownTool, getAIUsageBreakdownHandler := tools.GetAIUsageBreakdownTool(config, aiInsightsClient)
	getAIUsageSummaryTool, getAIUsageSummaryHandler := tools.GetAIUsageSummaryTool(config, aiInsightsClient)
	getAITopLanguagesTool, getAITopLanguagesHandler := tools.GetAITopLanguagesTool(config, aiInsightsClient)
	getAIAdoptionsTool, getAIAdoptionsHandler := tools.GetAIAdoptionsTool(config, aiInsightsClient)
	getAIAdoptionsBreakdownTool, getAIAdoptionsBreakdownHandler := tools.GetAIAdoptionsBreakdownTool(config, aiInsightsClient)
	getAIAdoptionsSummaryTool, getAIAdoptionsSummaryHandler := tools.GetAIAdoptionsSummaryTool(config, aiInsightsClient)
	getAIRawMetricsTool, getAIRawMetricsHandler := tools.GetAIRawMetricsTool(config, aiInsightsClient)
	getAIImpactTool, getAIImpactHandler := tools.GetAIImpactTool(config, aiInsightsClient)

	// Add tools to the toolset
	sei.AddReadTools(
		toolsets.NewServerTool(productivityFeatureMetricsTool, productivityFeatureMetricsHandler),
		toolsets.NewServerTool(efficiencyLeadTimeTool, efficiencyLeadTimeHandler),
		toolsets.NewServerTool(deploymentFrequencyTool, deploymentFrequencyHandler),
		toolsets.NewServerTool(changeFailureRateTool, changeFailureRateHandler),
		toolsets.NewServerTool(mttrTool, mttrHandler),
		toolsets.NewServerTool(deploymentFrequencyDrilldownTool, deploymentFrequencyDrilldownHandler),
		toolsets.NewServerTool(changeFailureRateDrilldownTool, changeFailureRateDrilldownHandler),
		// Teams controller tools
		toolsets.NewServerTool(getTeamTool, getTeamHandler),
		toolsets.NewServerTool(getTeamsListTool, getTeamsListHandler),
		toolsets.NewServerTool(getTeamIntegrationsTool, getTeamIntegrationsHandler),
		toolsets.NewServerTool(getTeamDevelopersTool, getTeamDevelopersHandler),
		toolsets.NewServerTool(getTeamIntegrationFiltersTool, getTeamIntegrationFiltersHandler),
		// OrgTree controller tools
		toolsets.NewServerTool(getOrgTreesTool, getOrgTreesHandler),
		toolsets.NewServerTool(getOrgTreeByIdTool, getOrgTreeByIdHandler),
		toolsets.NewServerTool(getOrgTreeEfficiencyProfileTool, getOrgTreeEfficiencyProfileHandler),
		toolsets.NewServerTool(getOrgTreeProductivityProfileTool, getOrgTreeProductivityProfileHandler),
		toolsets.NewServerTool(getOrgTreeBusinessAlignmentProfileTool, getOrgTreeBusinessAlignmentProfileHandler),
		toolsets.NewServerTool(getOrgTreeIntegrationsTool, getOrgTreeIntegrationsHandler),
		toolsets.NewServerTool(getOrgTreeTeamsTool, getOrgTreeTeamsHandler),
		// BA controller tools
		toolsets.NewServerTool(getBAAllProfilesTool, getBAAllProfilesHandler),
		toolsets.NewServerTool(getBAInsightMetricsTool, getBAInsightMetricsHandler),
		toolsets.NewServerTool(getBAInsightSummaryTool, getBAInsightSummaryHandler),
		toolsets.NewServerTool(getBADrilldownDataTool, getBADrilldownDataHandler),
		// AI Insights tools (sei-panorama-api)
		toolsets.NewServerTool(getAIUsageMetricsTool, getAIUsageMetricsHandler),
		toolsets.NewServerTool(getAIUsageBreakdownTool, getAIUsageBreakdownHandler),
		toolsets.NewServerTool(getAIUsageSummaryTool, getAIUsageSummaryHandler),
		toolsets.NewServerTool(getAITopLanguagesTool, getAITopLanguagesHandler),
		toolsets.NewServerTool(getAIAdoptionsTool, getAIAdoptionsHandler),
		toolsets.NewServerTool(getAIAdoptionsBreakdownTool, getAIAdoptionsBreakdownHandler),
		toolsets.NewServerTool(getAIAdoptionsSummaryTool, getAIAdoptionsSummaryHandler),
		toolsets.NewServerTool(getAIRawMetricsTool, getAIRawMetricsHandler),
		toolsets.NewServerTool(getAIImpactTool, getAIImpactHandler),
	)

	// Add toolset to the group
	tsg.AddToolset(sei)

	return nil
}
