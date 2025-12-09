package modules

import (
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// ModuleRegistry holds all available modules
type ModuleRegistry struct {
	Modules          []Module
	Config           *config.Config
	Tsg              *toolsets.ToolsetGroup
	ModuleToToolsets map[string][]string // Maps module IDs to their toolsets
	ToolsetToModule  map[string]string   // Maps toolset names to their modules
}

// GetAllModules returns all available modules
func (r *ModuleRegistry) GetAllModules() []Module {
	return r.Modules
}

// GetToolsetsForModule returns the toolsets associated with a module ID
func (r *ModuleRegistry) GetToolsetsForModule(moduleID string) []string {
	if toolsets, exists := r.ModuleToToolsets[moduleID]; exists {
		return toolsets
	}
	return []string{}
}

// GetToolsetGroup returns the underlying toolset group
func (r *ModuleRegistry) GetToolsetGroup() *toolsets.ToolsetGroup {
	return r.Tsg
}

// Global registry instance
var globalRegistry *ModuleRegistry

// SetGlobalRegistry sets the global module registry instance
func SetGlobalRegistry(registry *ModuleRegistry) {
	globalRegistry = registry
}

// GetGlobalRegistry returns the global module registry instance
func GetGlobalRegistry() *ModuleRegistry {
	return globalRegistry
}

// ValidateToolsets checks if the given toolsets are allowed based on licensed modules
// Returns:
// - allowedToolsets: list of toolsets the user can use
// - deniedToolsets: list of toolsets the user cannot use (with reasons)
func (r *ModuleRegistry) ValidateToolsets(
	requestedToolsets []string,
	licensedModules map[string]bool,
) (allowedToolsets []string, deniedToolsets map[string]string) {

	deniedToolsets = make(map[string]string)
	allowedToolsets = []string{}

	for _, toolset := range requestedToolsets {
		// Check if toolset exists
		moduleID, exists := r.ToolsetToModule[toolset]
		if !exists {
			deniedToolsets[toolset] = "toolset does not exist"
			continue
		}

		// Check if the module is licensed
		// Handle special case for CCM -> CE mapping
		licenseKey := moduleID
		if moduleID == "CCM" {
			licenseKey = "CE"
		}

		// Check if module is default (always allowed) or licensed
		module := r.getModuleByID(moduleID)
		if module != nil && (module.IsDefault() || licensedModules[licenseKey]) {
			allowedToolsets = append(allowedToolsets, toolset)
		} else {
			deniedToolsets[toolset] = fmt.Sprintf("module %s is not licensed", moduleID)
		}
	}

	return allowedToolsets, deniedToolsets
}

// Helper method to get module by ID
func (r *ModuleRegistry) getModuleByID(moduleID string) Module {
	for _, module := range r.Modules {
		if module.ID() == moduleID {
			return module
		}
	}
	return nil
}
