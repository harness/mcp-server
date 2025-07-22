package appseccommons

import (
	"encoding/json"
	"log/slog"

	builder "github.com/harness/harness-mcp/pkg/harness/event/scs"
	"github.com/mark3labs/mcp-go/mcp"
)

func NewToolResultTextWithPrompts(eventType string, event string, prompts []string) *mcp.CallToolResult {
	// Create the base content with the text
	contents := []mcp.Content{
		mcp.TextContent{
			Type: "text",
			Text: builder.Reg.Build(eventType, []byte(event), "scs_result"),
		},
	}

	// Only add prompts resource if prompts are provided
	if len(prompts) > 0 {
		data, err := json.Marshal(prompts)
		if err != nil {
			slog.Error("Failed to marshal prompts", "error", err)
			data = []byte("[]")
		}

		contents = append(contents, mcp.NewEmbeddedResource(mcp.TextResourceContents{
			URI:  "followup://prompts",
			Text: string(data),
		}))
	}

	return &mcp.CallToolResult{
		Content: contents,
	}
}
