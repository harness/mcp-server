package modules

import (
	"log/slog"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// ACMModule implements the Module interface for Autonomous Code Maintenance
type ACMModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewACMModule creates a new instance of ACMModule
func NewACMModule(config *config.Config, tsg *toolsets.ToolsetGroup) *ACMModule {
	return &ACMModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *ACMModule) ID() string {
	return "ACM"
}

// Name returns the name of module
func (m *ACMModule) Name() string {
	return "Autonomous Code Maintenance"
}

// Toolsets returns the names of toolsets provided by this module
func (m *ACMModule) Toolsets() []string {
	return []string{
		"acm",
	}
}

// RegisterToolsets registers all toolsets in this module
func (m *ACMModule) RegisterToolsets() error {
	return RegisterACM(m.config, m.tsg)
}

// EnableToolsets enables all toolsets in this module
func (m *ACMModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *ACMModule) IsDefault() bool {
	return false
}

// RegisterACM registers the ACM toolset
func RegisterACM(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Only register in external mode
	if config.Internal {
		return nil
	}

	slog.Info("Registering ACM toolset")

	// Create ACM service client
	acmClient, err := utils.CreateServiceClient(config, config.BaseURL, config.BaseURL, "autoai", config.APIKey)
	if err != nil {
		return err
	}
	acmServiceClient := &client.ACMService{Client: acmClient}

	// Create the ACM toolset
	acmToolset := toolsets.NewToolset("acm",
		"Harness Autonomous Code Maintenance tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetAutonomousCodeMaintenanceTaskExecutionsTool(config, acmServiceClient)),
		).
		AddWriteTools(
			toolsets.NewServerTool(tools.CreateAutonomousCodeMaintenanceTaskTool(config, acmServiceClient)),
			toolsets.NewServerTool(tools.TriggerAutonomousCodeMaintenanceTaskTool(config, acmServiceClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(acmToolset)
	return nil
}
