// Package types provides specific event type implementations
package types

import "github.com/harness/harness-mcp/pkg/harness/event"

// TableColumn represents a column in a table
type TableColumn struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

// TableRow represents a row of data in a table
type TableRow = map[string]any

// TableData represents the structure of a table
type TableData struct {
	Columns []TableColumn `json:"columns"`
	Rows    []TableRow    `json:"rows"`
}

type TableWrapper struct {
	Table TableData `json:"table"`
}

// NewTableEvent creates a table event with columns and rows
func NewTableEvent(tableData TableData, opts ...event.CustomEventOption) event.CustomEvent {
	wrapper := TableWrapper{Table: tableData}
	return event.NewCustomEvent("table", wrapper, opts...)
}
