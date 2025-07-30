package dto

type BaseUIComponent struct {
	ComponentType string `json:"component_type"`
	Title         string `json:"title,omitempty"`
	Description   string `json:"description,omitempty"`
	Terminate     bool   `json:"terminate,omitempty"`
}

type SelectOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// SelectComponent represents a select UI component
type SelectComponent struct {
	BaseUIComponent
	Options      []SelectOption `json:"options"`
	DefaultValue string         `json:"default_value,omitempty"`
}

// MultiSelectComponent represents a group of checkboxes
type MultiSelectComponent struct {
	BaseUIComponent
	Options       []SelectOption `json:"options"`
	DefaultValues []string       `json:"default_values,omitempty"`
}

// PromptComponent represents a UI component for follow-up prompts
type PromptComponent struct {
	BaseUIComponent
	Prompts []SelectOption `json:"prompts"`
}

// TableColumn represents a column in a table UI component
type TableColumn struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

// TableRow represents a single row in a table
// The keys in this map should correspond to the 'Key' fields defined in the TableColumn structs
// For example, if columns include {Key: "id"} and {Key: "name"}, then each row should have
// entries with those keys: {"id": "123", "name": "example"}
type TableRow = map[string]any

// TableComponent represents a table UI component with rows and columns
// Each row in Rows contains values corresponding to the keys defined in Columns
type TableComponent struct {
	BaseUIComponent
	Columns []TableColumn `json:"columns"`
	Rows    []TableRow    `json:"rows"`
}

// OPAPolicy represents the policy content in an OPA component
type OPAPolicy struct {
	// Name is the identifier for the policy
	Name string `json:"name"`
	// Content is the Rego policy as a string
	Content string `json:"content"`
}

// OPAComponent represents an OPA policy UI component
type OPAComponent struct {
	BaseUIComponent
	Policy   OPAPolicy      `json:"policy"`
	Metadata map[string]any `json:"metadata,omitempty"`
}
