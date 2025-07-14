package dto

// TemplateListOptions represents options for listing templates
type TemplateListOptions struct {
	SearchTerm       string `json:"search_term,omitempty"`
	TemplateListType string `json:"template_list_type,omitempty"`
	PaginationOptions
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
