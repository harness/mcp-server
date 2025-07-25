package modules

import (
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// UnlicensedModule implements the Module interface for "Unlicensed Module"
type UnlicensedModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewUnlicensedModule creates a new instance of UnlicensedModule
func NewUnlicensedModule(config *config.Config, tsg *toolsets.ToolsetGroup) *UnlicensedModule {
	return &UnlicensedModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *UnlicensedModule) ID() string {
	return "UNLICENSED"
}

// Name returns the name of module
func (m *UnlicensedModule) Name() string {
	return "Unlicensed Module"
}

// Toolsets returns the names of toolsets provided by this module
func (m *UnlicensedModule) Toolsets() []string {
	return []string{}
}

// RegisterToolsets registers all toolsets in the AR module
func (m *UnlicensedModule) RegisterToolsets() error {
	return nil
}

// EnableToolsets enables all toolsets in the Unlicensed module
func (m *UnlicensedModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *UnlicensedModule) IsDefault() bool {
	return true
}
