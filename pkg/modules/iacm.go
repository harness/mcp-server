package modules

import (
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// IacmModule implements the Module interface for IaCM toolsets
type IacmModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewIacmModule creates a new IaCM module instance
func NewIacmModule(config *config.Config, tsg *toolsets.ToolsetGroup) *IacmModule {
	return &IacmModule{
		config: config,
		tsg:    tsg,
	}
}

func (m *IacmModule) ID() string {
	return "IACM"
}

func (m *IacmModule) Name() string {
	return "Infrastructure as Code Management Module"
}

// IsDefault indicates if this module should be enabled by default
func (m *IacmModule) IsDefault() bool {
	return false
}

func (m *IacmModule) Toolsets() []string {
	return []string{
		"workspace_tools",
		"resource_tools",
		"module_registry_tools",
	}
}

func (m *IacmModule) RegisterToolsets() error {
	for _, toolsetName := range m.Toolsets() {
		switch toolsetName {
		case "workspace_tools":
			if err := RegisterWorkspaceTools(m.config, m.tsg); err != nil {
				return err
			}
		case "resource_tools":
			if err := RegisterResourceTools(m.config, m.tsg); err != nil {
				return err
			}
		case "module_registry_tools":
			if err := RegisterModuleRegistryTools(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the IaCM module
func (m *IacmModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// RegisterWorkspaceTools creates and registers the workspace_tools toolset
func RegisterWorkspaceTools(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Build IaCM service URL (e.g., https://app.harness.io/gateway/iacm)
	baseURL := utils.BuildServiceURL(config, config.IacmSvcBaseURL, config.BaseURL, "gateway")

	// Create HTTP client with auth headers
	c, err := utils.CreateClient(baseURL, config, "")
	if err != nil {
		return err
	}

	iacmClient := &client.IacmService{
		Client:     c,
		UseV1Paths: config.IacmUseV1Paths,
	}

	// Create toolset with read-only tools (no mutations in Phase 1)
	workspaceTools := toolsets.NewToolset("workspace_tools", "IaCM Workspace management tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListWorkspacesTool(config, iacmClient)),
			toolsets.NewServerTool(tools.GetWorkspaceTool(config, iacmClient)),
		)

	// Add to toolset group
	tsg.AddToolset(workspaceTools)
	return nil
}

// RegisterResourceTools creates and registers the resource_tools toolset
func RegisterResourceTools(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	baseURL := utils.BuildServiceURL(config, config.IacmSvcBaseURL, config.BaseURL, "gateway")
	c, err := utils.CreateClient(baseURL, config, "")
	if err != nil {
		return err
	}

	iacmClient := &client.IacmService{
		Client:     c,
		UseV1Paths: config.IacmUseV1Paths,
	}

	resourceTools := toolsets.NewToolset("resource_tools", "IaCM Resource management tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListResourcesTool(config, iacmClient)),
			toolsets.NewServerTool(tools.GetResourceTool(config, iacmClient)),
		)

	tsg.AddToolset(resourceTools)
	return nil
}

// RegisterModuleRegistryTools creates and registers the module_registry_tools toolset
func RegisterModuleRegistryTools(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	baseURL := utils.BuildServiceURL(config, config.IacmSvcBaseURL, config.BaseURL, "gateway")
	c, err := utils.CreateClient(baseURL, config, "")
	if err != nil {
		return err
	}

	iacmClient := &client.IacmService{
		Client:     c,
		UseV1Paths: config.IacmUseV1Paths,
	}

	moduleTools := toolsets.NewToolset("module_registry_tools", "IaCM Module Registry tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListModulesTool(config, iacmClient)),
			toolsets.NewServerTool(tools.GetModuleTool(config, iacmClient)),
		)

	tsg.AddToolset(moduleTools)
	return nil
}
