package modules

import (
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// Module interface defines the contract that all modules must implement
type Module interface {
	// ID returns the identifier for this module
	ID() string
	// Name returns the name of module
	Name() string

	// Toolsets returns the names of toolsets provided by this module
	Toolsets() []string

	// RegisterToolsets registers all toolsets in this module with the toolset group
	// It creates necessary clients and adds tools to the toolset group
	RegisterToolsets() error

	// EnableToolsets enables all toolsets in this module in the toolset group
	// This is called after RegisterToolsets to activate the toolsets
	EnableToolsets(tsg *toolsets.ToolsetGroup) error

	// IsDefault indicates if this module should be enabled by default
	// when no specific modules are requested
	IsDefault() bool
}

// ModuleEnableToolsets is a helper function that safely enables toolsets
// by only enabling toolsets that actually exist in the toolset group
func ModuleEnableToolsets(m Module, tsg *toolsets.ToolsetGroup) error {
	// Only enable toolsets that exist in the toolset group
	var existingToolsets []string
	for _, toolsetName := range m.Toolsets() {
		// Check if toolset exists in the group
		_, exists := tsg.Toolsets[toolsetName]
		if exists {
			existingToolsets = append(existingToolsets, toolsetName)
		}
	}

	// Enable only the existing toolsets
	if len(existingToolsets) == 0 {
		return nil
	}

	// Enable the toolsets
	return tsg.EnableToolsets(existingToolsets)
}
