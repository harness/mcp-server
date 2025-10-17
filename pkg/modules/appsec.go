package modules

import (
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// AppSecModule implements the Module interface for Application Security
type AppSecModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewAppSecModule creates a new instance of AppSecModule
func NewAppSecModule(config *config.Config, tsg *toolsets.ToolsetGroup) *AppSecModule {
	return &AppSecModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *AppSecModule) ID() string {
	return "APPSEC"
}

// Name returns the name of module
func (m *AppSecModule) Name() string {
	return "Application Security"
}

// Toolsets returns the names of toolsets provided by this module
func (m *AppSecModule) Toolsets() []string {
	return []string{
		"appsec",
	}
}

// RegisterToolsets registers all toolsets in the AppSec module
func (m *AppSecModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "appsec":
			if err := RegisterAppSec(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the AppSec module
func (m *AppSecModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *AppSecModule) IsDefault() bool {
	return false
}

func RegisterAppSec(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Build the AppSec service URL
	appSecBaseURL := utils.BuildServiceURL(config, config.AppSecBaseURL, "https://appsec.harness.io", "graphql")
	appSecSecret := config.AppSecSecret

	// Create base client for AppSec
	appSecClient, err := utils.CreateClient(appSecBaseURL, config, appSecSecret)
	if err != nil {
		return err
	}

	appSecServiceClient := &client.AppSecService{
		Client: appSecClient,
	}

	// Create the AppSec toolset
	appSec := toolsets.NewToolset("appsec", "Harness Application Security related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.AppSecTool(config, appSecServiceClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(appSec)
	return nil
}