package modules

import (
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// FMEModule implements the Module interface for Feature Management and Experimentation
type FMEModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewFMEModule creates a new instance of FMEModule
func NewFMEModule(config *config.Config, tsg *toolsets.ToolsetGroup) *FMEModule {
	return &FMEModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *FMEModule) ID() string {
	return "FME"
}

// Name returns the name of module
func (m *FMEModule) Name() string {
	return "Feature Management and Experimentation"
}

// Toolsets returns the names of toolsets provided by this module
func (m *FMEModule) Toolsets() []string {
	return []string{
		"fme",
	}
}

// RegisterToolsets registers all toolsets in the FME module
func (m *FMEModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "fme":
			if err := RegisterFeatureManagementAndExperimentation(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the FME module
func (m *FMEModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *FMEModule) IsDefault() bool {
	return false
}

// RegisterFeatureManagementAndExperimentation registers the FME toolset
func RegisterFeatureManagementAndExperimentation(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Create FME client with Split.io base URL
	splitIOBaseURL := "https://api.split.io"

	// Use the existing API key as Split.io API key for now
	// TODO: Add separate SPLIT_IO_API_KEY environment variable
	// Split.io uses Bearer token authentication, not x-api-key
	authProvider := auth.NewBearerTokenProvider(config.APIKey)

	// Create client with Split.io base URL
	fmeClient, err := client.NewWithAuthProvider(splitIOBaseURL, authProvider, "")
	if err != nil {
		return fmt.Errorf("failed to create FME client: %w", err)
	}

	// Create FME service
	fmeService := &client.FMEService{
		Client: fmeClient,
	}

	// Create the FME toolset
	fme := toolsets.NewToolset("fme", "Feature Management and Experimentation related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListFMEWorkspacesTool(config, fmeService)),
			toolsets.NewServerTool(tools.ListFMEEnvironmentsTool(config, fmeService)),
			toolsets.NewServerTool(tools.ListFMEFeatureFlagsTool(config, fmeService)),
			toolsets.NewServerTool(tools.GetFMEFeatureFlagDefinitionTool(config, fmeService)),
		)

	// Add toolset to the group
	tsg.AddToolset(fme)
	return nil
}
