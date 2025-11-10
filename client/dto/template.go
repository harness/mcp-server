package dto

// TemplateListOptions represents options for listing templates
type TemplateListOptions struct {
	// Pagination parameters
	Page  int `json:"page,omitempty"`  // Default: 0
	Limit int `json:"limit,omitempty"` // Default: 30

	// Sorting parameters
	Sort  string `json:"sort,omitempty"`  // Enum: "identifier" "name" "updated"
	Order string `json:"order,omitempty"` // Enum: "ASC" "DESC"

	// Filtering parameters
	SearchTerm string `json:"search_term,omitempty"` // Filter resources having attributes matching with search term
	Type       string `json:"type,omitempty"`        // Template List Type: Enum: "STABLE_TEMPLATE" "LAST_UPDATES_TEMPLATE" "ALL"
	Recursive  bool   `json:"recursive,omitempty"`   // Default: false - Specify true if all accessible Templates are to be included

	// List filtering
	Names       []string `json:"names,omitempty"`        // Template names for filtering
	Identifiers []string `json:"identifiers,omitempty"`  // Template Ids for Filtering
	EntityTypes []string `json:"entity_types,omitempty"` // Type of Template - Enum: "Step" "Stage" "Pipeline" "CustomDeployment" "MonitoredService" "SecretManager"
	ChildTypes  []string `json:"child_types,omitempty"`  // Child types describe the type of Step or stage
}

// TemplateMetadataSummaryResponse represents a template metadata summary
type TemplateMetadataSummaryResponse struct {
	Account        string            `json:"account,omitempty"`
	Org            string            `json:"org,omitempty"`
	Project        string            `json:"project,omitempty"`
	Identifier     string            `json:"identifier,omitempty"`
	Name           string            `json:"name,omitempty"`
	Description    string            `json:"description,omitempty"`
	Tags           map[string]string `json:"tags,omitempty"`
	VersionLabel   string            `json:"version_label,omitempty"`
	EntityType     string            `json:"entity_type,omitempty"`
	ChildType      string            `json:"child_type,omitempty"`
	Scope          string            `json:"scope,omitempty"`
	Version        int64             `json:"version,omitempty"`
	GitDetails     *EntityGitDetails `json:"git_details,omitempty"`
	Updated        int64             `json:"updated,omitempty"`
	StoreType      string            `json:"store_type,omitempty"`
	ConnectorRef   string            `json:"connector_ref,omitempty"`
	StableTemplate bool              `json:"stable_template,omitempty"`
}

// EntityGitDetails represents git details for an entity
type EntityGitDetails struct {
	ObjectID   string `json:"object_id,omitempty"`
	BranchName string `json:"branch_name,omitempty"`
	FilePath   string `json:"file_path,omitempty"`
	RepoName   string `json:"repo_name,omitempty"`
	CommitID   string `json:"commit_id,omitempty"`
	FileURL    string `json:"file_url,omitempty"`
	RepoURL    string `json:"repo_url,omitempty"`
}

// TemplateMetaDataList represents a list of template metadata
type TemplateMetaDataList []TemplateMetadataSummaryResponse

// TemplateOutput is a custom struct for template output with numeric timestamps
type TemplateOutput struct {
	Account        string            `json:"account,omitempty"`
	Org            string            `json:"org,omitempty"`
	Project        string            `json:"project,omitempty"`
	Identifier     string            `json:"identifier,omitempty"`
	Name           string            `json:"name,omitempty"`
	Description    string            `json:"description,omitempty"`
	Tags           map[string]string `json:"tags,omitempty"`
	VersionLabel   string            `json:"version_label,omitempty"`
	EntityType     string            `json:"entity_type,omitempty"`
	ChildType      string            `json:"child_type,omitempty"`
	Scope          string            `json:"scope,omitempty"`
	Version        int64             `json:"version,omitempty"`
	GitDetails     *EntityGitDetails `json:"git_details,omitempty"`
	Updated        string            `json:"updated,omitempty"`
	StoreType      string            `json:"store_type,omitempty"`
	ConnectorRef   string            `json:"connector_ref,omitempty"`
	StableTemplate bool              `json:"stable_template,omitempty"`
}

// TemplateListOutput is a custom struct for template list output with numeric timestamps
type TemplateListOutput struct {
	Templates []TemplateOutput `json:"templates"`
}

// ToTemplateResponse processes the raw API response and adds human-readable timestamps
func ToTemplateResponse(data *TemplateMetaDataList) *TemplateListOutput {
	if data == nil {
		return &TemplateListOutput{Templates: []TemplateOutput{}}
	}

	result := &TemplateListOutput{
		Templates: make([]TemplateOutput, len(*data)),
	}

	for i, template := range *data {
		// Copy all fields
		output := TemplateOutput{
			Account:        template.Account,
			Org:            template.Org,
			Project:        template.Project,
			Identifier:     template.Identifier,
			Name:           template.Name,
			Description:    template.Description,
			Tags:           template.Tags,
			VersionLabel:   template.VersionLabel,
			EntityType:     template.EntityType,
			ChildType:      template.ChildType,
			Scope:          template.Scope,
			Version:        template.Version,
			GitDetails:     template.GitDetails,
			Updated:        FormatUnixMillisToMMDDYYYY(template.Updated),
			StoreType:      template.StoreType,
			ConnectorRef:   template.ConnectorRef,
			StableTemplate: template.StableTemplate,
		}

		result.Templates[i] = output
	}

	return result
}

// TemplateWithSpec represents the actual template data with full specification
type TemplateWithSpec struct {
	Account        string            `json:"accountId,omitempty"`
	Org            string            `json:"orgIdentifier,omitempty"`
	Project        string            `json:"projectIdentifier,omitempty"`
	Identifier     string            `json:"identifier,omitempty"`
	Name           string            `json:"name,omitempty"`
	Description    string            `json:"description,omitempty"`
	Tags           map[string]string `json:"tags,omitempty"`
	VersionLabel   string            `json:"versionLabel,omitempty"`
	EntityType     string            `json:"templateEntityType,omitempty"`
	ChildType      string            `json:"childType,omitempty"`
	Scope          string            `json:"templateScope,omitempty"`
	Version        int64             `json:"version,omitempty"`
	GitDetails     *EntityGitDetails `json:"gitDetails,omitempty"`
	Updated        int64             `json:"lastUpdatedAt,omitempty"`
	StoreType      string            `json:"storeType,omitempty"`
	ConnectorRef   string            `json:"connectorRef,omitempty"`
	StableTemplate bool              `json:"stableTemplate,omitempty"`
	Yaml           string            `json:"yaml,omitempty"`
	Icon           string            `json:"icon,omitempty"`
}

// TemplateGetResponse represents the API response wrapper for getting a single template
type TemplateGetResponse struct {
	Template TemplateWithSpec `json:"template"`
	Inputs   any              `json:"inputs"`
}
