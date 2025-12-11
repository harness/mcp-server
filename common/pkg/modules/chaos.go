package modules

import (
	"time"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// CHAOSModule implements the Module interface for Chaos Engineering
type CHAOSModule struct {
	config *config.McpServerConfig
	tsg    *toolsets.ToolsetGroup
}

// NewCHAOSModule creates a new instance of CHAOSModule
func NewCHAOSModule(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *CHAOSModule {
	return &CHAOSModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *CHAOSModule) ID() string {
	return "CHAOS"
}

// Name returns the name of module
func (m *CHAOSModule) Name() string {
	return "Chaos Engineering"
}

// Toolsets returns the names of toolsets provided by this module
func (m *CHAOSModule) Toolsets() []string {
	return []string{
		"chaos",
	}
}

// RegisterToolsets registers all toolsets in the CHAOS module
func (m *CHAOSModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "chaos":
			if err := RegisterChaos(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the CHAOS module
func (m *CHAOSModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *CHAOSModule) IsDefault() bool {
	return false
}

// RegisterChaos registers the chaos toolset
func RegisterChaos(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	// Create base client for CHAOS
	customTimeout := 30 * time.Second
	c, err := DefaultClientProvider.CreateClient(config, "chaos/manager/api", customTimeout)
	if err != nil {
		return err
	}

	chaosClient := &client.ChaosService{Client: c}

	// Create the CHAOS toolset
	chaos := toolsets.NewToolset("chaos", "Harness Chaos Engineering related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListExperimentsTool(config, chaosClient)),
			toolsets.NewServerTool(tools.GetExperimentsTool(config, chaosClient)),
			toolsets.NewServerTool(tools.GetExperimentRunsTool(config, chaosClient)),
			toolsets.NewServerTool(tools.RunExperimentTool(config, chaosClient)),
			toolsets.NewServerTool(tools.ListProbesTool(config, chaosClient)),
			toolsets.NewServerTool(tools.GetProbeTool(config, chaosClient)),
			toolsets.NewServerTool(tools.ListExperimentTemplatesTool(config, chaosClient)),
			toolsets.NewServerTool(tools.CreateExperimentFromTemplateTool(config, chaosClient)),
			toolsets.NewServerTool(tools.ListExperimentVariablesTool(config, chaosClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(chaos)
	return nil
}
