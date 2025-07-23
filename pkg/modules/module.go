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
	// RegisterToolsets registers all toolsets in that module
	RegisterToolsets() error
	// IsDefault indicates if this module should be enabled by default
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
			NewDefaultModule(config, tsg),
			// In Phase 1, only register the DefaultModule
			// Additional modules will be added in future phases
		},
		config: config,
		tsg:    tsg,
	}
}

// GetEnabledModules returns modules that match the enabled module IDs
func (r *ModuleRegistry) GetEnabledModules() []Module {
	// If no specific modules are enabled, return all default modules
	if len(r.config.EnabledModules) == 0 {
		var defaultModules []Module
		for _, module := range r.modules {
			if module.IsDefault() {
				defaultModules = append(defaultModules, module)
			}
		}
		return defaultModules
	}

	// Create a map for quick lookup of enabled module IDs
	enabledModuleMap := make(map[string]bool)
	for _, id := range r.config.EnabledModules {
		enabledModuleMap[id] = true
	}

	// Special case: if "all" is in the list, return all modules
	if enabledModuleMap["all"] {
		return r.modules
	}

	// Return only the modules that match the enabled module IDs
	var enabledModules []Module
	for _, module := range r.modules {
		if enabledModuleMap[module.ID()] {
			enabledModules = append(enabledModules, module)
		}
	}

	return enabledModules
}

// GetAllModules returns all registered modules
func (r *ModuleRegistry) GetAllModules() []Module {
	return r.modules
}
