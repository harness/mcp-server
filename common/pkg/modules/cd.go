package modules

import (
	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// CDModule implements the Module interface for Continuous Delivery
type CDModule struct {
	config *config.McpServerConfig
	tsg    *toolsets.ToolsetGroup
}

// NewCDModule creates a new instance of CDModule
func NewCDModule(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *CDModule {
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
		"infrastructures",
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
		case "infrastructures":
			if err := RegisterInfrastructure(m.config, m.tsg); err != nil {
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
func RegisterInfrastructure(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	// Create base client for infrastructure
	c, err := DefaultClientProvider.CreateClient(config, "ngMan")
	if err != nil {
		return err
	}

	infrastructureClient := &client.InfrastructureClient{Client: c}

	// Create the infrastructure toolset
	infrastructure := toolsets.NewToolset("infrastructures", "Harness Infrastructure related tools").
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
func RegisterServices(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	// Create base client for services
	c, err := DefaultClientProvider.CreateClient(config, "ngMan")
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
func RegisterEnvironments(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	// Create base client for environments
	c, err := DefaultClientProvider.CreateClient(config, "ngMan")
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
