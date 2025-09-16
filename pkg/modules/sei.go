package modules

import (
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// SEIModule implements the Module interface for Security and Compliance
type SEIModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewSEIModule creates a new instance of SEIModule
func NewSEIModule(config *config.Config, tsg *toolsets.ToolsetGroup) *SEIModule {
	return &SEIModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *SEIModule) ID() string {
	return "SEI"
}

// Name returns the name of module
func (m *SEIModule) Name() string {
	return "Security and Compliance"
}

// Toolsets returns the names of toolsets provided by this module
func (m *SEIModule) Toolsets() []string {
	return []string{}
}

// RegisterToolsets registers all toolsets in the SEI module
func (m *SEIModule) RegisterToolsets() error {
	return nil
}

// EnableToolsets enables all toolsets in the SEI module
func (m *SEIModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *SEIModule) IsDefault() bool {
	return false
}
