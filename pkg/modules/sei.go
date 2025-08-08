package modules

import (
	"log/slog"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// SEIModule implements the Module interface for Software Engineering Insights
type SEIModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewSEIModule creates a new instance of SEIModule
func NewSEIModule(config *config.Config, tsg *toolsets.ToolsetGroup) *SEIModule {
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
	return true
}

// RegisterSoftwareEngineeringInsights creates and registers SEI tools
func RegisterSoftwareEngineeringInsights(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for SEI
// 	baseURL := utils.BuildServiceURL(config, config.SEISvcBaseURL, config.BaseURL, "")
	baseURL := "http://localhost:8080"
	var secret string
	if config.SEISvcSecret != "" {
		secret = config.SEISvcSecret
	}

	slog.Info("SEI service configuration", "baseURL", baseURL, "secret", secret)
	
	// Create base client for SEI
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	// Initialize SEI client with the proper constructor
	seiClient := &client.SEIService{
		Client:  c,
		BaseURL: baseURL,
		Secret:  secret,
	}

	// Create the SEI toolset
	sei := toolsets.NewToolset("sei", "Harness Software Engineering Insights related tools")

	// Get productivity tools and handlers
	productivityFeatureMetricsTool, productivityFeatureMetricsHandler := tools.GetProductivityFeatureMetricsTool(config, seiClient)

	// Get efficiency tools and handlers
	efficiencyLeadTimeTool, efficiencyLeadTimeHandler := tools.GetEfficiencyLeadTimeTool(config, seiClient)

	// Add tools to the toolset
	sei.AddReadTools(
		toolsets.NewServerTool(productivityFeatureMetricsTool, productivityFeatureMetricsHandler),
		toolsets.NewServerTool(efficiencyLeadTimeTool, efficiencyLeadTimeHandler),
	)

	// Add toolset to the group
	tsg.AddToolset(sei)

	return nil
}
