package prompts

import (
	"embed"
	"log"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
)

//go:embed files/*
var promptFiles embed.FS

// GetModulePrompts retrieves prompts for a specific module
func GetModulePrompts(module string, cfg config.Config) ([]PromptFile, error) {
	// Use embedded filesystem instead of file system paths
	fileLoader := NewEmbedFileLoader(promptFiles)

	var allPrompts []PromptFile

	// Load common prompts for the module
	commonPrompts, err := fileLoader.LoadModulePrompts("files/common", module)
	if err != nil {
		log.Printf("Failed to load common prompts for module %s: %v", module, err)
	} else {
		allPrompts = append(allPrompts, commonPrompts...)
	}

	// Load mode-specific prompts for the module
	if cfg.Internal {
		internalPrompts, err := fileLoader.LoadModulePrompts("files/internal", module)
		if err != nil {
			log.Printf("Failed to load internal prompts for module %s: %v", module, err)
		} else {
			allPrompts = append(allPrompts, internalPrompts...)
		}
	} else {
		externalPrompts, err := fileLoader.LoadModulePrompts("files/external", module)
		if err != nil {
			log.Printf("Failed to load external prompts for module %s: %v", module, err)
		} else {
			allPrompts = append(allPrompts, externalPrompts...)
		}
	}

	return allPrompts, nil
}
