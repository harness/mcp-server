package modules

import (
	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/auth"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
	"github.com/mark3labs/mcp-go/server"
)

// NgManagerAuthProviderFactory is a function type for creating NgManager auth providers
// This allows different implementations in internal vs external modes
type NgManagerAuthProviderFactory func(config *config.McpServerConfig) auth.Provider

// DefaultNgManagerAuthProviderFactory is the default implementation for creating NgManager auth providers
// This can be overridden by consuming repositories to provide custom implementations
var DefaultNgManagerAuthProviderFactory NgManagerAuthProviderFactory = func(config *config.McpServerConfig) auth.Provider {
	return auth.NewAPIKeyProvider(config.APIKey)
}

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
	c, err := DefaultClientProvider.CreateClient(config, "idp")
	if err != nil {
		return err
	}

	ngManagerAuthProvider := DefaultNgManagerAuthProviderFactory(config)

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
