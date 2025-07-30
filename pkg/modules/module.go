package modules

import (
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
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

// ModuleRegistry holds all available modules
type ModuleRegistry struct {
	modules []Module
	config  *config.Config
	tsg     *toolsets.ToolsetGroup
}

// NewModuleRegistry creates a new module registry with all available modules
func NewModuleRegistry(config *config.Config, tsg *toolsets.ToolsetGroup) *ModuleRegistry {
	return &ModuleRegistry{
		modules: []Module{
			NewCoreModule(config, tsg),
			NewCIModule(config, tsg),
			NewCDModule(config, tsg),
			NewUnlicensedModule(config, tsg),
			NewCHAOSModule(config, tsg),
			NewSEIModule(config, tsg),
			NewSTOModule(config, tsg),
			NewSSCAModule(config, tsg),
			NewCODEModule(config, tsg),
			NewCCMModule(config, tsg),
			NewIDPModule(config, tsg),
			NewHARModule(config, tsg),
		},
		config: config,
		tsg:    tsg,
	}
}

// GetAllModules returns all available modules
func (r *ModuleRegistry) GetAllModules() []Module {
	return r.modules
}

// GetEnabledModules returns the list of enabled modules based on configuration
func (r *ModuleRegistry) GetEnabledModules() []Module {
	// Create a map for quick lookup of enabled module IDs
	enabledModuleIDs := make(map[string]bool)

	// If no specific modules are enabled, return all default modules
	if len(r.config.EnableModules) == 0 {
		var defaultModules []Module
		for _, module := range r.modules {
			if module.IsDefault() {
				defaultModules = append(defaultModules, module)
				enabledModuleIDs[module.ID()] = true
			}
		}
		return defaultModules
	}

	for _, id := range r.config.EnableModules {
		enabledModuleIDs[id] = true
	}

	// Always include CORE module when specific modules are enabled
	enabledModuleIDs["CORE"] = true

	// Check if "all" is enabled
	if enabledModuleIDs["all"] {
		return r.modules
	}

	// Return only enabled modules
	var enabledModules []Module
	for _, module := range r.modules {
		if enabledModuleIDs[module.ID()] {
			enabledModules = append(enabledModules, module)
		}
	}
	return enabledModules
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
	return tsg.EnableToolsets(existingToolsets)
}
