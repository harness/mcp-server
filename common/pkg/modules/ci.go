package modules

import (
	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// CIModule implements the Module interface for Continuous Integration
type CIModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewCIModule creates a new instance of CIModule
func NewCIModule(config *config.Config, tsg *toolsets.ToolsetGroup) *CIModule {
	return &CIModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *CIModule) ID() string {
	return "CI"
}

// Name returns the name of module
func (m *CIModule) Name() string {
	return "Continuous Integration"
}

// Toolsets returns the names of toolsets provided by this module
func (m *CIModule) Toolsets() []string {
	return []string{}
}

// RegisterToolsets registers all toolsets in the CI module
func (m *CIModule) RegisterToolsets() error {
	// TODO: Implement CI module toolset registration
	return nil
}

// EnableToolsets enables all toolsets in the CI module
func (m *CIModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *CIModule) IsDefault() bool {
	return false
}
