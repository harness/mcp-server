package scs

import (
	"encoding/json"
	"fmt"

	builder "github.com/harness/harness-mcp/pkg/harness/event"
)

// EventType defines the type of SCS event
type EventType string

// SCS event types
const (
	GenericTableEvent EventType = "table"
	OPAEvent          EventType = "opa"
)

var Reg = builder.Registry{
	string(GenericTableEvent): GenericTableBuilder{},
	string(OPAEvent):          OPABuilder{},
}

type GenericTableBuilder struct{}

func (GenericTableBuilder) Build(raw json.RawMessage, tool string) string {
	// unmarshal only to discover the shape
	var rows []map[string]interface{}
	_ = json.Unmarshal(raw, &rows) // ignore errors; empty rows is OK

	// build column descriptors from first row keys
	var cols []map[string]string
	if len(rows) > 0 {
		for k := range rows[0] {
			cols = append(cols, map[string]string{
				"key":   k,
				"label": k,
			})
		}
	}

	// Create base response with consistent structure
	env := builder.CreateBaseResponse(string(GenericTableEvent), tool)
	// Add table-specific data
	env["table"] = map[string]interface{}{
		"columns": cols,
		"rows":    rows,
	}
	// Format the response using the common formatter
	return builder.FormatEventResponse(string(GenericTableEvent), env)
}

type OPABuilder struct{}

func (OPABuilder) Build(raw json.RawMessage, tool string) string {
	// Use the event type constant for OPA policies
	eventType := string(OPAEvent)

	// Parse the raw JSON into a map
	var data map[string]interface{}
	if err := json.Unmarshal(raw, &data); err != nil {
		// If parsing fails, return the raw data with the event type
		return fmt.Sprintf("event: %s\n%s", eventType, string(raw))
	}

	// Create base response with consistent structure
	env := builder.CreateBaseResponse(eventType, tool)
	// Add OPA-specific data
	env["policy"] = data["policy"]
	env["metadata"] = map[string]interface{}{
		"denied_licenses": data["denied_licenses"],
	}

	// Format the response using the common formatter
	return builder.FormatEventResponse(eventType, env)
}
