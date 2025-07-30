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

// TableComponent represents a table UI component
type TableComponent struct {
	BaseUIComponent
	Columns []TableColumn    `json:"columns"`
	Rows    []map[string]any `json:"rows"`
}

// OPAPolicy represents the policy content in an OPA component
type OPAPolicy struct {
	Name    string `json:"name"`
	Content any    `json:"content"`
}

// OPAComponent represents an OPA policy UI component
type OPAComponent struct {
	BaseUIComponent
	Policy   OPAPolicy      `json:"policy"`
	Metadata map[string]any `json:"metadata,omitempty"`
}
