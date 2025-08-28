package modules

import (
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// CDModule implements the Module interface for Continuous Delivery
type CDModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewCDModule creates a new instance of CDModule
func NewCDModule(config *config.Config, tsg *toolsets.ToolsetGroup) *CDModule {
	return &CDModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *CDModule) ID() string {
	return "CD"
}

// Name returns the name of module
func (m *CDModule) Name() string {
	return "Continuous Delivery"
}

// Toolsets returns the names of toolsets provided by this module
func (m *CDModule) Toolsets() []string {
	return []string{
		"services",
		"environments",
		"infrastructure",
		"rmg_genai",
	}
}

// RegisterToolsets registers all toolsets in the CD module
func (m *CDModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "services":
			if err := RegisterServices(m.config, m.tsg); err != nil {
				return err
			}
		case "environments":
			if err := RegisterEnvironments(m.config, m.tsg); err != nil {
				return err
			}
		case "infrastructure":
			if err := RegisterInfrastructure(m.config, m.tsg); err != nil {
				return err
			}
		case "rmg_genai":
			if err := RegisterRMGGenAI(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the CD module
func (m *CDModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *CDModule) IsDefault() bool {
	return false
}

// RegisterInfrastructure registers the infrastructure toolset
func RegisterInfrastructure(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for infrastructure
	baseURL := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	// Create base client for infrastructure
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	infrastructureClient := &client.InfrastructureClient{Client: c}

	// Create the infrastructure toolset
	infrastructure := toolsets.NewToolset("infrastructure", "Harness Infrastructure related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListInfrastructuresTool(config, infrastructureClient)),
		).
		AddWriteTools(
			toolsets.NewServerTool(tools.MoveInfrastructureConfigsTool(config, infrastructureClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(infrastructure)
	return nil
}

// RegisterServices registers the services toolset
func RegisterServices(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for services
	baseURL := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	// Create base client for services
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	serviceClient := &client.ServiceClient{Client: c}

	// Create the services toolset
	services := toolsets.NewToolset("services", "Harness Service related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetServiceTool(config, serviceClient)),
			toolsets.NewServerTool(tools.ListServicesTool(config, serviceClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(services)
	return nil
}

// RegisterEnvironments registers the environments toolset
func RegisterEnvironments(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for environments
	baseURL := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	// Create base client for environments
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	environmentClient := &client.EnvironmentClient{Client: c}

	// Create the environments toolset
	environments := toolsets.NewToolset("environments", "Harness Environment related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetEnvironmentTool(config, environmentClient)),
			toolsets.NewServerTool(tools.ListEnvironmentsTool(config, environmentClient)),
		).
		AddWriteTools(
			toolsets.NewServerTool(tools.MoveEnvironmentConfigsTool(config, environmentClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(environments)
	return nil
}

// RegisterRMGGenAI registers the RMG GenAI toolset
func RegisterRMGGenAI(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Skip registration for external mode for now
	if !config.Internal {
		return nil
	}

	// Get the GenAI client
	genaiClient, err := GetGenAIClient(config)
	if err != nil {
		return err
	}

	// Create the RMG genai toolset
	rmgGenai := toolsets.NewToolset("rmg_genai", "RMG GenAI tools").
		AddReadTools(
			toolsets.NewServerTool(tools.RMDevOpsAgentTool(config, genaiClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(rmgGenai)
	return nil
}
