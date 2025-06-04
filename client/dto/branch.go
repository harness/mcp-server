package dto

// CreateBranchRequest represents a request to create a new branch
type CreateBranchRequest struct {
	BranchName string `json:"branch_name"`
	StartPoint string `json:"start_point,omitempty"` // Optional, defaults to default branch if not specified
}

// CreateBranchResponse represents the response from creating a branch
type CreateBranchResponse struct {
	Name      string `json:"name"`
	CommitSha string `json:"commit_sha"`
	Success   bool   `json:"success"`
}

// CommitFileRequest represents a request to commit a file change
type CommitFileRequest struct {
	Branch      string `json:"branch"`      // Branch to commit to
	FilePath    string `json:"file_path"`   // Path of the file to commit
	Content     string `json:"content"`     // Content to write to the file
	CommitMsg   string `json:"commit_msg"`  // Commit message
	IsNewFile   bool   `json:"is_new_file"` // Whether this is a new file or an update
}

// CommitFileResponse represents the response from committing a file
type CommitFileResponse struct {
	CommitSha string `json:"commit_sha"`
	Success   bool   `json:"success"`
}

// CommitMultipleFilesRequest represents a request to commit multiple file changes
type CommitMultipleFilesRequest struct {
	Branch    string          `json:"branch"`     // Branch to commit to
	CommitMsg string          `json:"commit_msg"` // Commit message
	Files     []CommitFileOp  `json:"files"`      // Files to commit
}

// CommitFileOp represents a single file operation in a multi-file commit
type CommitFileOp struct {
	FilePath    string `json:"file_path"`   // Path of the file
	Content     string `json:"content"`     // Content to write
	IsNewFile   bool   `json:"is_new_file"` // Whether this is a new file or an update
}
