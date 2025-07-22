package scs

import (
	"encoding/json"
	"fmt"

	builder "github.com/harness/harness-mcp/pkg/harness/event"
)

var Reg = builder.Registry{
	"generic_table": GenericTableBuilder{},
	"opa":           OPABuilder{},
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

	env := map[string]interface{}{
		"actions": []string{"REGENERATE", "ACCEPT"},
		"entity_info": map[string]string{
			"entity_type": tool,
		},
		"type": tool,
		"table": map[string]interface{}{
			"columns": cols,
			"rows":    rows,
		},
	}
	out, _ := json.MarshalIndent(env, "", "  ")
	return "event: generic_table\n" + string(out)
}

type OPABuilder struct{}

func (OPABuilder) Build(raw json.RawMessage, tool string) string {
	// Use hardcoded event type for OPA policies
	const eventType = "opa"
	
	// Parse the raw JSON into a map
	var data map[string]interface{}
	if err := json.Unmarshal(raw, &data); err != nil {
		// If parsing fails, return the raw data with the event type
		return fmt.Sprintf("event: %s\n%s", eventType, string(raw))
	}
	
	// Format the response with the policy and metadata
	env := map[string]interface{}{
		"actions": []string{"REGENERATE", "ACCEPT"},
		"entity_info": map[string]string{
			"entity_type": tool,
		},
		"type": eventType,
		"policy": data["policy"],
		"metadata": map[string]interface{}{
			"denied_licenses": data["denied_licenses"],
		},
	}
	

	
	out, _ := json.MarshalIndent(env, "", "  ")
	return fmt.Sprintf("event: %s\n%s", eventType, string(out))
}
