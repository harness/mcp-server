package modules

import (
	"log/slog"
	"strings"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/prompts"
	p "github.com/harness/harness-mcp/pkg/prompts"
	"github.com/harness/harness-mcp/pkg/toolsets"
	"github.com/mark3labs/mcp-go/server"
)

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

// RegisterPrompts registers all prompts for enabled modules with the given MCP server.
// It loops through all enabled modules, checks if each module has prompts, and if so,
// registers the prompts with the MCP server.
func (r *ModuleRegistry) RegisterPrompts(mcpServer *server.MCPServer) error {
	// Get enabled modules
	enabledModules := r.GetEnabledModules()

	// Register prompts for each enabled module
	for _, module := range enabledModules {
		if err := registerPrompts(module.ID(), r.config, mcpServer); err != nil {
			return err
		}
	}

	return nil
}

func registerPrompts(moduleID string, cfg *config.Config, mcpServer *server.MCPServer) error {
	// Get module-specific prompts
	modulePrompts, err := prompts.GetModulePrompts(prompts.PromptFiles, strings.ToLower(moduleID), cfg.Internal)
	if err != nil {
		return err
	}

	if len(modulePrompts) == 0 {
		// No prompts for this module
		return nil
	}

	// Combine all prompt contents into a single prompt
	var combinedContent strings.Builder

	// Use the first prompt's metadata for description and result description if available
	description := ""
	if len(modulePrompts) > 0 && modulePrompts[0].Metadata.Description != "" {
		description = modulePrompts[0].Metadata.Description
	}

	resultDescription := ""
	if len(modulePrompts) > 0 && modulePrompts[0].Metadata.ResultDescription != "" {
		resultDescription = modulePrompts[0].Metadata.ResultDescription
	}

	// Combine all prompt contents
	for i, promptFile := range modulePrompts {
		if promptFile.Content != "" {
			if i > 0 {
				combinedContent.WriteString("\n\n")
			}
			combinedContent.WriteString(promptFile.Content)
		}
	}

	// Create a single MCP prompt with the module ID as the name
	mcpPrompt := p.NewPrompt().
		SetName(moduleID). // Use moduleID as the prompt name
		SetDescription(description).
		SetResultDescription(resultDescription).
		SetText(combinedContent.String()).
		Build()

	// Create a Prompts collection with the single prompt
	mcpPrompts := p.Prompts{}
	mcpPrompts.Append(mcpPrompt)

	slog.Info("Registering prompt for module", "module", moduleID, "contentLength", len(combinedContent.String()))

	// Register the prompt with the MCP server
	p.AddPrompts(mcpPrompts, mcpServer)

	return nil
}
