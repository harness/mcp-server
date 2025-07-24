package appseccommons

import (
	"encoding/json"
	"log/slog"

	builder "github.com/harness/harness-mcp/pkg/harness/event/common"
	"github.com/mark3labs/mcp-go/mcp"
)

// NewToolResultTextWithPrompts creates a new CallToolResult with a text content and optional prompts
func NewToolResultTextWithPrompts(eventType string, event string, prompts []string, module string, columns []string) *mcp.CallToolResult {
	// Create the base content with the text
	contents := []mcp.Content{
		mcp.TextContent{
			Type: "text",
			Text: builder.Reg.Build(eventType, []byte(event), module, columns),
		},
	}

	// Only add prompts resource if prompts are provided
	if len(prompts) > 0 {
		// Use the PromptBuilder to format the prompts
		promptData, err := json.Marshal(prompts)
		if err != nil {
			slog.Error("Failed to marshal prompts", "error", err)
			promptData = []byte("[]")
		}

		contents = append(contents, mcp.TextContent{
			Type: "text",
			Text: builder.Reg.Build(string(builder.PromptEvent), promptData, module),
		})
	}

	return &mcp.CallToolResult{
		Content: contents,
	}
}
