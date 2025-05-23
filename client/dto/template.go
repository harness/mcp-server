package dto

// TemplateListOptions represents the options for listing templates
type TemplateListOptions struct {
	PaginationOptions
	SearchTerm      string `json:"searchTerm,omitempty"`
	TemplateListType string `json:"templateListType,omitempty"`
	Sort            string `json:"sort,omitempty"`
}

// TemplateListItem represents an item in the template list
type TemplateListItem struct {
	Name          string            `json:"name,omitempty"`
	Identifier    string            `json:"identifier,omitempty"`
	Description   string            `json:"description,omitempty"`
	Tags          map[string]string `json:"tags,omitempty"`
	Version       int               `json:"version,omitempty"`
	CreatedAt     int64             `json:"createdAt,omitempty"`
	LastUpdatedAt int64             `json:"lastUpdatedAt,omitempty"`
	Type          string            `json:"type,omitempty"`
	StoreType     string            `json:"storeType,omitempty"`
	VersionLabel  string            `json:"versionLabel,omitempty"`
	ConnectorRef  string            `json:"connectorRef,omitempty"`
}

// TemplateData represents the data field of a template response
type TemplateData struct {
	Name          string            `json:"name,omitempty"`
	Identifier    string            `json:"identifier,omitempty"`
	Description   string            `json:"description,omitempty"`
	YamlContent   string            `json:"yamlContent,omitempty"`
	Tags          map[string]string `json:"tags,omitempty"`
	Version       int               `json:"version,omitempty"`
	CreatedAt     int64             `json:"createdAt,omitempty"`
	LastUpdatedAt int64             `json:"lastUpdatedAt,omitempty"`
	Type          string            `json:"type,omitempty"`
	StoreType     string            `json:"storeType,omitempty"`
	VersionLabel  string            `json:"versionLabel,omitempty"`
	ConnectorRef  string            `json:"connectorRef,omitempty"`
}

// TemplateCreate represents the data needed to create a template
type TemplateCreate struct {
	Name         string            `json:"name"`
	Identifier   string            `json:"identifier"`
	Description  string            `json:"description,omitempty"`
	YamlContent  string            `json:"yamlContent"`
	Tags         map[string]string `json:"tags,omitempty"`
	Type         string            `json:"type"`
	StoreType    string            `json:"storeType,omitempty"`
	VersionLabel string            `json:"versionLabel,omitempty"`
}

// TemplateUpdate represents the data needed to update a template
type TemplateUpdate struct {
	Name         string            `json:"name,omitempty"`
	Description  string            `json:"description,omitempty"`
	YamlContent  string            `json:"yamlContent,omitempty"`
	Tags         map[string]string `json:"tags,omitempty"`
	VersionLabel string            `json:"versionLabel,omitempty"`
}