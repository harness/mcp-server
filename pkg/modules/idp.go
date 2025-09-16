package modules

import (
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
	"github.com/mark3labs/mcp-go/server"
)

// IDPModule implements the Module interface for Internal Developer Portal
type IDPModule struct {
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

	var ngManagerAuthProvider auth.Provider
	if config.Internal {
		ngManagerAuthProvider = auth.NewJWTProvider(config.NgManagerSecret, utils.ServiceIdentity, &utils.DefaultJWTLifetime)
	} else {
		ngManagerAuthProvider = auth.NewAPIKeyProvider(config.APIKey)
	}

	idpClient := &client.IDPService{
		Client:                c,
		NgManagerAuthProvider: ngManagerAuthProvider,
	}

	// Get the GenAI client using the shared method
	genaiClient, err := GetGenAIClient(config)
	if err != nil {
		return fmt.Errorf("failed to create client for genai: %w", err)
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
	}

	// Add GenerateWorflowTool only if genaiClient is available
	if genaiClient != nil {
		idpTools = append(idpTools, toolsets.NewServerTool(tools.GenerateWorflowTool(config, genaiClient)))
	}

	idp := toolsets.NewToolset("idp", "Harness Internal Developer Portal catalog related tools for managing catalog Entities which represent the core components of your system").
		AddReadTools(idpTools...)

	// Add toolset to the group
	tsg.AddToolset(idp)
	return nil
}
