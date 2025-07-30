package modules

import (
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// IDPModule implements the Module interface for Internal Developer Portal
type IDPModule struct {
	DefaultModulePrompts // Embed DefaultModulePrompts to satisfy the Module interface
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewIDPModule creates a new instance of IDPModule
func NewIDPModule(config *config.Config, tsg *toolsets.ToolsetGroup) *IDPModule {
	return &IDPModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *IDPModule) ID() string {
	return "IDP"
}

// Name returns the name of module
func (m *IDPModule) Name() string {
	return "Internal Developer Portal"
}

// Toolsets returns the names of toolsets provided by this module
func (m *IDPModule) Toolsets() []string {
	return []string{
		"Internal Developer Portal",
	}
}

// RegisterToolsets registers all toolsets in the IDP module
func (m *IDPModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "Internal Developer Portal":
			if err := RegisterInternalDeveloperPortal(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the IDP module
func (m *IDPModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *IDPModule) IsDefault() bool {
	return false
}

func RegisterInternalDeveloperPortal(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for IDP service
	baseURL := utils.BuildServiceURL(config, config.IDPSvcBaseURL, config.BaseURL, "")
	secret := config.IDPSvcSecret

	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	idpClient := &client.IDPService{
		Client: c,
	}

	idp := toolsets.NewToolset("Internal Developer Portal", "Harness Internal Developer Portal catalog related tools for managing catalog Entities which represent the core components of your system").
		AddReadTools(
			toolsets.NewServerTool(tools.ListEntitiesTool(config, idpClient)),
			toolsets.NewServerTool(tools.GetEntityTool(config, idpClient)),
			toolsets.NewServerTool(tools.GetScorecardTool(config, idpClient)),
			toolsets.NewServerTool(tools.ListScorecardsTool(config, idpClient)),
			toolsets.NewServerTool(tools.GetScoreSummaryTool(config, idpClient)),
			toolsets.NewServerTool(tools.GetScoresTool(config, idpClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(idp)
	return nil
}
