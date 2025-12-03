// Package types provides specific event type implementations
package types

import "github.com/harness/mcp-server/common/pkg/event"

const (
	ActionDisplayOrder = 100
)

type ActionWrapper struct {
	Prompts interface{} `json:"prompts"`
}

// NewActionEvent uses strings and makes simple selectable actions in the UI (always displayed last)
func NewActionEvent(actions interface{}, opts ...event.CustomEventOption) event.CustomEvent {
	allOpts := append([]event.CustomEventOption{event.WithDisplayOrder(ActionDisplayOrder)}, opts...)
	wrapper := ActionWrapper{Prompts: actions}
	return event.NewCustomEvent("prompt", wrapper, allOpts...)
}
