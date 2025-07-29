package utils

import (
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
)

// IsInternalMode checks if we're running in internal mode based on config
func IsInternalMode(config *config.Config) bool {
	return config != nil && config.Internal
}

// PromptOptions holds different prompts for internal and external modes
type PromptOptions struct {
	InternalPrompt string // Prompt for internal mode (unified agent)
	ExternalPrompt string // Prompt for external mode (all other clients)
}

// NewPromptOptions creates a new PromptOptions with internal and external prompts
func NewPromptOptions(internalPrompt, externalPrompt string) PromptOptions {
	return PromptOptions{
		InternalPrompt: internalPrompt,
		ExternalPrompt: externalPrompt,
	}
}

// NewToolResultWithResources creates a tool result with text content and optional embedded resources
// Resources are only included when in internal mode (determined by config)
// Optional promptOpts parameter allows specifying different prompts for internal vs external mode
func NewToolResultWithResources(
	config *config.Config,
	textContent string,
	resources []mcp.ResourceContents,
	promptOpts *PromptOptions,
) *mcp.CallToolResult {
	contents := []mcp.Content{}

	// Only add text content if it's not empty
	if textContent != "" {
		contents = append(contents, mcp.TextContent{
			Type: "text",
			Text: textContent,
		})
	}

	// Determine which mode we're in
	isInternal := IsInternalMode(config)

	// Add appropriate prompt if provided
	if promptOpts != nil {
		promptText := promptOpts.ExternalPrompt
		if isInternal {
			promptText = promptOpts.InternalPrompt
		}
		
		// Only add prompt if non-empty
		if promptText != "" {
			contents = append(contents, mcp.TextContent{
				Type: "text",
				Text: promptText,
			})
		}
	}
	
	// Add embedded resources in internal mode
	if isInternal {
		for _, resource := range resources {
			contents = append(contents, mcp.NewEmbeddedResource(resource))
		}
	}
	
	return &mcp.CallToolResult{
		Content: contents,
	}
}

// CreateUIResource creates a UI component resource
func CreateUIResource(componentType string, component any) mcp.TextResourceContents {
    jsonData, _ := json.Marshal(component)
    
    return mcp.TextResourceContents{
        URI:      fmt.Sprintf("harness:ui/component/%s", componentType),
        MIMEType: "application/vnd.harness.ui+json",
        Text:     string(jsonData),
    }
}

// CreateDataResource creates a resource for structured data
func CreateDataResource(dataType string, data any) mcp.TextResourceContents {
    jsonData, _ := json.Marshal(data)
    
    return mcp.TextResourceContents{
        URI:      fmt.Sprintf("harness:data/%s", dataType),
        MIMEType: "application/json",
        Text:     string(jsonData),
    }
}