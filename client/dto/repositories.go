package dto

// Repository represents a repository in the system
type Repository struct {
	Archived       bool   `json:"archived,omitempty"`
	Created        int64  `json:"created,omitempty"`
	CreatedBy      int    `json:"created_by,omitempty"`
	DefaultBranch  string `json:"default_branch,omitempty"`
	Deleted        int64  `json:"deleted,omitempty"`
	Description    string `json:"description,omitempty"`
	ForkID         int    `json:"fork_id,omitempty"`
	GitSSHURL      string `json:"git_ssh_url,omitempty"`
	GitURL         string `json:"git_url,omitempty"`
	ID             int    `json:"id,omitempty"`
	Identifier     string `json:"identifier,omitempty"`
	Importing      bool   `json:"importing,omitempty"`
	IsEmpty        bool   `json:"is_empty,omitempty"`
	IsPublic       bool   `json:"is_public,omitempty"`
	LastGitPush    int64  `json:"last_git_push,omitempty"`
	NumClosedPulls int    `json:"num_closed_pulls,omitempty"`
	NumForks       int    `json:"num_forks,omitempty"`
	NumMergedPulls int    `json:"num_merged_pulls,omitempty"`
	NumOpenPulls   int    `json:"num_open_pulls,omitempty"`
	NumPulls       int    `json:"num_pulls,omitempty"`
	ParentID       int    `json:"parent_id,omitempty"`
	Path           string `json:"path,omitempty"`
	Size           int64  `json:"size,omitempty"`
	SizeUpdated    int64  `json:"size_updated,omitempty"`
	State          int    `json:"state,omitempty"`
	Updated        int64  `json:"updated,omitempty"`
}

// RepositoryOptions represents the options for listing repositories
type RepositoryOptions struct {
	Query string `json:"query,omitempty"`
	Sort  string `json:"sort,omitempty"`
	Order string `json:"order,omitempty"`
	Page  int    `json:"page,omitempty"`
	Limit int    `json:"limit,omitempty"`
}
