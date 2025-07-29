package dto

type BaseUIComponent struct {
	ComponentType string                 `json:"component_type"`
	Title         string                 `json:"title,omitempty"`
	Description   string                 `json:"description,omitempty"`
}

type SelectOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// SelectComponent represents a select UI component
type SelectComponent struct {
	BaseUIComponent
	Options     []SelectOption `json:"options"`
	DefaultValue string        `json:"default_value,omitempty"`
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
	Prompts     []SelectOption `json:"prompts"`
}
