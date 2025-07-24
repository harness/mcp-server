package event

import (
	"encoding/json"
	"fmt"
)

type Builder interface {
	Build(raw json.RawMessage, tool string, args ...any) string
}

type Registry map[string]Builder

func (r Registry) Register(event string, b Builder) { r[event] = b }
func (r Registry) Build(event string, raw json.RawMessage, tool string, args ...any) string {
	if b, ok := r[event]; ok {
		return b.Build(raw, tool, args...)
	}
	return r["unknown_event"].Build(raw, tool, args...)
}

// CreateBaseResponse creates a base response with consistent entity info and event type
func CreateBaseResponse(eventType string, tool string) map[string]interface{} {
	return map[string]interface{}{
		"entity_info": map[string]string{
			"entity_type": tool,
		},
		"type": eventType,
	}
}

// FormatEventResponse formats a response map into a consistent event format
func FormatEventResponse(eventType string, responseData map[string]interface{}) string {
	out, err := json.MarshalIndent(responseData, "", "  ")
	if err != nil {
		return fmt.Sprintf(`{"type": "%s", "error": "Failed to format event response"}`, eventType)
	}
	return string(out)
}
