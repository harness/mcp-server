package dto

// SettingItem represents a single setting in the Harness settings API response
type SettingItem struct {
	Setting        Setting `json:"setting"`
	LastModifiedAt *int64  `json:"lastModifiedAt"`
}

// Setting represents the details of a Harness setting
type Setting struct {
	Identifier        string   `json:"identifier"`
	Name              string   `json:"name"`
	OrgIdentifier     *string  `json:"orgIdentifier"`
	ProjectIdentifier *string  `json:"projectIdentifier"`
	Category          string   `json:"category"`
	GroupIdentifier   string   `json:"groupIdentifier"`
	ValueType         string   `json:"valueType"`
	AllowedValues     []string `json:"allowedValues"`
	AllowOverrides    bool     `json:"allowOverrides"`
	Value             *string  `json:"value"`
	DefaultValue      *string  `json:"defaultValue"`
	SettingSource     string   `json:"settingSource"`
	IsSettingEditable bool     `json:"isSettingEditable"`
	AllowedScopes     []string `json:"allowedScopes"`
}

// SettingsResponse represents the response from the Harness settings API
type SettingsResponse struct {
	Status        string        `json:"status"`
	Data          []SettingItem `json:"data"`
	MetaData      interface{}   `json:"metaData"`
	CorrelationID string        `json:"correlationId"`
}

// SettingsListOptions represents options for listing settings
type SettingsListOptions struct {
	Category            string
	Group               string
	IncludeParentScopes bool
	PaginationOptions
}
