package common

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
	PromptEvent       EventType = "prompt"
	RawEvent          EventType = "raw"
)

var Reg = builder.Registry{
	string(GenericTableEvent): GenericTableBuilder{},
	string(OPAEvent):          OPABuilder{},
	string(PromptEvent):       PromptBuilder{},
	string(RawEvent):          RawBuilder{},
}

type GenericTableBuilder struct{}

func (GenericTableBuilder) Build(raw json.RawMessage, tool string, args ...any) string {
	// unmarshal only to discover the shape
	var rows []map[string]interface{}
	_ = json.Unmarshal(raw, &rows) // ignore errors; empty rows is OK

	// determine allowed columns from args[0]
	var allowedCols []string
	if len(args) > 0 {
		if ac, ok := args[0].([]string); ok {
			allowedCols = ac
		}
	}
	allowed := map[string]bool{}
	for _, col := range allowedCols {
		allowed[col] = true
	}

	// build column descriptors and filter rows in the order of allowedCols
	var cols []map[string]string
	var filteredRows []map[string]interface{}
	if len(allowedCols) > 0 {
		// Only include columns in allowedCols, in the order given
		for _, col := range allowedCols {
			cols = append(cols, map[string]string{
				"key":   col,
				"label": col,
			})
		}
		for _, row := range rows {
			filtered := map[string]interface{}{}
			for _, col := range allowedCols {
				if v, ok := row[col]; ok {
					filtered[col] = v
				}
			}
			filteredRows = append(filteredRows, filtered)
		}
	} else {
		// Fallback: include all columns in original order
		if len(rows) > 0 {
			for k := range rows[0] {
				cols = append(cols, map[string]string{
					"key":   k,
					"label": k,
				})
			}
		}
		for _, row := range rows {
			filtered := map[string]interface{}{}
			for k, v := range row {
				filtered[k] = v
			}
			filteredRows = append(filteredRows, filtered)
		}
	}

	// Create base response with consistent structure
	env := builder.CreateBaseResponse(string(GenericTableEvent), tool)
	// Add table-specific data
	env["table"] = map[string]interface{}{
		"columns": cols,
		"rows":    filteredRows,
	}
	// Format the response using the common formatter
	return builder.FormatEventResponse(string(GenericTableEvent), env)
}

type OPABuilder struct{}

type RawBuilder struct{}

func (RawBuilder) Build(raw json.RawMessage, tool string, args ...any) string {
	eventType := string(RawEvent)

	// Create base response with consistent structure
	env := builder.CreateBaseResponse(eventType, tool)
	env["description"] = "THIS IS A RAW EVENT.INTENDED TO USE BY LLM TO UNDERSTAND THE TOOL RESPONSE. DO NOT CREATE ANY TABLES FROM THIS EVENT"
	// Parse the raw JSON into a generic interface
	var data interface{}
	if err := json.Unmarshal(raw, &data); err != nil {
		// Return a safe error response
		return fmt.Sprintf(`{"type": "%s", "error": "Failed to parse raw data"}`, eventType)
	}

	// Add raw data to the response
	env["data"] = data

	// Format the response using the common formatter
	return builder.FormatEventResponse(eventType, env)
}

type PromptBuilder struct{}

func (PromptBuilder) Build(raw json.RawMessage, tool string, args ...any) string {
	eventType := string(PromptEvent)
	// Parse the raw JSON into a slice of prompts
	var prompts []string
	if err := json.Unmarshal(raw, &prompts); err != nil {
		// Return a safe error response instead of raw data
		return `{"error": "Failed to parse prompt data", "type": "prompt"}`
	}

	// Create base response with consistent structure
	env := builder.CreateBaseResponse(eventType, tool)
	env["prompts"] = prompts

	// Format the response using the common formatter
	return builder.FormatEventResponse(eventType, env)
}

func (OPABuilder) Build(raw json.RawMessage, tool string, args ...any) string {
	// Use the event type constant for OPA policies
	eventType := string(OPAEvent)

	// Parse the raw JSON into a map
	var data map[string]interface{}
	if err := json.Unmarshal(raw, &data); err != nil {
		// Return a safe error response
		return fmt.Sprintf(`{"type": "%s", "error": "Failed to parse policy data"}`, eventType)
	}

	// Create base response with consistent structure
	env := builder.CreateBaseResponse(eventType, tool)
	// Add OPA-specific data with the new format
	env["policy"] = map[string]interface{}{
		"name":    "deny-list",
		"content": data["policy"],
	}
	env["metadata"] = map[string]interface{}{
		"denied_licenses": data["denied_licenses"],
	}

	// Format the response using the common formatter
	return builder.FormatEventResponse(eventType, env)
}
