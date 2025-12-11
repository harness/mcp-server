package modules

import (
	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/auth"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
	"github.com/mark3labs/mcp-go/server"
)

// IDPModule implements the Module interface for Internal Developer Portal
type IDPModule struct {
	config *config.McpServerConfig
	tsg    *toolsets.ToolsetGroup
}

// NewIDPModule creates a new instance of IDPModule
func NewIDPModule(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *IDPModule {
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
		"idp",
	}
}

// RegisterToolsets registers all toolsets in the IDP module
func (m *IDPModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "idp":
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

func RegisterInternalDeveloperPortal(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	c, err := DefaultClientProvider.CreateClient(config, "")
	if err != nil {
		return err
	}

	ngManagerAuthProvider := auth.NewAPIKeyProvider(config.APIKey)

	idpClient := &client.IDPService{
		Client:                c,
		NgManagerAuthProvider: ngManagerAuthProvider,
	}

	idpTools := []server.ServerTool{
		toolsets.NewServerTool(tools.ListEntitiesTool(config, idpClient)),
		toolsets.NewServerTool(tools.GetEntityTool(config, idpClient)),
		toolsets.NewServerTool(tools.GetScorecardTool(config, idpClient)),
		toolsets.NewServerTool(tools.ListScorecardsTool(config, idpClient)),
		toolsets.NewServerTool(tools.GetScoreSummaryTool(config, idpClient)),
		toolsets.NewServerTool(tools.GetScoresTool(config, idpClient)),
		toolsets.NewServerTool(tools.GetScorecardStatsTool(config, idpClient)),
		toolsets.NewServerTool(tools.GetCheckTool(config, idpClient)),
		toolsets.NewServerTool(tools.ListChecksTool(config, idpClient)),
		toolsets.NewServerTool(tools.GetCheckStatsTool(config, idpClient)),
		toolsets.NewServerTool(tools.ExecuteWorkflowTool(config, idpClient)),
		toolsets.NewServerTool(tools.SearchTechDocsTool(config, idpClient)),
	}

	idp := toolsets.NewToolset("idp", "Harness Internal Developer Portal catalog related tools for managing catalog Entities which represent the core components of your system. It also hosts the technical documentation for the entities which can be used to answer questions regarding the installation/setup/configuration/testing or any other information about the entities.").
		AddReadTools(idpTools...)

	// Add toolset to the group
	tsg.AddToolset(idp)
	return nil
}
