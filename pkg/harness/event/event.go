package event

import (
	"encoding/json"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
)

// CustomEvent represents a custom event sent through the unified agent
type CustomEvent struct {
	Type         string `json:"type"`
	Continue     bool   `json:"continue,omitempty"`
	DisplayOrder int    `json:"display_order,omitempty"`
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
		URI:      fmt.Sprintf("harness:custom-event/%s", e.Type),
		MIMEType: "application/vnd.harness.custom-event+json",
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
