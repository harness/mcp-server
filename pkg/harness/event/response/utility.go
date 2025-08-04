package response

import (
	"encoding/json"
	"log/slog"

	"github.com/mark3labs/mcp-go/mcp"
)

// EventData represents an event with its type, data, and optional arguments
type EventData struct {
	EventType string
	Event     []byte
	Args      []any
}

// ToolResultBuilder helps build tool results with multiple events
type ToolResultBuilder struct {
	module string
	events []EventData
}

// NewToolResultBuilder creates a new ToolResultBuilder with the specified module
func NewToolResultBuilder(module string) *ToolResultBuilder {
	return &ToolResultBuilder{
		module: module,
		events: []EventData{},
	}
}

// AddEvent adds an event to the builder
func (b *ToolResultBuilder) AddEvent(eventType string, event []byte, args ...any) *ToolResultBuilder {
	b.events = append(b.events, EventData{
		EventType: eventType,
		Event:     event,
		Args:      args,
	})
	return b
}

// AddStringEvent adds an event with string data to the builder
func (b *ToolResultBuilder) AddStringEvent(eventType string, event string, args ...any) *ToolResultBuilder {
	return b.AddEvent(eventType, []byte(event), args...)
}

// AddPrompts adds prompts as an event to the builder
func (b *ToolResultBuilder) AddPrompts(prompts []string) *ToolResultBuilder {
	if len(prompts) > 0 {
		promptData, err := json.Marshal(prompts)
		if err != nil {
			slog.Error("Failed to marshal prompts", "error", err)
			promptData = []byte("[]")
		}
		return b.AddEvent("prompt", promptData)
	}
	return b
}

// Build creates a CallToolResult with all the added events
func (b *ToolResultBuilder) Build() *mcp.CallToolResult {
	var contents []mcp.Content

	for _, eventData := range b.events {
		// For the new system, we just add the raw JSON data as text content
		// The complex builder registry system has been replaced with direct content handling
		contents = append(contents, mcp.NewTextContent(string(eventData.Event)))
	}
	
	slog.Info("Building tool result", "module", b.module, "events", len(b.events))
	return &mcp.CallToolResult{
		Content: contents,
	}
}