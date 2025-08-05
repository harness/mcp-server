package event

import (
	"encoding/json"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
)

const (
	CustomEventURI      = "harness:custom-event"
	CustomEventMIMEType = "application/vnd.harness.custom-event+json"
)

// CustomEvent represents a custom event sent back to a client as embedded resource
type CustomEvent struct {
	Type         string `json:"type"`
	Continue     bool   `json:"continue,omitempty"` // wether the agent should continue or stop processing
	DisplayOrder int    `json:"display_order,omitempty"` // default will be the order that the items are added
	Content      any    `json:"content,omitempty"`
}

// CustomEventOption configures a CustomEvent
type CustomEventOption func(*CustomEvent)

// NewCustomEvent creates a new custom event with provided type and content
func NewCustomEvent(eventType string, content any, opts ...CustomEventOption) CustomEvent {
	ce := CustomEvent{
		Type:     eventType,
		Content:  content,
		Continue: true,
	}
	for _, opt := range opts {
		opt(&ce)
	}
	return ce
}

// WithContinue sets whether the event allows continuation
func WithContinue(continueFlag bool) CustomEventOption {
	return func(ce *CustomEvent) {
		ce.Continue = continueFlag
	}
}

// WithDisplayOrder sets the display order for the event
func WithDisplayOrder(order int) CustomEventOption {
	return func(ce *CustomEvent) {
		ce.DisplayOrder = order
	}
}

// CreateResource creates a resource from this event
func (e CustomEvent) CreateCustomResource() (*mcp.TextResourceContents, error) {
	jsonData, err := json.Marshal(e)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal custom event: %w", err)
	}

	return &mcp.TextResourceContents{
		URI:      CustomEventURI,
		MIMEType: CustomEventMIMEType,
		Text:     string(jsonData),
	}, nil
}

// CreateEmbeddedResource creates an embedded resource from this event
func (e CustomEvent) CreateEmbeddedResource() (mcp.Content, error) {
	resource, err := e.CreateCustomResource()
	if err != nil {
		return nil, err
	}
	return mcp.NewEmbeddedResource(resource), nil
}

// CreateBaseResponse creates a base response structure with entity information
func CreateBaseResponse(eventType, entityType string) map[string]any {
	return map[string]any{
		"entity_info": map[string]any{
			"entity_type": entityType,
		},
		"type": eventType,
	}
}

// FormatEventResponse formats the response data as a JSON string
func FormatEventResponse(eventType string, responseData map[string]any) string {
	jsonData, err := json.Marshal(responseData)
	if err != nil {
		// Return a basic error response if marshaling fails
		errorResponse := map[string]any{
			"entity_info": map[string]any{
				"entity_type": "error",
			},
			"type":  eventType,
			"error": fmt.Sprintf("Failed to marshal response: %v", err),
		}
		errorJSON, _ := json.Marshal(errorResponse)
		return string(errorJSON)
	}
	return string(jsonData)
}
