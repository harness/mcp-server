package prompts

import (
	"log"
	"path/filepath"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	p "github.com/harness/harness-mcp/pkg/prompts"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterPrompts initializes and registers predefined prompts with the MCP server.
func RegisterPrompts(mcpServer *server.MCPServer, cfg config.Config) {
	prompts := p.Prompts{}

	// Get the current working directory to find prompt files
	currentDir, err := filepath.Abs(".")
	if err != nil {
		log.Printf("Failed to get current directory: %v", err)
		return
	}

	// Create file loader with the prompts package directory
	promptsDir := filepath.Join(currentDir, "pkg", "harness", "prompts")
	fileLoader := NewFileLoader(promptsDir)

	// Register prompts common to both modes
	registerCommonPrompts(&prompts, fileLoader)

	if cfg.Internal {
		registerInternalPrompts(&prompts, fileLoader)
	} else {
		registerExternalPrompts(&prompts, fileLoader)
	}

	p.AddPrompts(prompts, mcpServer)
}

// registerCommonPrompts registers prompts shared by both modes
func registerCommonPrompts(prompts *p.Prompts, fileLoader *FileLoader) {
	commonPrompts, err := fileLoader.LoadCommonPrompts()
	if err != nil {
		log.Printf("Failed to load common prompts: %v", err)
		return
	}

	for _, promptFile := range commonPrompts {
		if promptFile.Metadata.Name != "" && promptFile.Content != "" {
			prompts.Append(
				p.NewPrompt().
					SetName(promptFile.Metadata.Name).
					SetDescription(promptFile.Metadata.Description).
					SetResultDescription(promptFile.Metadata.ResultDescription).
					SetText(promptFile.Content).
					Build())
		}
	}
}

// registerInternalPrompts registers prompts specific to internal mode
func registerInternalPrompts(prompts *p.Prompts, fileLoader *FileLoader) {
	internalPrompts, err := fileLoader.LoadInternalPrompts()
	if err != nil {
		log.Printf("Failed to load internal prompts: %v", err)
		return
	}

	for _, promptFile := range internalPrompts {
		if promptFile.Metadata.Name != "" && promptFile.Content != "" {
			prompts.Append(
				p.NewPrompt().
					SetName(promptFile.Metadata.Name).
					SetDescription(promptFile.Metadata.Description).
					SetResultDescription(promptFile.Metadata.ResultDescription).
					SetText(promptFile.Content).
					Build())
		}
	}
}

// registerExternalPrompts registers prompts specific to external mode
func registerExternalPrompts(prompts *p.Prompts, fileLoader *FileLoader) {
	externalPrompts, err := fileLoader.LoadExternalPrompts()
	if err != nil {
		log.Printf("Failed to load external prompts: %v", err)
		return
	}

	for _, promptFile := range externalPrompts {
		if promptFile.Metadata.Name != "" && promptFile.Content != "" {
			prompts.Append(
				p.NewPrompt().
					SetName(promptFile.Metadata.Name).
					SetDescription(promptFile.Metadata.Description).
					SetResultDescription(promptFile.Metadata.ResultDescription).
					SetText(promptFile.Content).
					Build())
		}
	}
}
