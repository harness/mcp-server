package modules

import (
	"log/slog"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// Default timeout for RMG GenAI service
const defaultRMGGenaiTimeout = 300 * time.Second

// RMGModule implements the Module interface for RMG-specific toolsets
type RMGModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewRMGModule creates a new instance of RMGModule
func NewRMGModule(config *config.Config, tsg *toolsets.ToolsetGroup) *RMGModule {
	return &RMGModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *RMGModule) ID() string {
	return "RMG"
}

// Name returns the name of module
func (m *RMGModule) Name() string {
	return "RMG Module"
}

// Toolsets returns the names of toolsets provided by this module
func (m *RMGModule) Toolsets() []string {
	return []string{
		"rmg_genai",
	}
}

// RegisterToolsets registers all toolsets in the RMG module
func (m *RMGModule) RegisterToolsets() error {
	for _, i := range m.Toolsets() {
		switch i {
		case "rmg_genai":
			err := RegisterRMGGenAI(m.config, m.tsg)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the RMG module
func (m *RMGModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *RMGModule) IsDefault() bool {
	slog.Info("Registering RMG GenAI toolsetsss")

	return true
}

// GetRMGGenAIClient creates and returns a GenAI client if in internal mode, otherwise returns nil
func GetRMGGenAIClient(config *config.Config) (*client.GenaiService, error) {
	// Skip registration for external mode for now
	if !config.Internal {
		return nil, nil
	}

	// Determine the base URL and secret for genai service
	baseURL := config.GenaiBaseURL // Only used in internal mode
	secret := config.GenaiSecret

	// Create base client for genai with the default timeout
	c, err := utils.CreateClient(baseURL, config, secret, defaultRMGGenaiTimeout)
	if err != nil {
		return nil, err
	}

	return &client.GenaiService{Client: c}, nil
}

// RegisterRMGGenAI registers the RMG genai toolset with a different name
func RegisterRMGGenAI(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Skip registration for external mode for now
	if !config.Internal {
		return nil
	}

	slog.Info("Registering RMG GenAI toolset")
	// Get the GenAI client using the RMG-specific helper function
	genaiClient, err := GetRMGGenAIClient(config)
	if err != nil {
		return err
	}

	// Create the RMG genai toolset with the new RMG-specific tool
	rmgGenai := toolsets.NewToolset("rmg_genai", "RMG GenAI tools").
		AddReadTools(
			toolsets.NewServerTool(tools.RMDevOpsAgentTool(config, genaiClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(rmgGenai)
	return nil
}
