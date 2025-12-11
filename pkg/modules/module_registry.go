package modules

import (
	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/pkg/toolsets"
	commonModules "github.com/harness/mcp-server/common/pkg/modules"
)

// NewModuleRegistry creates a new module registry with all available modules
func NewModuleRegistry(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *commonModules.ModuleRegistry {
	registry := &commonModules.ModuleRegistry{
		Modules: []commonModules.Module{
			commonModules.NewCoreModule(config, tsg),
			commonModules.NewCIModule(config, tsg),
			commonModules.NewCDModule(config, tsg),
			commonModules.NewUnlicensedModule(config, tsg),
			commonModules.NewCHAOSModule(config, tsg),
			commonModules.NewSEIModule(config, tsg),
			commonModules.NewSTOModule(config, tsg),
			commonModules.NewSSCAModule(config, tsg),
			commonModules.NewCODEModule(config, tsg),
			commonModules.NewCCMModule(config, tsg),
			commonModules.NewIDPModule(config, tsg),
			commonModules.NewHARModule(config, tsg),
			NewACMModule(config, tsg),
		},
		Config:           config,
		Tsg:              tsg,
		ModuleToToolsets: make(map[string][]string),
		ToolsetToModule:  make(map[string]string),
	}

	// Populate the moduleToToolsets mapping
	for _, module := range registry.Modules {
		registry.ModuleToToolsets[module.ID()] = module.Toolsets()

		for _, toolset := range module.Toolsets() {
			registry.ToolsetToModule[toolset] = module.ID()
		}
	}

	return registry
}