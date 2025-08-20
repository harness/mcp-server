package modules

import (
	"encoding/json"
	"fmt"
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
			NewDbOpsModule(config, tsg),
			NewACMModule(config, tsg),
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
    // Create a map to store prompts by mode
    modulePromptsByMode := map[string][]prompts.PromptFile{
        string(p.Standard): {},
        string(p.Architect): {},
    }
    
    // Get module-specific prompts for standard mode
    standardPrompts, err := prompts.GetModulePrompts(prompts.PromptFiles, strings.ToLower(moduleID), cfg.Internal, string(p.Standard))
    if err != nil {
        return fmt.Errorf("failed to get standard prompts for module %s: %v", moduleID, err)
    }
    modulePromptsByMode[string(p.Standard)] = standardPrompts
    
    // Get module-specific prompts for architect mode (only for internal)
    if cfg.Internal {
        architectPrompts, err := prompts.GetModulePrompts(prompts.PromptFiles, strings.ToLower(moduleID), cfg.Internal, string(p.Architect))
        if err != nil {
            return fmt.Errorf("failed to get architect prompts for module %s: %v", moduleID, err)
        }
        modulePromptsByMode[string(p.Architect)] = architectPrompts
    }
    
    // Check if we have any prompts for this module
    totalPrompts := len(modulePromptsByMode[string(p.Standard)]) + len(modulePromptsByMode[string(p.Architect)])
    if totalPrompts == 0 {
        // No prompts for this module
        return nil
    }

    // Create a map to store combined content for each mode
    modeContents := make(map[string]string)
    
    // Get description and result description from the first available prompt
    description := ""
    resultDescription := ""
    
    // Process modes in a deterministic order, with Standard mode taking precedence for descriptions
    modeOrder := []string{string(p.Standard), string(p.Architect)}
    
    for _, mode := range modeOrder {
        modePrompts, exists := modulePromptsByMode[mode]
        if !exists || len(modePrompts) == 0 {
            continue // Skip empty modes
        }
        
        // Use the first prompt's metadata for description and result description if not already set
        // Standard mode takes precedence over Architect mode
        if description == "" && modePrompts[0].Metadata.Description != "" {
            description = modePrompts[0].Metadata.Description
        }
        
        if resultDescription == "" && modePrompts[0].Metadata.ResultDescription != "" {
            resultDescription = modePrompts[0].Metadata.ResultDescription
        }
        
        // Combine all prompt contents for this mode
        var combinedContent strings.Builder
        for i, promptFile := range modePrompts {
            if promptFile.Content != "" {
                if i > 0 {
                    combinedContent.WriteString("\n\n")
                }
                combinedContent.WriteString(promptFile.Content)
            }
        }
        
        // Store the combined content for this mode
        modeContents[mode] = combinedContent.String()
    }
    
    // Convert the mode contents map to JSON
    contentJSON, err := json.Marshal(modeContents)
    if err != nil {
        return fmt.Errorf("failed to marshal mode contents: %v", err)
    }
    
    // Create a single MCP prompt with the module ID as the name
    mcpPrompt := p.NewPrompt().
        SetName(strings.ToUpper(moduleID)). // Use moduleID as the prompt name
        SetDescription(description).
        SetResultDescription(resultDescription).
        SetText(string(contentJSON)). // Store the JSON map as the prompt text
        Build()
    
    // Create a Prompts collection with the single prompt
    mcpPrompts := p.Prompts{}
    mcpPrompts.Append(mcpPrompt)
    
    slog.Info("Registering prompt for", "module", moduleID, "contentLength", len(contentJSON))
    
    // Register the prompt with the MCP server
    p.AddPrompts(mcpPrompts, mcpServer)
    
    return nil
}
