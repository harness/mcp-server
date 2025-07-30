package modules

import (
	"strings"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/prompts"
	p "github.com/harness/harness-mcp/pkg/prompts"
	"github.com/harness/harness-mcp/pkg/toolsets"
	"github.com/mark3labs/mcp-go/server"
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

	// HasPrompts returns true if this module has prompts
	HasPrompts() bool

	// RegisterPrompts registers all prompts for this module
	RegisterPrompts(mcpServer *server.MCPServer) error

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
	// If no specific modules are enabled, return all default modules
	if len(r.config.EnableModules) == 0 {
		var defaultModules []Module
		for _, module := range r.modules {
			if module.IsDefault() {
				defaultModules = append(defaultModules, module)
			}
		}
		return defaultModules
	}

	// Create a map for quick lookup of enabled module IDs
	enabledModuleIDs := make(map[string]bool)
	for _, id := range r.config.EnableModules {
		enabledModuleIDs[id] = true
	}

	// Check if "all" is enabled
	if enabledModuleIDs["all"] {
		return r.modules
	}

	enabledModuleIDs["CORE"] = true

	// Return only enabled modules
	var enabledModules []Module
	for _, module := range r.modules {
		if enabledModuleIDs[module.ID()] {
			enabledModules = append(enabledModules, module)
		}
	}
	return enabledModules
}

// RegisterPrompts registers all prompts for enabled modules
func (r *ModuleRegistry) RegisterPrompts(mcpServer *server.MCPServer) error {
	// Get enabled modules
	enabledModules := r.GetEnabledModules()

	// Register prompts for each enabled module
	for _, module := range enabledModules {
		// Check if module has prompts
		if module.HasPrompts() {
			err := module.RegisterPrompts(mcpServer)
			if err != nil {
				return err
			}
		}
	}

	return nil
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

// ModuleRegisterPrompts is a helper function for registering prompts for a module
func ModuleRegisterPrompts(moduleID string, mcpServer *server.MCPServer, cfg config.Config) error {
	// Get module-specific prompts
	modulePrompts, err := prompts.GetModulePrompts(strings.ToLower(moduleID), cfg)
	if err != nil {
		return err
	}

	if len(modulePrompts) == 0 {
		// No prompts for this module
		return nil
	}

	// Convert to MCP prompts
	mcpPrompts := p.Prompts{}
	for _, promptFile := range modulePrompts {
		if promptFile.Metadata.Name != "" && promptFile.Content != "" {
			// Create MCP prompt
			mcpPrompt := p.NewPrompt().
				SetName(promptFile.Metadata.Name).
				SetDescription(promptFile.Metadata.Description).
				SetResultDescription(promptFile.Metadata.ResultDescription).
				SetText(promptFile.Content).
				Build()
			mcpPrompts.Append(mcpPrompt)
		}
	}

	// Register the prompts with the MCP server
	p.AddPrompts(mcpPrompts, mcpServer)

	return nil
}
