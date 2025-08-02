// Package types provides specific event type implementations
package types

import "github.com/harness/harness-mcp/pkg/harness/event"

const (
	PromptDisplayOrder = 100
)

// NewSimpleActionEvent creates a simple aciton selection component on the UI
func NewSimpleActionEvent(actions []string, opts ...event.CustomEventOption) event.CustomEvent {
	// Always include prompt display order by default
	allOpts := append([]event.CustomEventOption{event.WithDisplayOrder(PromptDisplayOrder)}, opts...)
	return event.NewCustomEvent("prompt", actions, allOpts...)
}
