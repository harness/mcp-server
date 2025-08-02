// Package types provides specific event type implementations
package types

import "github.com/harness/harness-mcp/pkg/harness/event"

const (
	ActionDisplayOrder = 100
)

// NewActionEvent uses strings and makes simple selectable actions in the UI (always displayed last)
func NewActionEvent(actions []string, opts ...event.CustomEventOption) event.CustomEvent {
	allOpts := append([]event.CustomEventOption{event.WithDisplayOrder(ActionDisplayOrder)}, opts...)
	return event.NewCustomEvent("prompt", actions, allOpts...)
}
