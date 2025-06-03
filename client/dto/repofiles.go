package dto

// RepoFileContentOptions represents options for retrieving repository file content
type RepoFileContentOptions struct {
	GitRef        string `json:"git_ref,omitempty"`
	IncludeCommit bool   `json:"include_commit,omitempty"`
}

// FileContent represents the content part of the repository file response
type FileContent struct {
	Data          string `json:"data"`
	DataSize      int64  `json:"data_size"`
	Encoding      string `json:"encoding"`
	LfsObjectID   string `json:"lfs_object_id,omitempty"`
	LfsObjectSize int64  `json:"lfs_object_size,omitempty"`
	Size          int64  `json:"size"`
}

// CommitIdentity represents the identity information in a commit
type CommitIdentity struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

// CommitAuthor represents author/committer information
type CommitAuthor struct {
	Identity CommitIdentity `json:"identity"`
	When     string         `json:"when"`
}

// CommitFileStats represents file statistics in a commit
type CommitFileStats struct {
	Changes    int    `json:"changes"`
	Deletions  int    `json:"deletions"`
	Insertions int    `json:"insertions"`
	OldPath    string `json:"old_path"`
	Path       string `json:"path"`
	Status     string `json:"status"`
}

// CommitStats represents the total statistics of a commit
type CommitStats struct {
	Files []CommitFileStats `json:"files"`
	Total struct {
		Changes    int `json:"changes"`
		Deletions  int `json:"deletions"`
		Insertions int `json:"insertions"`
	} `json:"total"`
}

// LatestCommit represents the commit information
type LatestCommit struct {
	Author      CommitAuthor `json:"author"`
	Committer   CommitAuthor `json:"committer"`
	Message     string       `json:"message"`
	ParentSHAs  []string    `json:"parent_shas"`
	SHA         string      `json:"sha"`
	Stats       CommitStats `json:"stats"`
	Title       string      `json:"title"`
}

// RepoFileContent represents a repository file content response
type RepoFileContent struct {
	Content      FileContent  `json:"content"`
	LatestCommit LatestCommit `json:"latest_commit,omitempty"`
	Name         string       `json:"name"`
	Path         string       `json:"path"`
	SHA          string       `json:"sha"`
	Type         string       `json:"type"`
}
