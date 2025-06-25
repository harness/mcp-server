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
