package ccmcommons

// ViewRule represents a single rule within viewRules array
type ViewRule struct {
	ViewConditions []ViewCondition `json:"viewConditions"`
}

// ViewCondition represents a condition within a view rule
type ViewCondition struct {
	Type         string    `json:"type"` // Should be "VIEW_ID_CONDITION"
	ViewField    ViewField `json:"viewField"`
	ViewOperator string    `json:"viewOperator"`
	Values       []string  `json:"values"`
}

// ViewField represents the field specification in a view condition
type ViewField struct {
	FieldID        string `json:"fieldId"`
	FieldName      string `json:"fieldName"`
	Identifier     string `json:"identifier"`
	IdentifierName string `json:"identifierName"`
}
