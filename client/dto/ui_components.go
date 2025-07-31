package dto

// Display order constants for UI components
// All components should be displayed in the order they are added to the response
// Prompts are displayed last always
const (
	PromptDisplayOrder = 100
)

// UIComponent interface defines common behavior for all UI components
type UIComponent interface {
	GetType() string
}

// EntityInfo represents entity type information for UI components
type EntityInfo struct {
	EntityType string `json:"entity_type,omitempty"`
}

// BaseUIComponent defines the base structure for all UI components
type BaseUIComponent struct {
	Type         string    `json:"type"`
	EntityInfo   EntityInfo `json:"entity_info,omitempty"`
	Continue     bool      `json:"continue,omitempty"`
	DisplayOrder int       `json:"display_order,omitempty"`
}

func (b BaseUIComponent) GetType() string {
	return b.Type
}

type SelectOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}


// SelectComponent represents a select UI component
type SelectComponent struct {
	BaseUIComponent
	Options    []SelectOption `json:"options"`
	Title      string         `json:"title"`
}

// NewSelectComponent creates a select component with the new format
func NewSelectComponent(entityType string, title string, options []SelectOption) SelectComponent {
	return SelectComponent{
		BaseUIComponent: BaseUIComponent{
			Type: "select",
			EntityInfo: EntityInfo{
				EntityType: entityType,
			},
			Continue: false,
		},
		Options: options,
		Title:   title,
	}
}

// MultiSelectComponent represents a group of checkboxes
type MultiSelectComponent struct {
	BaseUIComponent
	Options    []SelectOption `json:"options"`
	Title      string         `json:"title"`
}

// NewMultiSelectComponent creates a multi-select component with the new format
func NewMultiSelectComponent(entityType string, title string, options []SelectOption) MultiSelectComponent {
	return MultiSelectComponent{
		BaseUIComponent: BaseUIComponent{
			Type: "multi_select",
			EntityInfo: EntityInfo{
				EntityType: entityType,
			},
			Continue: false,
		},
		Options: options,
		Title:   title,
	}
}

// OPAComponent represents an OPA policy UI component
type OPAComponent struct {
	BaseUIComponent
	Policy     OPAPolicy      `json:"policy"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// OPAPolicy represents the policy content in an OPA component
type OPAPolicy struct {
	// Name is the identifier for the policy
	Name string `json:"name"`
	// Content is the Rego policy as a string
	Content string `json:"content"`
}

// NewOPAComponent creates an OPA policy component with the new format
// Kept entityType for now to match the old format
func NewOPAComponent(entityType string, policyName, policyContent string, metadata map[string]any) OPAComponent {
	return OPAComponent{
		BaseUIComponent: BaseUIComponent{
			Type: "opa",
			EntityInfo: EntityInfo{
				EntityType: entityType,
			},
			Continue: true,
		},
		Policy: OPAPolicy{
			Name:    policyName,
			Content: policyContent,
		},
		Metadata: metadata,
	}
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

// TableData represents the data structure for table contents
type TableData struct {
	Columns []TableColumn `json:"columns"`
	Rows    []TableRow    `json:"rows"`
}

// TableComponent represents a table UI component with rows and columns
// Each row in Rows contains values corresponding to the keys defined in Columns
type TableComponent struct {
	BaseUIComponent
	Table TableData `json:"table"`
}

// NewTableComponent creates a table component
// Kept entityType for now to match the old format
func NewTableComponent(entityType string, columns []TableColumn, rows []TableRow) TableComponent {
	return TableComponent{
		BaseUIComponent: BaseUIComponent{
			EntityInfo: EntityInfo{
				EntityType: entityType,
			},
			Type: "table",
			Continue: true,
		},
		Table: TableData{
			Columns: columns,
			Rows:    rows,
		},
	}
}

// PromptComponent represents a UI component for follow-up prompts
type PromptComponent struct {
	BaseUIComponent
	Prompts []string `json:"prompts"`
}

// NewPromptComponent creates a prompt component with the new format
func NewPromptComponent(entityType string, prompts []string) PromptComponent {
	return PromptComponent{
		BaseUIComponent: BaseUIComponent{
			EntityInfo: EntityInfo{
				EntityType: entityType,
			},
			Type:   "prompt",
			Continue: true,
			DisplayOrder: PromptDisplayOrder,
		},
		Prompts: prompts,
	}
}
